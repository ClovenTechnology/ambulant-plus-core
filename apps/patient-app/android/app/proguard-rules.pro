# --- Capacitor core & plugins
-keep class com.getcapacitor.** { *; }
-keep class androidx.activity.result.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
}

# --- Your native plugin package (adjust if different)
-keep class com.ambulant.patient.plugins.health.** { *; }
-keep class com.ambulant.patient.plugins.health.HealthMonitorPlugin { *; }
-keep class com.ambulant.patient.plugins.health.HealthMonitorSdkWrapper { *; }

# --- If a vendor SDK is included (AAR/JAR), keep its public API
-keep class com.duecare.** { *; }
-keep class com.healthmonitor.** { *; }

# --- Kotlin coroutines / metadata (usually safe, but keep if SDK uses reflection)
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**, kotlinx.**

# --- AndroidX SplashScreen (not strictly required, but harmless)
-keep class androidx.core.splashscreen.** { *; }

# --- BLE GATT callbacks (some vendors reflect on these)
-keep class android.bluetooth.** { *; }
