package com.ambulant.patient.plugins.otoscope

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod

@CapacitorPlugin(name = "Otoscope")
class HdOtoscopePlugin: Plugin() {

  @PluginMethod fun askPermissions(call: com.getcapacitor.PluginCall) {
    // USB permissions are prompted via UsbManager pending intent when device attaches
    call.resolve()
  }

  @PluginMethod fun open(call: com.getcapacitor.PluginCall) {
    Log.d("Otoscope","open()")
    notifyListeners("telemetry", JSObject().put("type","telemetry").put("connected", true), true)
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod fun close(call: com.getcapacitor.PluginCall) {
    Log.d("Otoscope","close()")
    notifyListeners("telemetry", JSObject().put("type","telemetry").put("connected", false), true)
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod fun startRecording(call: com.getcapacitor.PluginCall) {
    Log.d("Otoscope","startRecording()")
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod fun stopRecording(call: com.getcapacitor.PluginCall) {
    Log.d("Otoscope","stopRecording()")
    call.resolve(JSObject().put("ok", true).put("fileUrl", ""))
  }
}
