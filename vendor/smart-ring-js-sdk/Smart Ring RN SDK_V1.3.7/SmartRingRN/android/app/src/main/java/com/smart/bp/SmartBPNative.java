package com.smart.bp;



public class SmartBPNative {

    static {
        System.loadLibrary("smartbp");
    }

    /**
     * init  use default parameters
     */
    public static native void unInit();

    /**
     * 初始化
     */
    public static native void initial();


    // public static void setOnBPIDebugListener(OnBPIDebugListener listener) {
    //     mBPIDebugListener = listener;
    // }

    public static void onECGPeakDetect(int peakIndex, double value) {
        // if (mBPIDebugListener != null)
        //     mBPIDebugListener.onECGPeakDetect(peakIndex, value);
    }

    public static void onPPGPeakDetect(int peakIndex, double value) {
        // if (mBPIDebugListener != null)
        //     mBPIDebugListener.onPPGPeakDetect(peakIndex, value);
    }

    public static native void addSample(double ecg, double ppg);

    public static native double getFilteredECG();

    public static native double getFilteredPPG();

    public static native void reset();

    /**
     * 外部Nsk ecg算法，检测到R波通知
     */
    public static native void ecgRDetected();


    /**
     * 收缩压
     * @return
     */
    public static native int statSys();

    /**
     * 舒张压
     * @return
     */
    public static native int statDia();

    /**
     * 心率
     * @return
     */
    public static native int getHR();

    /**
     * PWTT 数据量
     * @return
     */
    public static native int getRRICount();

    /**
     * 进行血压校准后，当getRRICount >= 20个的时候，通过该方法获取校准信息，应用层保存: 高压/低压/HR/校准信息
     * @return
     */
    public static native String getCalibrationInfo();

    /**
     * 设置血压校准信息,至少要有3组校准数据
     * @param bpCalibrationInfo 血压校准信息: 高压/低压/HR/校准信息;高压/低压/HR/校准信息;。。。。
     */
    public static native void setBPCalibrationInfo(String bpCalibrationInfo);


    /**
     * 获取PWTT 调试信息
     */
    public static native String getPwttInfo();

    /**
     * 血压是否需要校准
     * 测量结束时判断，如果为true，提示用户需要增加校准血压
     * @return
     */
    public static native boolean isNeedCalibrate();
}
