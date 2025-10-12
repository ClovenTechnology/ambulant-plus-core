cmake_minimum_required(VERSION 3.6)
add_library(sleepstaging SHARED IMPORTED)
set_target_properties(sleepstaging PROPERTIES IMPORTED_LOCATION ${CMAKE_CURRENT_SOURCE_DIR}/src/main/jniLibs/${ANDROID_ABI}/libsleepstaging.so)