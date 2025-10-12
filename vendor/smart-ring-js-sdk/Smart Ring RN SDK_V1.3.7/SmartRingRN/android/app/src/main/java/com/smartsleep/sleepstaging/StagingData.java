package com.smartsleep.sleepstaging;

import java.util.List;


public class StagingData {
    public long startTime;
    public long endTime;
    public double averageHr;
    public List<Staging> stagingList;

    @Override
    public String toString() {
        return "StagingData{" +
                "startTime=" + startTime +
                ", endTime=" + endTime +
                ", averageHr=" + averageHr +
                ", stagingList=" + stagingList +
                '}';
    }
}
