package com.smartsleep.sleepstaging;

import java.util.List;

public class SleepStagingNative {

    public static native SleepStagingResult analysis(List<HealthData> data);
    public static native SleepStagingResult analysisSleepData(List<SlpWakeData> slpWakeData,List<HealthData> data);
    public static native SleepStagingResult analysisSleepRing(List<HealthData> data);
    public static native SleepStagingResult analysisSleepFusion(List<SlpWakeData> slpWakeData,List<HealthData> data);
    public static native void setSampleInterval(int interval);
    public static native int getSampleInterval();

}
