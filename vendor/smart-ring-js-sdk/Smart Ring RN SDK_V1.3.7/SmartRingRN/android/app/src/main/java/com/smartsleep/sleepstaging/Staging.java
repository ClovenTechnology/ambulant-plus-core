package com.smartsleep.sleepstaging;

public class Staging {
    public long startTime;
    public long endTime;
    public SleepStagingType stagingType;

    @Override
    public String toString() {
        return "("+stagingType+", (" + startTime +
                ", " + endTime +
                "))";
    }
}
