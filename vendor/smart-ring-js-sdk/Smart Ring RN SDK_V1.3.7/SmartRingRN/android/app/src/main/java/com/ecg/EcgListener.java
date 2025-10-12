package com.ecg;
public interface EcgListener {
    
    void onDrawWave(int wave);

    void onSignalQuality(int level);

    void onECGValues(int key, int value);

    void onFingerDetection(boolean fingerDetected);
}
