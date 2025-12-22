package com.ambulant.patient.plugins.steth

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DigitalStethoscope")
class DigitalStethoscopePlugin : Plugin() {

  // TODO: wire to your SDK classes after you unpack the zip.
  private var connectedMac: String? = null
  private var isRecording: Boolean = false

  @PluginMethod
  fun askPermissions(call: PluginCall) {
    val needed = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.ACCESS_FINE_LOCATION)
    val missing = needed.any {
      ActivityCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing) {
      bridge.activity?.let {
        ActivityCompat.requestPermissions(it, needed, 9221)
      }
    }
    val ret = JSObject().put("ok", true)
    call.resolve(ret)
  }

  @PluginMethod
  fun startScan(call: PluginCall) {
    // TODO: SDK scan start
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun stopScan(call: PluginCall) {
    // TODO: SDK scan stop
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun connect(call: PluginCall) {
    val mac = call.getString("mac")
    if (mac == null) {
      call.reject("mac is required")
      return
    }
    // TODO: SDK connect by MAC
    connectedMac = mac
    notifyStatus(connected = true, battery = null)
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun disconnect(call: PluginCall) {
    // TODO: SDK disconnect
    connectedMac = null
    notifyStatus(connected = false, battery = null)
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun startAuscultation(call: PluginCall) {
    // val site = call.getString("site")
    // val sampleRate = call.getInt("sampleRate") ?: 4000
    isRecording = true
    // TODO: start SDK audio stream; for each buffer, emitAudioFrame(...)
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun stopAuscultation(call: PluginCall) {
    isRecording = false
    // TODO: stop SDK audio stream
    call.resolve(JSObject().put("ok", true))
  }

  private fun notifyStatus(connected: Boolean, battery: Int?) {
    val data = JSObject()
      .put("type", "status")
      .put("connected", connected)
      .put("batteryPct", battery)
    notifyListeners("status", data)
  }

  /** Call this from your SDK audio callback */
  private fun emitAudioFrame(pcm16Base64: String, sampleRate: Int, channels: Int) {
    val data = JSObject()
      .put("type", "audioFrame")
      .put("pcm16Base64", pcm16Base64)
      .put("sampleRate", sampleRate)
      .put("channels", channels)
      .put("ts", System.currentTimeMillis())
    notifyListeners("audioFrame", data)
  }

  /** Optional helper for text notes */
  private fun emitNote(text: String) {
    val data = JSObject()
      .put("type", "note")
      .put("text", text)
      .put("ts", System.currentTimeMillis())
    notifyListeners("note", data)
  }
}
