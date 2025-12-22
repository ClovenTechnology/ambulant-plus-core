package com.duecare.capacitor.healthmonitor

import android.app.Application
import android.util.Log
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.linktop.whealthService.MonitorDataTransmissionManager
import com.linktop.constant.Constants
import com.linktop.infs.*
import org.json.JSONObject
import java.util.*

@CapacitorPlugin(
    name = "HealthMonitor",
    permissions = [
        Permission(strings = [android.Manifest.permission.BLUETOOTH_CONNECT], alias = "blu_connect"),
        Permission(strings = [android.Manifest.permission.BLUETOOTH_SCAN], alias = "blu_scan"),
        Permission(strings = [android.Manifest.permission.ACCESS_FINE_LOCATION], alias = "loc_fine")
    ]
)
class HealthMonitorPlugin : Plugin() {
    private val TAG = "HealthMonitorPlugin"
    private var mgr: MonitorDataTransmissionManager? = null
    private var connected = false
    private var streaming = false

    @PluginMethod
    fun connect(call: PluginCall) {
        val ctx = activity?.applicationContext ?: run {
            call.reject("No context")
            return
        }
        val app = activity?.application as Application

        mgr = MonitorDataTransmissionManager.getInstance()
        mgr?.bind(MonitorDataTransmissionManager.DeviceType.HealthMonitor, object : OnBLEService.OnServiceBindListener {
            override fun onServiceBind() {
                setupCallbacks()
                notifyTelemetry(connected = false) // will flip true after connect
                call.resolve(JSObject().put("ok", true))
            }
            override fun onServiceUnbind() {}
        })
    }

    @PluginMethod
    fun startStreaming(call: PluginCall) {
        val m = mgr ?: run { call.reject("Not connected"); return }
        // ECG kick starts the multiplexed stream on most builds
        m.setOnEcgResultListener(object : OnEcgResultListener {
            override fun onDrawWave(signal: Any?) {
                // SDK can deliver single int or array; normalize to array
                val arr = when (signal) {
                    is Int -> listOf(signal)
                    is IntArray -> signal.toList()
                    is Array<*> -> signal.filterIsInstance<Int>()
                    else -> emptyList()
                }
                val data = JSObject()
                data.put("samples", JSArray(arr))
                data.put("sampleHz", 250)
                notifyListeners("ecg", data, true)
            }
            override fun onSignalQuality(p0: Int) {}
            override fun onECGValues(key: Int, value: Int) {
                if (key == Constants.ECG_KEY_HEART_RATE) {
                    val hr = JSObject().put("hr", value).put("unit", "bpm")
                    notifyListeners("heart_rate", hr, true)
                }
            }
            override fun onFingerDetection(detected: Boolean) {}
        })

        // Optional PPG via SpO2 listener
        mgr?.setOnSpO2ResultListener(object : OnSpO2ResultListener {
            override fun onSpO2Result(spo2: Int, hr: Int) {
                if (hr > 0) notifyListeners("heart_rate", JSObject().put("hr", hr).put("unit", "bpm"), true)
                if (spo2 > 0) {
                    val o = JSObject().put("spo2", spo2).put("unit", "%")
                    notifyListeners("vitals", JSObject().put("type", "spo2").put("payload", o), true)
                }
            }
            override fun onSpO2Wave(oxRaw: Int) {
                // Treat as PPG one-sample chunk @ ~25Hz (UI can rebuffer)
                notifyListeners("ppg", JSObject().put("samples", JSArray(listOf(oxRaw))).put("sampleHz", 25), true)
            }
        })

        // Begin ECG (you can add a setting to choose ECG vs SpO2)
        mgr?.startMeasure(Constants.MeasureType.ECG)
        streaming = true
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun stopStreaming(call: PluginCall) {
        mgr?.stopMeasure()
        streaming = false
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        try {
            mgr?.unbind()
            mgr = null
            connected = false
            streaming = false
            notifyTelemetry(connected = false)
        } catch (_: Throwable) { }
        call.resolve(JSObject().put("ok", true))
    }

    private fun setupCallbacks() {
        mgr?.setOnBleConnectListener(object : OnBleConnectListener {
            override fun onBleState(bleState: Int) {}
            override fun onBleDevice(device: OnBLEService.DeviceSort?) { }
            override fun onUpdateDialogBleList() {}
            override fun onBLEServiceReady() {}
            override fun onGattConnected() {
                connected = true
                notifyTelemetry(true)
            }
            override fun onGattDisconnected() {
                connected = false
                notifyTelemetry(false)
            }
        })

        mgr?.setOnBatteryListener(object : OnBatteryListener {
            override fun onBatteryInfo(state: Int, value: Double) {
                notifyListeners(
                    "telemetry",
                    JSObject()
                        .put("id", "duecare-health-monitor")
                        .put("transport", "ble")
                        .put("connected", connected)
                        .put("batteryPct", value),
                    true
                )
            }
        })

        // BP spot
        mgr?.setOnBpResultListener(object : OnBpResultListener {
            override fun onBpResult(systolic: Int, diastolic: Int, hr: Int) {
                notifyListeners("blood_pressure",
                    JSObject()
                        .put("systolic", systolic)
                        .put("diastolic", diastolic)
                        .put("unit", "mmHg"), true)
                if (hr > 0) notifyListeners("heart_rate", JSObject().put("hr", hr).put("unit", "bpm"), true)
            }
        })

        // Body temp
        mgr?.setOnBtResultListener(object : OnBtResultListener {
            override fun onBtResult(tempC: Double) {
                notifyListeners("temperature",
                    JSObject().put("celsius", tempC).put("unit", "C")
                        .put("fahrenheit", tempC * 9.0 / 5.0 + 32.0), true)
            }
        })
    }

    private fun notifyTelemetry(connected: Boolean) {
        notifyListeners(
            "telemetry",
            JSObject()
                .put("id", "duecare-health-monitor")
                .put("transport", "ble")
                .put("connected", connected),
            true
        )
    }
}
