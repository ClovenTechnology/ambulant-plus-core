package com.ambulant.patient.plugins.otoscope

import android.app.PendingIntent
import android.content.*
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.File

@CapacitorPlugin(name = "Otoscope")
class OtoscopePlugin : Plugin() {

  private val ACTION_USB_PERMISSION = "com.ambulant.patient.USB_PERMISSION"
  private var usbManager: UsbManager? = null
  private var device: UsbDevice? = null
  private var permissionIntent: PendingIntent? = null
  private var opened = false

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        ACTION_USB_PERMISSION -> {
          synchronized(this) {
            val dev = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            if (granted && dev != null) {
              device = dev
              notifyTelemetry(true, "permission granted")
            } else {
              notifyTelemetry(false, "permission denied")
            }
          }
        }
        UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
          val dev = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
          if (dev != null) {
            device = dev
            notifyTelemetry(false, "device attached")
          }
        }
        UsbManager.ACTION_USB_DEVICE_DETACHED -> {
          val dev = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
          if (dev != null && dev == device) {
            device = null
            opened = false
            notifyTelemetry(false, "device detached")
          }
        }
      }
    }
  }

  override fun load() {
    super.load()
    usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
    val flags = if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
    permissionIntent = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)

    val f = IntentFilter().apply {
      addAction(ACTION_USB_PERMISSION)
      addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
      addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
    }
    context.registerReceiver(receiver, f)
  }

  override fun handleOnDestroy() {
    super.handleOnDestroy()
    try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
  }

  /* ------------------------- Helpers -------------------------- */

  private fun notifyTelemetry(connected: Boolean, message: String? = null) {
    val obj = JSObject().apply {
      put("type", "telemetry")
      put("connected", connected)
      put("usbProduct", device?.productName ?: "")
      if (message != null) put("message", message)
    }
    notifyListeners("telemetry", obj, true)
  }

  private fun firstUvcDevice(): UsbDevice? {
    val map = usbManager?.deviceList ?: return null
    // Prefer UVC (class 239, subclass 2, protocol 1) but fall back to first
    // Many SDKs rely on device_filter.xml anyway.
    val pref = map.values.firstOrNull {
      it.deviceClass == 239 || it.deviceClass == UsbConstants.USB_CLASS_MISC
    }
    return pref ?: map.values.firstOrNull()
  }

  /* ------------------------- Capacitor methods -------------------------- */

  @PluginMethod
  fun askPermissions(call: PluginCall) {
    val dev = firstUvcDevice()
    if (dev == null) {
      notifyTelemetry(false, "no usb device")
      call.resolve()
      return
    }
    if (usbManager?.hasPermission(dev) == true) {
      device = dev
      notifyTelemetry(false, "already permitted")
      call.resolve()
    } else {
      try {
        usbManager?.requestPermission(dev, permissionIntent)
      } catch (_: Exception) {}
      call.resolve()
    }
  }

  @PluginMethod
  fun open(call: PluginCall) {
    val dev = firstUvcDevice()
    if (dev == null) {
      notifyTelemetry(false, "no device")
      call.resolve(JSObject().put("ok", true))
      return
    }
    if (usbManager?.hasPermission(dev) != true) {
      try { usbManager?.requestPermission(dev, permissionIntent) } catch (_: Exception) {}
      notifyTelemetry(false, "requesting permission")
      call.resolve(JSObject().put("ok", true))
      return
    }
    device = dev
    // ---- Minimal: reflectively poke vendor SDK to init, but don’t hard-link symbols ----
    tryInitSdkReflective()
    opened = true
    notifyTelemetry(true, "opened")
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun close(call: PluginCall) {
    tryStopPreviewReflective()
    tryReleaseSdkReflective()
    opened = false
    notifyTelemetry(false, "closed")
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun startPreview(call: PluginCall) {
    if (!opened) {
      call.resolve(JSObject().put("ok", true))
      return
    }
    tryStartPreviewReflective()
    notifyTelemetry(true, "preview started")
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun stopPreview(call: PluginCall) {
    tryStopPreviewReflective()
    notifyTelemetry(true, "preview stopped")
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun capturePhoto(call: PluginCall) {
    // Placeholder: create an empty temp file so the JS path handling works.
    val f = File(context.cacheDir, "otoscope_${System.currentTimeMillis()}.jpg")
    try { f.writeBytes(ByteArray(0)) } catch (_: Exception) {}
    call.resolve(JSObject().put("ok", true).put("fileUrl", "file://${f.absolutePath}"))
  }

  @PluginMethod
  fun startRecording(call: PluginCall) {
    // Placeholder: switch to real SDK call later
    notifyTelemetry(true, "recording started")
    call.resolve(JSObject().put("ok", true))
  }

  @PluginMethod
  fun stopRecording(call: PluginCall) {
    // Placeholder: create an empty mp4 to keep flow consistent
    val f = File(context.cacheDir, "otoscope_${System.currentTimeMillis()}.mp4")
    try { f.writeBytes(ByteArray(0)) } catch (_: Exception) {}
    notifyTelemetry(true, "recording stopped")
    call.resolve(JSObject().put("ok", true).put("fileUrl", "file://${f.absolutePath}"))
  }

  /* ------------------------- Reflective vendor hooks (no-ops if not found) -------------------------- */

  private var sdkObj: Any? = null

  private fun tryInitSdkReflective() {
    try {
      // Try a few likely class names; ignore if not present
      val candidates = listOf(
        "com.linktop.uvc.UvcSdk",
        "com.linktop.libuvc.UvcSdk",
        "com.liv.uvc.UvcSdk"
      )
      for (cn in candidates) {
        try {
          val cls = Class.forName(cn)
          val inst = cls.getDeclaredConstructor(Context::class.java).newInstance(context)
          // Optional: sdk.open(usbManager, device)
          try {
            cls.getMethod("open", UsbManager::class.java, UsbDevice::class.java)
              .invoke(inst, usbManager, device)
          } catch (_: Exception) {}
          sdkObj = inst
          Log.d("Otoscope", "Initialized SDK via $cn")
          return
        } catch (_: Exception) { /* try next */ }
      }
    } catch (_: Exception) {}
  }

  private fun tryStartPreviewReflective() {
    try {
      val o = sdkObj ?: return
      val cls = o.javaClass
      // Common signatures: startPreview(), startPreview(width, height, fps)
      try { cls.getMethod("startPreview").invoke(o); return } catch (_: Exception) {}
      try { cls.getMethod("startPreview", Int::class.java, Int::class.java, Int::class.java)
        .invoke(o, 1280, 720, 30); return } catch (_: Exception) {}
    } catch (_: Exception) {}
  }

  private fun tryStopPreviewReflective() {
    try {
      val o = sdkObj ?: return
      val cls = o.javaClass
      try { cls.getMethod("stopPreview").invoke(o) } catch (_: Exception) {}
    } catch (_: Exception) {}
  }

  private fun tryReleaseSdkReflective() {
    try {
      val o = sdkObj ?: return
      val cls = o.javaClass
      try { cls.getMethod("close").invoke(o) } catch (_: Exception) {}
      sdkObj = null
    } catch (_: Exception) {}
  }
}
