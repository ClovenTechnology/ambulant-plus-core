package com.smartsleep.sleepstaging;

public class HealthData {
    public long ts; //time
    public int  hr; //Heart rate
    public int  hrv;// HRV
    public int  motion; // The amount of body motion data within the sampling interval
    public int  steps;// Steps

    public HealthData(long ts, int hr, int hrv, int motion, int steps) {
        this.ts = ts;
        this.hr = hr;
        this.hrv = hrv;
        this.motion = motion;
        this.steps = steps;
    }

    public long getTs() {
        return ts;
    }

    public int getHr() {
        return hr;
    }

    public int getHrv() {
        return hrv;
    }

    public int getMotion() {
        return motion;
    }

    public int getSteps() {
        return steps;
    }
}
