import Foundation
import Capacitor
import CoreBluetooth

@objc(BleBridge)
public class BleBridge: CAPPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?

    private var desiredServiceUUIDs: [CBUUID] = []
    private var desiredNamePrefixes: [String] = []
    private var uuidForKey: [String: CBUUID] = [:]      // charKey -> UUID
    private var charForKey: [String: CBCharacteristic] = [:] // charKey -> discovered CBCharacteristic
    private var keyForChar: [CBUUID: String] = [:]      // reverse lookup for notifications

    private var pendingConnectCall: CAPPluginCall?

    // MARK: - Reconnect/Backoff
    private var autoReconnect = true
    private var reconnecting = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 6
    private let initialBackoffMs: Double = 400
    private var stopRequested = false

    private func scheduleReconnect() {
        guard autoReconnect, !stopRequested, !reconnecting, reconnectAttempts < maxReconnectAttempts else { return }
        reconnecting = true
        reconnectAttempts += 1
        let jitter = Double(Int.random(in: 0...150))
        let delayMs = min(initialBackoffMs * pow(2.0, Double(reconnectAttempts - 1)) + jitter, 8000)
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int(delayMs))) { [weak self] in
            guard let self = self, !self.stopRequested else { return }
            if let p = self.peripheral {
                self.central.connect(p, options: nil)
            } else {
                self.startScan()
            }
            self.reconnecting = false
        }
    }

    private func resetReconnectState() {
        reconnectAttempts = 0
        reconnecting = false
    }

    // MARK: - Lifecycle
    @objc override public func load() {
        super.load()
        self.central = CBCentralManager(delegate: self, queue: nil)
    }

    // MARK: - JS API

    // connectBle({ services: string[], characteristics: Record<charKey, uuid>, namePrefix?: string[] })
    @objc func connectBle(_ call: CAPPluginCall) {
        self.pendingConnectCall?.reject("Superseded by a new connectBle call")
        self.pendingConnectCall = call

        self.desiredServiceUUIDs = []
        self.desiredNamePrefixes = []
        self.uuidForKey = [:]
        self.charForKey = [:]
        self.keyForChar = [:]

        if let serviceIds = call.getArray("services", String.self) {
            self.desiredServiceUUIDs = serviceIds.map { CBUUID(string: $0) }
        }
        if let prefixes = call.getArray("namePrefix", String.self) {
            self.desiredNamePrefixes = prefixes
        }
        if let chars = call.getObject("characteristics") as? [String: String] {
            for (k, v) in chars {
                let u = CBUUID(string: v)
                self.uuidForKey[k] = u
                self.keyForChar[u] = k
            }
        }

        // Reset/cleanup any prior connection
        stopRequested = false
        if let p = self.peripheral {
            self.central.cancelPeripheralConnection(p)
        }

        // If BLE not ready yet, wait for .poweredOn
        if central.state != .poweredOn {
            // centralManagerDidUpdateState will pick it up
            return
        }

        startScan()
    }

    // write({ charKey, base64 })
    @objc func write(_ call: CAPPluginCall) {
        guard let charKey = call.getString("charKey") else {
            call.reject("Missing charKey")
            return
        }
        guard let base64 = call.getString("base64"), let data = Data(base64Encoded: base64) else {
            call.reject("Missing/invalid base64")
            return
        }
        guard let ch = charForKey[charKey], let p = peripheral else {
            call.reject("Characteristic not available or not connected")
            return
        }

        var writeType: CBCharacteristicWriteType = .withResponse
        if ch.properties.contains(.writeWithoutResponse) {
            writeType = .withoutResponse
        }
        p.writeValue(data, for: ch, type: writeType)
        call.resolve()
    }

    // subscribe({ charKey })
    @objc func subscribe(_ call: CAPPluginCall) {
        guard let charKey = call.getString("charKey") else {
            call.reject("Missing charKey")
            return
        }
        guard let ch = charForKey[charKey], let p = peripheral else {
            call.reject("Characteristic not available or not connected")
            return
        }
        p.setNotifyValue(true, for: ch)
        call.resolve()
    }

    // unsubscribe({ charKey })
    @objc func unsubscribe(_ call: CAPPluginCall) {
        guard let charKey = call.getString("charKey"),
              let ch = charForKey[charKey],
              let p = peripheral else {
            call.reject("Characteristic not available or not connected")
            return
        }
        p.setNotifyValue(false, for: ch)
        call.resolve()
    }

    // stopAll({})
    @objc func stopAll(_ call: CAPPluginCall) {
        stopRequested = true
        if let p = peripheral {
            for (_, ch) in charForKey {
                if ch.properties.contains(.notify) || ch.properties.contains(.indicate) {
                    p.setNotifyValue(false, for: ch)
                }
            }
            central.cancelPeripheralConnection(p)
        }
        self.charForKey.removeAll()
        self.keyForChar.removeAll()
        self.uuidForKey.removeAll()
        self.peripheral = nil
        resetReconnectState()
        call.resolve()
    }

    // MARK: - Scanning / Discovery

    private func startScan() {
        let opts: [String: Any] = [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        if desiredServiceUUIDs.isEmpty {
            central.scanForPeripherals(withServices: nil, options: opts)
        } else {
            central.scanForPeripherals(withServices: desiredServiceUUIDs, options: opts)
        }
    }

    private func matchesNamePrefix(_ name: String?) -> Bool {
        guard !desiredNamePrefixes.isEmpty else { return true }
        guard let n = name else { return false }
        for p in desiredNamePrefixes {
            if n.hasPrefix(p) { return true }
        }
        return false
    }

    // MARK: - CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            // If a connect was requested but we hadn’t started scanning yet, start now
            if self.pendingConnectCall != nil && self.peripheral == nil {
                startScan()
            }
        default:
            break
        }
    }

    public func centralManager(_ central: CBCentralManager,
                               didDiscover peripheral: CBPeripheral,
                               advertisementData: [String : Any],
                               rssi RSSI: NSNumber) {
        // Filter by namePrefix if provided
        let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? peripheral.name
        guard matchesNamePrefix(name) else { return }

        // Found our target—connect
        self.central.stopScan()
        self.peripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        resetReconnectState()
        // Emit connect event
        notifyListeners("bleConnect", data: [:], retainUntilConsumed: false)

        // Discover services (limit to desiredServiceUUIDs if provided)
        if desiredServiceUUIDs.isEmpty {
            peripheral.discoverServices(nil)
        } else {
            peripheral.discoverServices(desiredServiceUUIDs)
        }
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        // surface failure to the pending connect (first time) and try reconnect if enabled
        if let call = self.pendingConnectCall {
            call.reject("Failed to connect: \(error?.localizedDescription ?? "unknown")")
            self.pendingConnectCall = nil
        }
        scheduleReconnect()
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        // Emit disconnect event for UI
        notifyListeners("bleDisconnect", data: [
            "reason": error?.localizedDescription ?? "unknown"
        ], retainUntilConsumed: false)

        // Attempt auto-reconnect unless explicitly stopped
        if !stopRequested {
            scheduleReconnect()
        }
    }

    // MARK: - CBPeripheralDelegate

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let e = error {
            self.pendingConnectCall?.reject("Service discovery error: \(e.localizedDescription)")
            self.pendingConnectCall = nil
            return
        }
        guard let services = peripheral.services else {
            self.pendingConnectCall?.reject("No services found")
            self.pendingConnectCall = nil
            return
        }

        for svc in services {
            peripheral.discoverCharacteristics(nil, for: svc)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let e = error {
            // keep going; other services may still be fine
            print("Characteristic discovery error: \(e.localizedDescription)")
        }
        guard let chars = service.characteristics else { return }

        // Map any characteristics we care about
        for ch in chars {
            if let key = keyForChar[ch.uuid] {
                charForKey[key] = ch
            } else {
                // If user didn’t constrain services and multiple services have the same UUID,
                // the first one wins (common pattern is unique enough for vendor services)
                if let hit = uuidForKey.first(where: { $0.value == ch.uuid }) {
                    charForKey[hit.key] = ch
                    keyForChar[ch.uuid] = hit.key
                }
            }
        }

        // If at least one requested characteristic is found, consider connect resolved.
        if !uuidForKey.isEmpty {
            let allKnown = uuidForKey.keys.allSatisfy { charForKey[$0] != nil }
            if allKnown || anyCharFound() {
                self.pendingConnectCall?.resolve()
                self.pendingConnectCall = nil
            }
        } else {
            // If caller didn’t provide characteristic map, resolve once services are discovered
            self.pendingConnectCall?.resolve()
            self.pendingConnectCall = nil
        }
    }

    private func anyCharFound() -> Bool {
        return !charForKey.isEmpty
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let e = error {
            print("Notify value error: \(e.localizedDescription)")
            return
        }
        guard let data = characteristic.value else { return }
        guard let key = keyForChar[characteristic.uuid] else { return }

        let base64 = data.base64EncodedString()
        notifyListeners("bleValue", data: [
            "charKey": key,
            "base64": base64
        ], retainUntilConsumed: false)
    }
}
