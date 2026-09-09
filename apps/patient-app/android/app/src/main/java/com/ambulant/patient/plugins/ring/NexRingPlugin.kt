package com.ambulant.patient.plugins.ring

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.Locale
import java.util.UUID

@CapacitorPlugin(
  name = "NexRing",
  permissions = [
    Permission(strings = [Manifest.permission.BLUETOOTH_CONNECT], alias = "btConnect"),
    Permission(strings = [Manifest.permission.BLUETOOTH_SCAN], alias = "btScan"),
    Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION], alias = "fineLocation"),
  ],
)
class NexRingPlugin : Plugin() {
  companion object {
    private const val TAG = "NexRing"
    private const val DEFAULT_MTU = 203
    private const val MIN_MTU = 23
    private const val MAX_MTU = 517
    private const val MAX_WRITE_BYTES = 512
    private const val SCAN_TIMEOUT_MS = 12_000L

    // Smart Ring RN SDK V1.3.7 / Constant.js authority.
    private val RING_SERVICE_UUID: UUID = UUID.fromString("00001822-0000-1000-8000-00805f9b34fb")
    private val RING_IO_UUID: UUID = UUID.fromString("000066fe-0000-1000-8000-00805f9b34fb")
    private val CCC_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
  }

  private val bluetoothManager: BluetoothManager?
    get() = context.getSystemService(BluetoothManager::class.java)

  private val bluetoothAdapter: BluetoothAdapter?
    get() = bluetoothManager?.adapter

  private var scannerActive = false
  private var gatt: BluetoothGatt? = null
  private var ioCharacteristic: BluetoothGattCharacteristic? = null
  private var connectedId: String? = null
  private var connectedName: String? = null
  private var negotiatedMtu: Int? = null
  private var ready = false
  private var pendingNotificationEnable = false
  private var pendingConnectCall: PluginCall? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var scanResultCount = 0

  private val scanTimeoutRunnable = Runnable {
    if (!scannerActive) return@Runnable

    try {
      bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
    } catch (t: Throwable) {
      Log.w(TAG, "scan timeout stop failed", t)
    }

    scannerActive = false
    val detail = if (scanResultCount == 0) {
      "timeout:no_results"
    } else {
      "timeout:results=$scanResultCount"
    }

    emitDiagnostic(
      stage = "scan_timeout",
      status = "complete",
      detail = detail,
      count = scanResultCount,
    )
    emitConnectionState("scan_stopped", message = detail)
  }

  private fun emitDiagnostic(
    stage: String,
    status: String,
    id: String? = connectedId,
    name: String? = connectedName,
    rssi: Int? = null,
    detail: String? = null,
    count: Int? = null,
    length: Int? = null,
    mtu: Int? = null,
  ) {
    val payload = JSObject()
      .put("stage", stage)
      .put("status", status)
      .put("ts", System.currentTimeMillis())
      .put("id", id)
      .put("name", name)
      .put("rssi", rssi)
      .put("detail", detail)
      .put("count", count)
      .put("length", length)
      .put("mtu", mtu)

    Log.i(TAG, "diag stage=$stage status=$status id=${id ?: ""} detail=${detail ?: ""}")
    notifyListeners("diagnostic", payload, true)
  }

  private fun cancelScanTimeout() {
    mainHandler.removeCallbacks(scanTimeoutRunnable)
  }

  private fun armScanTimeout() {
    cancelScanTimeout()
    mainHandler.postDelayed(scanTimeoutRunnable, SCAN_TIMEOUT_MS)
  }

  private fun hasNexRingPermissions(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      getPermissionState("btScan") == PermissionState.GRANTED &&
        getPermissionState("btConnect") == PermissionState.GRANTED
    } else {
      getPermissionState("fineLocation") == PermissionState.GRANTED
    }
  }

  @PluginMethod
  fun askPermissions(call: PluginCall) {
    emitDiagnostic("permissions", "check")

    if (hasNexRingPermissions()) {
      emitDiagnostic("permissions", "granted")
      call.resolve(JSObject().put("ok", true))
      return
    }

    emitDiagnostic("permissions", "request")
    bridge.saveCall(call)
    requestAllPermissions(call, "permissionsCallback")
  }

  @PermissionCallback
  private fun permissionsCallback(call: PluginCall) {
    if (hasNexRingPermissions()) {
      emitDiagnostic("permissions", "granted")
      call.resolve(JSObject().put("ok", true))
    } else {
      emitDiagnostic("permissions", "denied")
      call.reject("Required Bluetooth permissions not granted")
    }
  }

  private fun requireBleReady(call: PluginCall): BluetoothAdapter? {
    if (!hasNexRingPermissions()) {
      emitDiagnostic("ble_ready", "blocked", detail = "permissions_missing")
      call.reject("Required Bluetooth permissions not granted")
      return null
    }

    val adapter = bluetoothAdapter
    if (adapter == null) {
      emitDiagnostic("ble_ready", "blocked", detail = "adapter_unavailable")
      call.reject("Bluetooth adapter unavailable")
      return null
    }
    if (!adapter.isEnabled) {
      emitDiagnostic("ble_ready", "blocked", detail = "bluetooth_disabled")
      call.reject("Bluetooth is disabled")
      return null
    }

    emitDiagnostic("ble_ready", "ok")
    return adapter
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun startScan(call: PluginCall) {
    val adapter = requireBleReady(call) ?: return
    val scanner = adapter.bluetoothLeScanner
    if (scanner == null) {
      call.reject("Bluetooth LE scanner unavailable")
      return
    }

    try {
      cancelScanTimeout()
      if (scannerActive) {
        scanner.stopScan(scanCallback)
      }

      scanResultCount = 0
      emitDiagnostic("scan", "starting")
      scanner.startScan(scanCallback)
      scannerActive = true
      armScanTimeout()
      emitDiagnostic("scan", "started")
      emitConnectionState("scanning")
      call.resolve(JSObject().put("ok", true))
    } catch (t: Throwable) {
      cancelScanTimeout()
      scannerActive = false
      emitDiagnostic("scan", "failed", detail = t.message ?: t.javaClass.simpleName)
      emitError("scan_start_failed", t.message ?: t.javaClass.simpleName)
      call.reject("Unable to start NexRing scan", t as? Exception ?: Exception(t))
    }
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun stopScan(call: PluginCall) {
    try {
      bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
    } catch (t: Throwable) {
      Log.w(TAG, "stopScan failed", t)
    } finally {
      cancelScanTimeout()
      scannerActive = false
      emitDiagnostic("scan", "stopped", count = scanResultCount)
      emitConnectionState("scan_stopped", message = "manual:results=$scanResultCount")
    }
    call.resolve(JSObject().put("ok", true))
  }

  private val scanCallback = object : ScanCallback() {
    @SuppressLint("MissingPermission")
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      emitScanResult(result)
    }

    @SuppressLint("MissingPermission")
    override fun onBatchScanResults(results: MutableList<ScanResult>) {
      results.forEach(::emitScanResult)
    }

    override fun onScanFailed(errorCode: Int) {
      cancelScanTimeout()
      scannerActive = false
      emitDiagnostic("scan", "failed", detail = "android_code=$errorCode", count = scanResultCount)
      emitError("scan_failed", "Android BLE scan failed with code=$errorCode")
      emitConnectionState("error", message = "scan_failed:$errorCode")
    }
  }

  @SuppressLint("MissingPermission")
  private fun emitScanResult(result: ScanResult) {
    val device = result.device ?: return
    val address = device.address ?: return
    val record = result.scanRecord
    val name = try {
      device.name ?: record?.deviceName
    } catch (_: SecurityException) {
      record?.deviceName
    }

    val payload = JSObject()
      .put("id", address)
      .put("mac", address)
      .put("name", name ?: "")
      .put("rssi", result.rssi)
      .put("advBase64", record?.bytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) })

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      payload.put("isConnectable", result.isConnectable)
    }

    scanResultCount += 1
    emitDiagnostic(
      stage = "scan_result",
      status = "observed",
      id = address,
      name = name,
      rssi = result.rssi,
      count = scanResultCount,
    )
    notifyListeners("scanResult", payload, true)
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun connect(call: PluginCall) {
    val adapter = requireBleReady(call) ?: return
    val id = (call.getString("id") ?: call.getString("mac"))?.trim().orEmpty()
    val requestedName = call.getString("name")?.trim()

    if (id.isEmpty()) {
      call.reject("NexRing id or MAC address is required")
      return
    }
    if (!BluetoothAdapter.checkBluetoothAddress(id)) {
      call.reject("Invalid NexRing Bluetooth MAC address")
      return
    }

    try {
      if (scannerActive) {
        cancelScanTimeout()
        bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
        scannerActive = false
        emitDiagnostic("scan", "stopped_for_connect", count = scanResultCount)
        emitConnectionState("scan_stopped", message = "connect:results=$scanResultCount")
      }

      emitDiagnostic("connect", "starting", id = id, name = requestedName)
      closeGattSilently()
      ready = false
      negotiatedMtu = null
      connectedId = id
      connectedName = requestedName
      pendingConnectCall = call
      emitConnectionState("connecting", id, requestedName)

      val device = adapter.getRemoteDevice(id)
      emitDiagnostic("gatt", "connect_requested", id = id, name = requestedName)
      gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
      } else {
        device.connectGatt(context, false, gattCallback)
      }

      if (gatt == null) {
        pendingConnectCall = null
        emitError("connect_failed", "connectGatt returned null")
        call.reject("Unable to create NexRing GATT connection")
      }
    } catch (t: Throwable) {
      pendingConnectCall = null
      closeGattSilently()
      emitError("connect_failed", t.message ?: t.javaClass.simpleName)
      call.reject("Unable to connect to NexRing", t as? Exception ?: Exception(t))
    }
  }

  private val gattCallback = object : BluetoothGattCallback() {
    @SuppressLint("MissingPermission")
    override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
      if (gatt !== g) return

      if (status != BluetoothGatt.GATT_SUCCESS) {
        failConnection("gatt_connection_failed", "status=$status state=$newState")
        return
      }

      when (newState) {
        BluetoothProfile.STATE_CONNECTED -> {
          emitDiagnostic("gatt", "connected")
          emitConnectionState("connected", connectedId, connectedName)
          emitDiagnostic("service_discovery", "starting")
          if (!g.discoverServices()) {
            failConnection("service_discovery_start_failed", "discoverServices returned false")
          }
        }
        BluetoothProfile.STATE_DISCONNECTED -> {
          emitDiagnostic("gatt", "disconnected", detail = "status=$status")
          val wasPending = pendingConnectCall
          pendingConnectCall = null
          ready = false
          ioCharacteristic = null
          negotiatedMtu = null
          try { g.close() } catch (_: Throwable) {}
          if (gatt === g) gatt = null
          emitConnectionState("disconnected", connectedId, connectedName)
          wasPending?.reject("NexRing disconnected before becoming ready")
        }
      }
    }

    @SuppressLint("MissingPermission")
    override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
      if (gatt !== g) return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        failConnection("service_discovery_failed", "status=$status")
        return
      }

      emitDiagnostic("service_discovery", "complete", detail = "status=$status")
      val service = g.getService(RING_SERVICE_UUID)
      val characteristic = service?.getCharacteristic(RING_IO_UUID)
      if (service == null || characteristic == null) {
        failConnection(
          "vendor_characteristic_not_found",
          "Expected service=${RING_SERVICE_UUID} characteristic=${RING_IO_UUID}",
        )
        return
      }

      val props = characteristic.properties
      val canNotify = props and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0
      val canIndicate = props and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0
      val canWrite = props and BluetoothGattCharacteristic.PROPERTY_WRITE != 0
      val canWriteNoResponse = props and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0

      if ((!canNotify && !canIndicate) || (!canWrite && !canWriteNoResponse)) {
        failConnection(
          "vendor_characteristic_capability_mismatch",
          "66FE properties=$props require notify/indicate + write",
        )
        return
      }

      ioCharacteristic = characteristic
      emitDiagnostic(
        "characteristic",
        "ready",
        detail = "service=$RING_SERVICE_UUID characteristic=$RING_IO_UUID properties=$props",
      )
      if (!enableNotifications(g, characteristic)) {
        failConnection("notification_enable_failed", "Unable to enable 66FE notifications")
      }
    }

    override fun onDescriptorWrite(g: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      if (gatt !== g || descriptor.uuid != CCC_UUID || !pendingNotificationEnable) return
      pendingNotificationEnable = false
      emitDiagnostic("ccc", if (status == BluetoothGatt.GATT_SUCCESS) "written" else "failed", detail = "status=$status")
      if (status != BluetoothGatt.GATT_SUCCESS) {
        failConnection("notification_descriptor_failed", "status=$status")
        return
      }

      ready = true
      emitReady()
      pendingConnectCall?.resolve(
        JSObject()
          .put("ok", true)
          .put("id", connectedId)
          .put("mac", connectedId)
          .put("name", connectedName ?: "")
          .put("serviceUuid", RING_SERVICE_UUID.toString())
          .put("characteristicUuid", RING_IO_UUID.toString()),
      )
      pendingConnectCall = null
    }

    override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
      if (gatt !== g) return
      if (status == BluetoothGatt.GATT_SUCCESS) {
        negotiatedMtu = mtu
        emitDiagnostic("mtu", "changed", mtu = mtu)
        notifyListeners("mtu", JSObject().put("mtu", mtu), true)
      } else {
        emitError("mtu_change_failed", "status=$status requested/actual=$mtu")
      }
    }

    @Deprecated("Deprecated in API 33")
    override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        emitNotify(characteristic, characteristic.value ?: byteArrayOf())
      }
    }

    override fun onCharacteristicChanged(
      g: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      value: ByteArray,
    ) {
      emitNotify(characteristic, value)
    }
  }

  @SuppressLint("MissingPermission")
  private fun enableNotifications(
    targetGatt: BluetoothGatt,
    characteristic: BluetoothGattCharacteristic,
  ): Boolean {
    val props = characteristic.properties
    val canNotify = props and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0
    val canIndicate = props and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0
    if (!canNotify && !canIndicate) return false

    emitDiagnostic("notifications", "enabling")
    if (!targetGatt.setCharacteristicNotification(characteristic, true)) return false
    val descriptor = characteristic.getDescriptor(CCC_UUID) ?: return false
    val value = if (canNotify) {
      BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
    } else {
      BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
    }

    pendingNotificationEnable = true
    emitDiagnostic("ccc", "write_requested")
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      targetGatt.writeDescriptor(descriptor, value) == BluetoothStatusCodes.SUCCESS
    } else {
      @Suppress("DEPRECATION")
      run {
        descriptor.value = value
        targetGatt.writeDescriptor(descriptor)
      }
    }.also { accepted ->
      if (!accepted) pendingNotificationEnable = false
    }
  }

  @SuppressLint("MissingPermission")
  private fun disableNotifications(): Boolean {
    val targetGatt = gatt ?: return false
    val characteristic = ioCharacteristic ?: return false
    pendingNotificationEnable = false

    val localDisabled = targetGatt.setCharacteristicNotification(characteristic, false)
    val descriptor = characteristic.getDescriptor(CCC_UUID) ?: return localDisabled
    val descriptorAccepted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      targetGatt.writeDescriptor(descriptor, BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE) ==
        BluetoothStatusCodes.SUCCESS
    } else {
      @Suppress("DEPRECATION")
      run {
        descriptor.value = BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
        targetGatt.writeDescriptor(descriptor)
      }
    }
    return localDisabled && descriptorAccepted
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun requestMtu(call: PluginCall) {
    val targetGatt = gatt
    if (targetGatt == null || !ready) {
      call.reject("NexRing is not ready")
      return
    }

    val requested = (call.getInt("mtu") ?: DEFAULT_MTU).coerceIn(MIN_MTU, MAX_MTU)
    emitDiagnostic("mtu", "requesting", mtu = requested)
    try {
      if (!targetGatt.requestMtu(requested)) {
        call.reject("NexRing MTU request was rejected")
        return
      }
      call.resolve(JSObject().put("ok", true).put("requestedMtu", requested))
    } catch (t: Throwable) {
      call.reject("Unable to request NexRing MTU", t as? Exception ?: Exception(t))
    }
  }

  @PluginMethod
  fun startStreaming(call: PluginCall) {
    if (gatt == null || ioCharacteristic == null || !ready) {
      call.reject("NexRing is not ready")
      return
    }
    // The vendor ringSDK.js owns measurement commands. Native streaming means
    // the raw 66FE notification channel is live; no synthetic health data is emitted here.
    call.resolve(JSObject().put("ok", true).put("notifications", true))
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun stopStreaming(call: PluginCall) {
    if (gatt == null || ioCharacteristic == null) {
      call.resolve(JSObject().put("ok", true).put("notifications", false))
      return
    }
    try {
      val accepted = disableNotifications()
      ready = false
      call.resolve(JSObject().put("ok", accepted).put("notifications", false))
    } catch (t: Throwable) {
      call.reject("Unable to stop NexRing notifications", t as? Exception ?: Exception(t))
    }
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun write(call: PluginCall) {
    val targetGatt = gatt
    val characteristic = ioCharacteristic
    if (targetGatt == null || characteristic == null || !ready) {
      call.reject("NexRing is not ready")
      return
    }

    val payload = try {
      decodePayload(call)
    } catch (t: Throwable) {
      call.reject("Invalid NexRing write payload", t as? Exception ?: Exception(t))
      return
    }

    if (payload.isEmpty()) {
      call.reject("NexRing write payload is empty")
      return
    }
    if (payload.size > MAX_WRITE_BYTES) {
      call.reject("NexRing write payload exceeds $MAX_WRITE_BYTES bytes")
      return
    }

    val properties = characteristic.properties
    val writeType = when {
      properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0 ->
        BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0 ->
        BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
      else -> {
        call.reject("NexRing 66FE characteristic is not writable")
        return
      }
    }

    try {
      val accepted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        targetGatt.writeCharacteristic(characteristic, payload, writeType) == BluetoothStatusCodes.SUCCESS
      } else {
        @Suppress("DEPRECATION")
        run {
          characteristic.writeType = writeType
          characteristic.value = payload
          targetGatt.writeCharacteristic(characteristic)
        }
      }

      if (!accepted) {
        call.reject("NexRing GATT write was rejected")
        return
      }

      emitDiagnostic(
        stage = "write",
        status = "accepted",
        detail = "writeType=$writeType",
        length = payload.size,
        mtu = negotiatedMtu,
      )
      call.resolve(
        JSObject()
          .put("ok", true)
          .put("length", payload.size)
          .put("mtu", negotiatedMtu),
      )
    } catch (t: Throwable) {
      call.reject("Unable to write NexRing command", t as? Exception ?: Exception(t))
    }
  }

  private fun decodePayload(call: PluginCall): ByteArray {
    val array = call.getArray("bytes")
    if (array != null) {
      return ByteArray(array.length()) { index ->
        (array.getInt(index) and 0xff).toByte()
      }
    }

    val encoded = call.getString("base64")?.trim().orEmpty()
    if (encoded.isNotEmpty()) {
      return Base64.decode(encoded, Base64.DEFAULT)
    }

    return byteArrayOf()
  }

  @SuppressLint("MissingPermission")
  @PluginMethod
  fun disconnect(call: PluginCall) {
    cancelScanTimeout()
    emitDiagnostic("disconnect", "requested")
    val targetGatt = gatt
    if (targetGatt == null) {
      clearConnectionState()
      emitConnectionState("disconnected")
      call.resolve(JSObject().put("ok", true))
      return
    }

    emitConnectionState("disconnecting", connectedId, connectedName)
    try {
      targetGatt.disconnect()
      call.resolve(JSObject().put("ok", true))
    } catch (t: Throwable) {
      closeGattSilently()
      emitConnectionState("disconnected", connectedId, connectedName)
      call.reject("Unable to disconnect NexRing", t as? Exception ?: Exception(t))
    }
  }

  private fun emitNotify(characteristic: BluetoothGattCharacteristic, bytes: ByteArray) {
    if (characteristic.uuid != RING_IO_UUID || bytes.isEmpty()) return
    emitDiagnostic("notify", "received", length = bytes.size)
    val payload = JSObject()
      .put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
      .put("hex", bytes.joinToString("") { "%02x".format(Locale.US, it.toInt() and 0xff) })
      .put("length", bytes.size)
      .put("serviceUuid", characteristic.service?.uuid?.toString())
      .put("characteristicUuid", characteristic.uuid.toString())
    notifyListeners("notify", payload, true)
  }

  private fun emitReady() {
    emitDiagnostic("ready", "complete", mtu = negotiatedMtu)
    notifyListeners(
      "ready",
      JSObject()
        .put("id", connectedId)
        .put("mac", connectedId)
        .put("name", connectedName ?: "")
        .put("serviceUuid", RING_SERVICE_UUID.toString())
        .put("characteristicUuid", RING_IO_UUID.toString()),
      true,
    )
    emitConnectionState("ready", connectedId, connectedName)
  }

  private fun emitConnectionState(
    state: String,
    id: String? = connectedId,
    name: String? = connectedName,
    message: String? = null,
  ) {
    val data = JSObject()
      .put("state", state)
      .put("id", id)
      .put("mac", id)
      .put("name", name ?: "")
    if (!message.isNullOrBlank()) data.put("message", message)
    notifyListeners("connectionState", data, true)
  }

  private fun emitError(code: String, message: String) {
    emitDiagnostic("error", "failed", detail = "$code:$message")
    Log.e(TAG, "$code: $message")
    notifyListeners("error", JSObject().put("code", code).put("message", message), true)
  }

  @SuppressLint("MissingPermission")
  private fun failConnection(code: String, message: String) {
    emitError(code, message)
    emitConnectionState("error", connectedId, connectedName, "$code:$message")
    pendingConnectCall?.reject("$code: $message")
    pendingConnectCall = null
    try { gatt?.disconnect() } catch (_: Throwable) {}
    closeGattSilently()
  }

  @SuppressLint("MissingPermission")
  private fun closeGattSilently() {
    val targetGatt = gatt
    gatt = null
    try { targetGatt?.close() } catch (_: Throwable) {}
    clearConnectionState()
  }

  private fun clearConnectionState() {
    ready = false
    pendingNotificationEnable = false
    ioCharacteristic = null
    negotiatedMtu = null
    connectedId = null
    connectedName = null
  }
}

