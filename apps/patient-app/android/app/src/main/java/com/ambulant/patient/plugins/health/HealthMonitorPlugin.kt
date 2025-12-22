package com.ambulant.patient.plugins.health

import android.Manifest
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod   // correct import (not the annotation pkg)
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

@CapacitorPlugin(
    name = "HealthMonitor",
    permissions = [
        Permission(strings = [Manifest.permission.BLUETOOTH_CONNECT], alias = "bleConnect"),
        Permission(strings = [Manifest.permission.BLUETOOTH_SCAN], alias = "bleScan"),
        Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION], alias = "fineLocation")
    ]
)
class HealthMonitorPlugin : Plugin() {

    private lateinit var manager: HealthMonitorSdkWrapper

    override fun load() {
        manager = HealthMonitorSdkWrapper(activity.applicationContext) { event, data ->
            val payload = JSObject()
            payload.put("data", JSONObject.wrap(data))
            notifyListeners(event, payload)
        }
    }

    // Use a different name so we don't hide Plugin.requestPermissions(...)
    @PluginMethod
    fun askPermissions(call: PluginCall) {
        bridge.saveCall(call)
        requestAllPermissions(call, "permissionsCallback")
    }

    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        val scanOk = getPermissionState("bleScan") == PermissionState.GRANTED
        val connectOk = getPermissionState("bleConnect") == PermissionState.GRANTED
        val needsLocation = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
        val locationOk = if (needsLocation) {
            getPermissionState("fineLocation") == PermissionState.GRANTED
        } else {
            true
        }

        if (scanOk && connectOk && locationOk) {
            call.resolve()
        } else {
            call.reject("Required Bluetooth permissions not granted")
        }
    }

    @PluginMethod
    fun startScan(call: PluginCall) {
        manager.startScan()
        call.resolve()
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        manager.stopScan()
        call.resolve()
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val mac = call.getString("mac")
        if (mac.isNullOrBlank()) {
            call.reject("mac is required")
            return
        }
        manager.connect(mac)
        call.resolve()
    }

    @PluginMethod
    fun startMeasurements(call: PluginCall) {
        manager.startMeasurements()
        call.resolve()
    }

    @PluginMethod
    fun stopMeasurements(call: PluginCall) {
        manager.stopMeasurements()
        call.resolve()
    }
}
