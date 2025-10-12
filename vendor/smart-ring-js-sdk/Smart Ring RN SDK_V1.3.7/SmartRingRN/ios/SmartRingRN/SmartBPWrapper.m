//
//  SmartBPWrapper.m
//  BpAlgorithm
//
//  Created  on 2025/4/23.
//
    

#import "SmartBPWrapper.h"
//#import "bloodpressure/BloodPressure.hpp"


@implementation SmartBPWrapper
{
    
}
+ (BOOL)requiresMainQueueSetup {
  return YES; // 设置为 true 表示需要在主队列上初始化
}
-(NSArray<NSString *> *)supportedEvents{
  return @[@"bpDataListener",@"bpWaveListener"];
}

RCT_EXPORT_MODULE(BpModule);

RCT_EXPORT_METHOD(initial){
  [self bpInitial];
}

RCT_EXPORT_METHOD(reset){
  _mPTTCount = 0;
  [self bpReset];
}

RCT_EXPORT_METHOD(ecgRDetected){
  [self ecgRDetecte];
}

RCT_EXPORT_METHOD(getHR:(RCTResponseSenderBlock)callback){
  int hr = [self getHR];
  callback(@[@(hr)]);
}

RCT_EXPORT_METHOD(getRRICount:(RCTResponseSenderBlock)callback){
  int rriCount = [self getRRICount];
  if(rriCount>_mPTTCount&&rriCount!=20){
    callback(@[@(rriCount)]);
  }
}

RCT_EXPORT_METHOD(getFilteredPPG:(RCTResponseSenderBlock)callback){
  double ppg = [self getFilteredPPG];
  callback(@[@(ppg)]);
}

RCT_EXPORT_METHOD(getCalibrationInfo:(RCTResponseSenderBlock)callback){
  NSString* calibrationInfo = [self getCalibrationInfo];
  callback(@[calibrationInfo]);
}

RCT_EXPORT_METHOD(setBPCalibrationInfo:(NSString*)bpCalibrationInfo){
   [self setBpCalibrationInfo:bpCalibrationInfo];
}

RCT_EXPORT_METHOD(getPwttInfo:(RCTResponseSenderBlock)callback){
   NSString* info = [self getPwttInfo];
   callback(@[info]);
}

RCT_EXPORT_METHOD(statSys:(RCTResponseSenderBlock)callback){
   int sys = [self statSys];
   callback(@[@(sys)]);
}

RCT_EXPORT_METHOD(statDia:(RCTResponseSenderBlock)callback){
   int dia = [self statDia];
   callback(@[@(dia)]);
}


RCT_EXPORT_METHOD(requiredCalibrationTimes:(RCTResponseSenderBlock)callback){
   int times = [self requiredCalibrationTimes];
   callback(@[@(times)]);
}

RCT_EXPORT_METHOD(addSample:(double)ecg ppg:(double)ppg){
   [self addSampleWithECG:ecg PPG:ppg];
   int rriCount=[self getRRICount];
   double filteredPpg=[self getFilteredPPG];
   [self.filteredECGList addObject:@(ecg)];
   [self.filteredPPGList addObject:@(filteredPpg)];
   NSLog(@"addSample===================%d",rriCount);
//  NSLog(@"addSample rriCount=%d,_mPTTCount=%f", rriCount, _mPTTCount);
  if(rriCount>_mPTTCount){
     _mPTTCount = rriCount;
     [self sendEventWithName:@"bpDataListener" body:@{@"rriCount":@(rriCount)}];
   }
   if([self.filteredECGList count]==self.PPG_DATA_SAMPLE_RATE){
     NSMutableArray *ppGArray = [NSMutableArray array];
        for (NSNumber *value in self.filteredPPGList) {
            [ppGArray addObject:value];
        }
     NSMutableArray *ecGArray = [NSMutableArray array];
        for (NSNumber *value in self.filteredECGList) {
            [ecGArray addObject:value];
        }   
        [self.filteredECGList removeAllObjects];
        [self.filteredPPGList removeAllObjects]; 
     [self sendEventWithName:@"bpWaveListener" body:@{@"filteredPPGList":ppGArray,@"filteredECGList":ecGArray}];   
   }
}

+ (instancetype)sharedInstance {
    static SmartBPWrapper *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[SmartBPWrapper alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _mPTTCount =0;
        _ecgIndex =0;
        _DATA_LOSS_THRESHOLD =1000;
        _DATA_SAMPLE_RATE =512;
        _MIN_CALIBRATION_TIMES =3;
        _PPG_DATA_SAMPLE_RATE =1000;
        _mUserCalBp = @"";
        _mCurrCalibrationInfo = @"";
        _ppgData = [[NSMutableArray alloc] init];
        _mPTTList = [[NSMutableArray alloc] init];
        _mPWTTMidAvgList = [[NSMutableArray alloc] init];
        _filteredPPGList = [[NSMutableArray alloc] init];
        _filteredECGList = [[NSMutableArray alloc] init];
        _isCalibrating = NO;
    }
    return self;
}

static void onPPGPeakDetect(int peakIndex, double value) {
    NSLog(@"onPPGPeakDetect %d,%f", peakIndex, value);
    [[SmartBPWrapper sharedInstance].delegate onPPGPeakDetectWithPeakIndex:peakIndex value:value];
}

static void onECGPeakDetect(int peakIndex, double value) {
    NSLog(@"onECGPeakDetect %d,%f", peakIndex, value);
    [[SmartBPWrapper sharedInstance].delegate onECGPeakDetectWithPeakIndex:peakIndex value:value];
}

- (void)addSampleWithECG:(double)ecg PPG:(double)ppg {
  NSLog(@"addSampleWithECG %f,%f", ecg, ppg);
  BloodPressure_addSample(_bp, ecg, ppg);
}

- (double)getFilteredECG {
  return BloodPressure_getFilteredECG(_bp);
}

- (double)getFilteredPPG {
  return BloodPressure_getFilteredPPG(_bp);
}

- (void)bpReset {
  BloodPressure_reset(_bp);
}

- (void)ecgRDetecte {
  BloodPressure_ecgRDetected(_bp);
}

//- (void)enableEcgRDetect:(BOOL)enable {
//    bp.enableEcgRDetect(enable);
//}

- (int)statSys {
  return BloodPressure_statSys(_bp);
}

- (int)statDia {
  return BloodPressure_statDia(_bp);
}

- (int)getHR {
    return BloodPressure_getHR(_bp);
}

- (int)getRRICount {
  return BloodPressure_getRRICount(_bp);
}

- (void)unInit {
  BloodPressure_destroy(_bp);
  _bp=NULL;
}

- (void)bpInitial {
  if(_bp == NULL){
    _bp = BloodPressure_create();
  }
//    bp.init();
  BloodPressure_setECGPeakDetectedCb(_bp, onECGPeakDetect);
  BloodPressure_setPPGPeakDetectedCb(_bp, onECGPeakDetect);
//    bp.setECGPeakDetectCb(onECGPeakDetect);
//    bp.setPPGPeakDetectCb(onPPGPeakDetect);
}

- (NSString *)getCalibrationInfo {
    return [NSString stringWithUTF8String:BloodPressure_getCalibrationInfo(_bp)];
}

- (void)setBpCalibrationInfo:(NSString *)bpCalibrationInfo {
  const char *cppStr = [bpCalibrationInfo UTF8String];
//  bp.setCalibrationInfo(cppStr);
  BloodPressure_setCalibrationInfo(_bp, cppStr);
}

- (NSString *)getPwttInfo {
    return [NSString stringWithUTF8String:BloodPressure_getPwttInfo(_bp)];
}

- (BOOL)isNeedCalibrate {
    return BloodPressure_isNeedCalibrate(_bp);
}

- (int)requiredCalibrationTimes{
    int size = [self calibrationSize];
    return _MIN_CALIBRATION_TIMES - size;
}

- (int)calibrationSize {
    NSLog(@"calibrationSize this.mCurrCalibrationInfo: %@", _mCurrCalibrationInfo);
    
    if (_mCurrCalibrationInfo != nil && [_mCurrCalibrationInfo stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]].length > 0) {
        // 使用可变整数来允许在block中修改其值
        int count = 0;
        
        // 分割字符串并过滤
        NSArray<NSString *> *items = [_mCurrCalibrationInfo componentsSeparatedByString:@";"];
        for (NSString *originalItem in items) {
            NSString *item = [originalItem stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
            if ([item length] == 0) continue;
            
            // 检查是否包含三个斜杠 '/'
            NSCountedSet *charSet = [[NSCountedSet alloc] initWithArray:@[item]];
            NSUInteger slashCount = [item componentsSeparatedByString:@"/"].count - 1;
            
            if (slashCount == 3) {
                count++;
            }
        }
        
        NSLog(@"calibrationSize count: %d", count);
        return count;
    } else {
        return 0;
    }
}

@end
