package com.ambulant.patient.plugins.health

import android.bluetooth.BluetoothDevice
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.linktop.DeviceType
import com.linktop.MonitorDataTransmission.OnServiceBindListener
import com.linktop.MonitorDataTransmissionManager
import com.linktop.infs.OnBatteryListener
import com.linktop.infs.OnBleConnectListener
import com.linktop.infs.OnBpDataListener
import com.linktop.infs.OnBpResultListener
import com.linktop.infs.OnBtResultListener
import com.linktop.infs.OnEcgResultListener
import com.linktop.infs.OnSpO2ResultListener
import com.linktop.whealthService.MeasureType
import com.linktop.whealthService.OnBLEService

class HealthMonitorSdkWrapper(
    private val context: Context,
    private val emit: (event: String, data: Any?) -> Unit
) {
    private val manager: MonitorDataTransmissionManager = MonitorDataTransmissionManager.getInstance()
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var bound = false

    @Volatile
    private var pendingScan = false

    private fun send(event: String, data: Map<String, Any?> = emptyMap()) {
        main.post { emit(event, data) }
    }

    private fun safeRun(label: String, block: () -> Unit) {
        try {
            block()
        } catch (t: Throwable) {
            send(
                "error",
                mapOf(
                    "source" to "linktop",
                    "stage" to label,
                    "message" to (t.message ?: t.javaClass.name),
                ),
            )
        }
    }

    private fun ensureBound(afterBind: (() -> Unit)? = null) {
        if (bound) {
            afterBind?.invoke()
            return
        }

        safeRun("bind") {
            manager.bind(DeviceType.HealthMonitor, context, object : OnServiceBindListener {
                override fun onServiceBind() {
                    bound = true
                    attachListeners()
                    send("status", mapOf("source" to "linktop", "bound" to true))

                    if (pendingScan) {
                        pendingScan = false
                        startScan()
                    }

                    afterBind?.invoke()
                }

                override fun onServiceUnbind() {
                    bound = false
                    send("status", mapOf("source" to "linktop", "bound" to false))
                }

                override fun onSDKThrowable(throwable: Throwable?) {
                    send(
                        "error",
                        mapOf(
                            "source" to "linktop",
                            "stage" to "sdk",
                            "message" to (throwable?.message ?: "sdk_error"),
                        ),
                    )
                }
            })
        }
    }

    private fun attachListeners() {
        safeRun("attachListeners") {
            manager.setOnBleConnectListener(object : OnBleConnectListener {
                override fun onBLENoSupported() {
                    send("error", mapOf("source" to "linktop", "stage" to "ble", "message" to "ble_not_supported"))
                }

                override fun onOpenBLE() {
                    send("status", mapOf("source" to "linktop", "bleOpenRequired" to true))
                }

                override fun onBleState(state: Int) {
                    send(
                        "telemetry",
                        mapOf(
                            "source" to "linktop",
                            "connected" to manager.isConnected,
                            "bleState" to state,
                            "batteryPct" to manager.batteryValue,
                            "charging" to manager.isCharging,
                        ),
                    )
                }

                override fun onUpdateDialogBleList() {
                    emitKnownDevices()
                }
            })

            manager.setOnBatteryListener(object : OnBatteryListener {
                override fun onBatteryCharging() {
                    send("telemetry", mapOf("source" to "linktop", "charging" to true))
                }

                override fun onBatteryQuery(value: Int) {
                    send("telemetry", mapOf("source" to "linktop", "batteryPct" to value))
                }

                override fun onBatteryFull() {
                    send("telemetry", mapOf("source" to "linktop", "batteryPct" to 100, "charging" to false))
                }
            })

            manager.setOnBpResultListener(object : OnBpResultListener {
                override fun onBpResult(systolicPressure: Int, diastolicPressure: Int, heartRate: Int) {
                    send(
                        "blood_pressure",
                        mapOf(
                            "source" to "linktop",
                            "systolic" to systolicPressure,
                            "diastolic" to diastolicPressure,
                            "heartRate" to heartRate,
                            "unit" to "mmHg",
                            "ts" to System.currentTimeMillis(),
                        ),
                    )
                }

                override fun onBpResultError() {
                    send("measurementError", mapOf("source" to "linktop", "type" to "blood_pressure", "message" to "bp_result_error"))
                }

                override fun onLeakError(error: Int) {
                    send("measurementError", mapOf("source" to "linktop", "type" to "blood_pressure", "message" to "bp_leak_error", "code" to error))
                }
            })

            manager.setOnBpDataListener(object : OnBpDataListener {
                override fun onRcvPressure(pressure: Int) {
                    send("blood_pressure_progress", mapOf("source" to "linktop", "pressure" to pressure, "unit" to "mmHg"))
                }

                override fun onFIRAvgFilter(resultData: com.linktop.constant.ResultData?, isPulse: Boolean) {
                    send("blood_pressure_wave", mapOf("source" to "linktop", "pulseDetected" to isPulse))
                }
            })

            manager.setOnSpO2ResultListener(object : OnSpO2ResultListener {
                override fun onSpO2Result(spo2: Int, hr: Int) {
                    send(
                        "spo2",
                        mapOf(
                            "source" to "linktop",
                            "spo2" to spo2,
                            "pulse" to hr,
                            "unit" to "%",
                            "ts" to System.currentTimeMillis(),
                        ),
                    )
                }

                override fun onSpO2Wave(value: Int) {
                    send("ppg", mapOf("source" to "linktop", "value" to value, "ts" to System.currentTimeMillis()))
                }

                override fun onSpO2End() {
                    send("measurementEnd", mapOf("source" to "linktop", "type" to "spo2"))
                }
            })

            manager.setOnBtResultListener(object : OnBtResultListener {
                override fun onBtResult(tempValue: Double) {
                    send(
                        "temperature",
                        mapOf(
                            "source" to "linktop",
                            "celsius" to tempValue,
                            "unit" to "C",
                            "ts" to System.currentTimeMillis(),
                        ),
                    )
                }
            })

            manager.setOnEcgResultListener(object : OnEcgResultListener {
                override fun onFingerDetection(detected: Boolean) {
                    send("ecgFinger", mapOf("source" to "linktop", "detected" to detected))
                }

                override fun onDrawWave(data: Any?) {
                    val payload: Any? = when (data) {
                        is IntArray -> data.toList()
                        is ShortArray -> data.toList()
                        is ByteArray -> data.map { it.toInt() }
                        is Array<*> -> data.toList()
                        else -> data
                    }

                    send(
                        "ecg",
                        mapOf(
                            "source" to "linktop",
                            "samples" to payload,
                            "sampleHz" to 250,
                            "ts" to System.currentTimeMillis(),
                        ),
                    )
                }

                override fun onSignalQuality(quality: Int) {
                    send("ecgSignalQuality", mapOf("source" to "linktop", "quality" to quality))
                }

                override fun onECGValues(key: Int, value: Int) {
                    send("ecgValue", mapOf("source" to "linktop", "key" to key, "value" to value))
                }
            })
        }
    }

    private fun emitKnownDevices() {
        safeRun("emitKnownDevices") {
            val list = manager.deviceList ?: emptyList<OnBLEService.DeviceSort>()

            for (item in list) {
                val device: BluetoothDevice? = item.bleDevice
                send(
                    "scanResult",
                    mapOf(
                        "source" to "linktop",
                        "name" to (device?.name ?: ""),
                        "mac" to (device?.address ?: ""),
                        "rssi" to item.rssi,
                    ),
                )
            }
        }
    }

    fun startScan() {
        pendingScan = true

        ensureBound {
            safeRun("startScan") {
                pendingScan = false
                manager.autoScan(true)
                emitKnownDevices()
                send("status", mapOf("source" to "linktop", "scanning" to true))
            }
        }
    }

    fun stopScan() {
        safeRun("stopScan") {
            pendingScan = false
            if (bound) {
                manager.autoScan(false)
                manager.scan(false)
            }
            send("status", mapOf("source" to "linktop", "scanning" to false))
        }
    }

    fun connect(mac: String) {
        ensureBound {
            safeRun("connect") {
                val wanted = mac.trim()
                val match = (manager.deviceList ?: emptyList<OnBLEService.DeviceSort>())
                    .firstOrNull { it.bleDevice?.address.equals(wanted, ignoreCase = true) }
                    ?.bleDevice

                if (match == null) {
                    send(
                        "error",
                        mapOf(
                            "source" to "linktop",
                            "stage" to "connect",
                            "message" to "device_not_found_in_scan_list",
                            "mac" to wanted,
                        ),
                    )
                    return@safeRun
                }

                manager.connectToBle(match)
                send("status", mapOf("source" to "linktop", "connecting" to true, "mac" to wanted))
            }
        }
    }

    fun startMeasurement(type: String?) {
        ensureBound {
            safeRun("startMeasurement") {
                val measureType = when ((type ?: "spo2").trim().lowercase()) {
                    "bp", "blood_pressure", "blood-pressure" -> MeasureType.BP
                    "temp", "temperature", "bt" -> MeasureType.BT
                    "ecg" -> MeasureType.ECG
                    "spo2", "oxygen", "oxygen_saturation" -> MeasureType.SPO2
                    else -> MeasureType.SPO2
                }

                manager.startMeasure(measureType)
                send(
                    "measurementStart",
                    mapOf(
                        "source" to "linktop",
                        "type" to measureType,
                        "connected" to manager.isConnected,
                    ),
                )
            }
        }
    }

    fun startMeasurements() {
        startMeasurement("spo2")
    }

    fun stopMeasurements() {
        safeRun("stopMeasurements") {
            if (bound) manager.stopMeasure()
            send("measurementEnd", mapOf("source" to "linktop"))
        }
    }

    fun disconnect() {
        safeRun("disconnect") {
            if (bound) {
                manager.stopMeasure()
                manager.disConnectBle()
                manager.unBind()
            }
            bound = false
            send("telemetry", mapOf("source" to "linktop", "connected" to false))
        }
    }
}
