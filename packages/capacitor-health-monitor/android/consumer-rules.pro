# Keep Linktop / CSS classes and members (SDK uses reflection/ JNI across modules)
-keep class com.linktop.** { *; }
-keep interface com.linktop.** { *; }
-keep class com.css.** { *; }
-keep interface com.css.** { *; }

# Don’t warn if their SDK references optional bits
-dontwarn com.linktop.**
-dontwarn com.css.**

# If you see okhttp/okio warnings add:
# -dontwarn okhttp3.**
# -dontwarn okio.**
