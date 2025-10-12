//
//  SmartBPWrapper.h
//  BpAlgorithm
//
//  Created  on 2025/4/23.
//
    
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <Foundation/Foundation.h>
#import "BloodPressure.h"

NS_ASSUME_NONNULL_BEGIN

@protocol SmartBPWrapperDelegate <NSObject>
- (void)onPPGPeakDetectWithPeakIndex:(int)peakIndex value:(double)value;
- (void)onECGPeakDetectWithPeakIndex:(int)peakIndex value:(double)value;
@end


@interface SmartBPWrapper : RCTEventEmitter<RCTBridgeModule>


@property (nonatomic, weak) id<SmartBPWrapperDelegate> delegate;
@property (nonatomic, assign) int mPTTCount;
@property (nonatomic, assign) int ecgIndex;
@property (nonatomic, assign) int DATA_LOSS_THRESHOLD;
@property (nonatomic, assign) int DATA_SAMPLE_RATE;
@property (nonatomic, assign) int MIN_CALIBRATION_TIMES;
@property (nonatomic, assign) int PPG_DATA_SAMPLE_RATE;
@property (nonatomic, strong) NSString *mUserCalBp;
@property (nonatomic, strong) NSString *mCurrCalibrationInfo;

@property (nonatomic, strong) NSMutableArray *ppgData;
@property (nonatomic, strong) NSMutableArray *mPTTList;
@property (nonatomic, strong) NSMutableArray *mPWTTMidAvgList;
@property (nonatomic, strong) NSMutableArray *filteredPPGList;
@property (nonatomic, strong) NSMutableArray *filteredECGList;

@property (nonatomic, assign) BOOL isCalibrating;
@property (nonatomic, assign) BOOL isMeasuring;
@property (nonatomic, assign) BloodPressure* bp;





- (void)addSampleWithECG:(double)ecg PPG:(double)ppg;
- (double)getFilteredECG;
- (double)getFilteredPPG;
- (void)bpReset;
- (void)ecgRDetecte;
//- (void)enableEcgRDetect:(BOOL)enable;
- (int)statSys;
- (int)statDia;
- (int)getHR;
- (int)getRRICount;
- (void)unInit;
- (void)bpInitial;
- (NSString *)getCalibrationInfo;
- (void)setBpCalibrationInfo:(NSString *)bpCalibrationInfo;
- (NSString *)getPwttInfo;
- (BOOL)isNeedCalibrate;
- (int)requiredCalibrationTimes;
- (int)calibrationSize;

@end

NS_ASSUME_NONNULL_END
