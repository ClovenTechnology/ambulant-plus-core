package com.ambulant.patient.plugins.ring

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.getcapacitor.PluginMethod

@CapacitorPlugin(
  name = "NexRing",
  permissions = [
    Permission(strings = arrayOf(android.Manifest.permission.BLUETOOTH_CONNECT), alias = "btConnect"),
    Permission(strings = arrayOf(android.Manifest.permission.BLUETOOTH_SCAN), alias = "btScan"),
  ]
)
class NexRingPlugin: Plugin() {

  @PluginMethod
  fun askPermissions(call: com.getcapacitor.PluginCall) {
    requestAllPermissions(object: PermissionCallback {
      override fun onPermissionResult(result: com.getcapacitor.PermissionState) {
        call.resolve()
      }
    })
  }

  @PluginMethod fun startScan(call: com.getcapacitor.PluginCall) { Log.d("NexRing","startScan()"); call.resolve() }
  @PluginMethod fun stopScan(call: com.getcapacitor.PluginCall) { Log.d("NexRing","stopScan()"); call.resolve() }

  @PluginMethod
  fun connect(call: com.getcapacitor.PluginCall) {
    val mac = call.getString("mac")
    val name = call.getString("name")
    val patientId = call.getString("patientId")
    Log.d("NexRing","connect mac=$mac name=$name patient=$patientId")
    // TODO: integrate Smart Ring SDK and connect by MAC/name
    val ret = JSObject(); ret.put("ok", true); call.resolve(ret)
  }

  @PluginMethod fun startStreaming(call: com.getcapacitor.PluginCall) { Log.d("NexRing","startStreaming()"); call.resolve(JSObject().put("ok", true)) }
  @PluginMethod fun stopStreaming(call: com.getcapacitor.PluginCall) { Log.d("NexRing","stopStreaming()"); call.resolve(JSObject().put("ok", true)) }
  @PluginMethod fun disconnect(call: com.getcapacitor.PluginCall) { Log.d("NexRing","disconnect()"); call.resolve(JSObject().put("ok", true)) }

  // helpers to emit events (wire these once SDK is integrated)
  private fun emit(event: String, data: JSObject) {
    notifyListeners(event, data, true)
  }
}
