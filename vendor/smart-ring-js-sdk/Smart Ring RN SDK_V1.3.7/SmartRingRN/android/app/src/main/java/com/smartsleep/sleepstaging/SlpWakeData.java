package com.smartsleep.sleepstaging;

public class SlpWakeData {
    public long ts;
    public int type;
    public long bedRestDuration;
    public int awakeningOrder;

    public SlpWakeData(long ts, int type, long bedRestDuration, int awakeningOrder) {
        this.ts = ts;
        this.type = type;
        this.bedRestDuration = bedRestDuration;
        this.awakeningOrder = awakeningOrder;
    }

    public long getTs() {
        return ts;
    }

    public void setTs(long ts) {
        this.ts = ts;
    }

    public int getType() {
        return type;
    }

    public void setType(int type) {
        this.type = type;
    }

    public long getBedRestDuration() {
        return bedRestDuration;
    }

    public void setBedRestDuration(long bedRestDuration) {
        this.bedRestDuration = bedRestDuration;
    }

    public int getAwakeningOrder() {
        return awakeningOrder;
    }

    public void setAwakeningOrder(int awakeningOrder) {
        this.awakeningOrder = awakeningOrder;
    }
}
