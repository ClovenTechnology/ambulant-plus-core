package com.smartsleep.sleepstaging;

import java.util.List;

public class SleepStagingResult {
    public double averageHeartRate = 0.0;
    public double  restingHeartRate = 0.0;
    public List<StagingData> stagingList = null;

    public SleepStagingResult() {
    }

    @Override
    public String toString() {
        return "SleepStagingResult{" +
                "averageHeartRate=" + averageHeartRate +
                ", restingHeartRate=" + restingHeartRate +
                ", stagingList=" + stagingList +
                '}';
    }
}
