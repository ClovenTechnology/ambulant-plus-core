package com.smart.bp.listener

interface OnBPIDebugListener {
    fun onECGPeakDetect(peakIndex: Int, value: Double)
    fun onPPGPeakDetect(peakIndex: Int, value: Double)
}