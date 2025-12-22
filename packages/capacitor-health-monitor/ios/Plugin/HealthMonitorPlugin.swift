import Foundation
import Capacitor
import CoreBluetooth

@objc(HealthMonitorPlugin)
public class HealthMonitorPlugin: CAPPlugin, ThermometerDelegate, sdkHealthMoniterDelegate {

    private var sdk: LibHealthCombineSDK?
    private var connected = false
    private var streaming = false

    public override func load() {
        if let bundleURL = Bundle(for: HealthMonitorPlugin.self)
            .url(forResource: "LibHealthCombine", withExtension: "bundle"),
           let vendorBundle = Bundle(url: bundleURL) {
            NSLog("[HM] Loaded vendor bundle at \(bundleURL.lastPathComponent)")
            _ = vendorBundle.load()
        } else {
            NSLog("[HM] Vendor bundle not found (LibHealthCombine.bundle). Proceeding anyway.")
        }
        self.sdk = LibHealthCombineSDK.instance()
        if self.sdk == nil {
            NSLog("[HM] LibHealthCombineSDK.instance() returned nil")
        }
    }

    deinit { do { try stopAll() } catch {} }

    @objc func connect(_ call: CAPPluginCall) {
        guard let sdk = self.sdk else { call.reject("SDK not available"); return }
        let ok = sdk.startHealthMonitorService(withDelegate: self, tcpStateChangeBlock: nil)
        if !ok { call.reject("Failed to start service"); return }
        self.connected = true
        notifyTelemetry(connected: true)
        call.resolve(["ok": true])
    }

    @objc func startStreaming(_ call: CAPPluginCall) {
        guard let hm = self.sdk?.lt_HealthMonitor() else { call.reject("Not connected"); return }
        hm.startECG(with: "guest", gender: false, age: 30, height: 170, weight: 70)
        self.streaming = true
        call.resolve(["ok": true])
    }

    @objc func stopStreaming(_ call: CAPPluginCall) {
        self.sdk?.lt_HealthMonitor()?.endECG()
        self.streaming = false
        call.resolve(["ok": true])
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        stopAll()
        call.resolve(["ok": true])
    }

    private func stopAll() {
        self.sdk?.lt_HealthMonitor()?.endECG()
        self.sdk?.stopHealthMonitorService()
        self.connected = false
        self.streaming = false
        notifyTelemetry(connected: false)
    }

    private func notifyTelemetry(connected: Bool, batteryPct: Double? = nil, rssi: Int? = nil) {
        var data: [String: Any] = [
            "id": "duecare-health-monitor",
            "transport": "ble",
            "connected": connected
        ]
        if let pct = batteryPct { data["batteryPct"] = pct }
        if let r = rssi { data["rssi"] = r }
        self.notifyListeners("telemetry", data: data)
    }

    // MARK: - sdkHealthMoniterDelegate

    public func receiveBatteryData(_ state: BATTERYSTATE, batteryValue value: Double) {
        notifyTelemetry(connected: self.connected, batteryPct: value, rssi: nil)
    }

    public func receiveBloodPressure(_ systolic_pressure: Int32, andDiastolic_pressure diastolic: Int32, andHeart_beat hb: Int32) {
        self.notifyListeners("blood_pressure", data: [
            "systolic": Int(systolic_pressure),
            "diastolic": Int(diastolic),
            "unit": "mmHg"
        ])
        if hb > 0 {
            self.notifyListeners("heart_rate", data: ["hr": Int(hb), "unit": "bpm"])
        }
    }

    public func receiveThermometerData(_ temperature: Double) {
        self.notifyListeners("temperature", data: [
            "celsius": temperature,
            "fahrenheit": temperature * 9.0 / 5.0 + 32.0,
            "unit": "C"
        ])
    }

    public func receiveECGDataRowData(_ rowData: Int32) {
        self.notifyListeners("ecg", data: [
            "samples": [Int(rowData)],
            "sampleHz": 250
        ])
    }

    public func receiveECGDataHeartRate(_ heartRate: Int32) {
        self.notifyListeners("heart_rate", data: ["hr": Int(heartRate), "unit": "bpm"])
    }

    public func didConnectPeripheral(_ peripheral: CBPeripheral!) {
        self.connected = true
        notifyTelemetry(connected: true)
    }

    public func didDisconnectPeripheral(_ peripheral: CBPeripheral!, error: Error!) {
        self.connected = false
        notifyTelemetry(connected: false)
    }

    // Required no-ops
    public func obtianArrayOfFoundDevice(_ foundPeripherals: [Any]!) {}
    public func noTemperature() {}
    public func noSignal() {}
    public func obtianQRCode(_ code: String!) {}
    public func getQRCodeFailed() {}
    public func temperatureIsBalance() {}
}
