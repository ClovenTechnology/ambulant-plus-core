package com.ambulant.patient.plugins.health

import android.content.Context

class HealthMonitorSdkWrapper(
    private val context: Context,
    private val emit: (event: String, data: Any?) -> Unit
) {
    // TODO: Replace these with real calls once we confirm the classes/methods inside the AARs.

    fun startScan() {
        // sdk.startScan { device -> emit("scanResult", mapOf("name" to device.name, "mac" to device.mac)) }
    }

    fun stopScan() {
        // sdk.stopScan()
    }

    fun connect(mac: String) {
        // sdk.connect(mac) { ok -> emit("connected", mapOf("mac" to mac, "ok" to ok)) }
    }

    fun startMeasurements() {
        // emit("ecg", mapOf("samples" to ecgSamples, "fs" to 250))
        // emit("ppg", mapOf("samples" to ppgSamples, "fs" to 100))
        // emit("hr", 72)
    }

    fun stopMeasurements() {
        // sdk.stop()
    }
}
