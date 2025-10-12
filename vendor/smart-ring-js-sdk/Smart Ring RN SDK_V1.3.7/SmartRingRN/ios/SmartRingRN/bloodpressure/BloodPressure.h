//
// Created by Administrator on 2023/12/27.
//

#ifndef BloodPressure_H
#define BloodPressure_H

// 回调函数类型定义
typedef void (*PPGPeakDetectedCb)(int peakIndex, double value);
typedef void (*ECGPeakDetectedCb)(int peakIndex, double value);

// 血压信息结构体
typedef struct {
    int sys, dias, hr, pwtt;
} bp_info;

typedef struct BloodPressure BloodPressure;

// 创建和销毁函数
BloodPressure* BloodPressure_create(void);
void BloodPressure_destroy(BloodPressure* bp);


void BloodPressure_setPPGPeakDetectedCb(BloodPressure* bp, PPGPeakDetectedCb cb);
void BloodPressure_setECGPeakDetectedCb(BloodPressure* bp, ECGPeakDetectedCb cb);
void BloodPressure_reset(BloodPressure* bp);
void BloodPressure_addSample(BloodPressure* bp, double ecg, double ppg);
int BloodPressure_getRRICount(BloodPressure* bp);
int BloodPressure_statSys(BloodPressure* bp);
int BloodPressure_statDia(BloodPressure* bp);
int BloodPressure_getHR(BloodPressure* bp);
double BloodPressure_getFilteredECG(BloodPressure* bp);
double BloodPressure_getFilteredPPG(BloodPressure* bp);
void BloodPressure_ecgRDetected(BloodPressure* bp);
const char* BloodPressure_getCalibrationInfo(BloodPressure* bp);
const char* BloodPressure_getPwttInfo(BloodPressure* bp);
void BloodPressure_setCalibrationInfo(BloodPressure* bp, const char* c_info);
int BloodPressure_isNeedCalibrate(BloodPressure* bp);


#endif //BloodPressure_H
