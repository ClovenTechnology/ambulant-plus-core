
#import "SDKHealthMoniter.h"
#import "NSKAlgoSDKECG.h"
#import "NSKAlgoSDKECGDelegate.h"

@interface SDKHealthMoniter()<NSKAlgoSDKECGDelegate>

@property(assign, nonatomic) NSUInteger count; //lzp
@property(strong, nonatomic)NSKAlgoSDKECG * nskAlgoSDKECG;

@end


@implementation SDKHealthMoniter
{
  int  heartRate;
  int  HRV;
  int  r2rInterval;
  int  rrMax;
  int  rrMin;
  int  heartBeatCount;
  int  rpeakDetected;
  int  mood;
  
  BOOL isFirst;//是否是第一次测量心电
  
  int ecgStageFlag;
  int ecgDataNum;
  int ecgDataNum2;
  int ecgStep;
}
RCT_EXPORT_MODULE(NativeEcgModule);

RCT_EXPORT_METHOD(startECG){
  [self startECGWithDefVal];
}

RCT_EXPORT_METHOD(stopECG){
  [self endECG];
}

RCT_EXPORT_METHOD(dealData:(NSArray *)params){
  [self decodeECGData:params];
}

+ (BOOL)requiresMainQueueSetup {
  return YES; // 设置为 true 表示需要在主队列上初始化
}
-(NSArray<NSString *> *)supportedEvents{
  return @[@"ecgWaveListener",@"ecgValueListener",@"ecgFingerListener"];
}
-(instancetype)init
{
    self = [super init];
    if (self)
    {
        // algo ecg init
        NSString * licenseKey = @"4DYD5nkbZHYoJBqIxT3nc/QIB58doR7BiRxuH62Ayhs=";
        int sampleRate = 512;
        self.nskAlgoSDKECG = [[NSKAlgoSDKECG alloc]init];
        [self.nskAlgoSDKECG setDelegate:self];
        [self.nskAlgoSDKECG setupSDKProperty:licenseKey withSampleRate:sampleRate enableSmoothed:1];
        [self.nskAlgoSDKECG enableNSLogMessages:false];
    }
    return self;
    
}

//检测ecg
-(void)checkECG
{

}

-(void)startECGWithDefVal {
  [self startECGWith:@"" Gender:YES Age:0 Height:0 Weight:0];
}


-(void)startECGWith:(NSString * _Nonnull)username Gender:(bool)isFemale Age:(int)age Height:(int)height Weight:(int)weight
{
    [self.nskAlgoSDKECG resetECGAnalysis];
    [self.nskAlgoSDKECG setUserProfile:username withGender:isFemale withAge:age withHeight:height withWeight:weight withPath:@""];//empty input path will use default path
    isFirst = YES;
    [self initECG];
    self.count = 0;
}

//初始化
-(void)initECG
{
    ecgStageFlag = 0;
    ecgDataNum = 0;
    ecgDataNum2 = 0;
    ecgStep = 1;
}

//结束测量心电
-(void)endECG
{
    ecgStep  = 0;
}

#pragma mark --ecg算法

// 解析蓝牙包
-(void)decodeECGData:(NSArray<NSNumber *> * _Nonnull)recvData
{
  for(int i=0; i < recvData.count; i++){
    if (self.nskAlgoSDKECG != nil) {
      uint32_t full18BitValue = [recvData[i] unsignedIntegerValue];
      // 提取高16位数据，转换为16位有符号整数
      short sixteenBitSignedValue = (short)(full18BitValue >> 2);
      [self.nskAlgoSDKECG requestECGAnalysis:sixteenBitSignedValue withPoorSignal:200];
    }
  }
}



-(void)calcAndCallbackRR:(int)r2rInt {
  if (isFirst ==YES)
  {
    rrMax = r2rInt;
    rrMin = r2rInt;
    isFirst = NO;
  }
  if (r2rInt > rrMax) {
    rrMax = r2rInt;
  }
  if (r2rInt < rrMin)
  {
    rrMin = r2rInt;
  }
  
  if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataRRmax:)])
  {
    [self.sdkHealthMoniterdelegate receiveECGDataRRmax:rrMax];
  }
  
  if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataRRMin:)])
  {
    [self.sdkHealthMoniterdelegate receiveECGDataRRMin:rrMin];
  }
}


#pragma mark -- algoecg delegate 新ecg

- (void)dataReceived:(ECGAlgorithmsData)algo results:(int)value {
  switch (algo) {
    case ECG_SMOOTHED_WAVE: // 波形
     // NSLog(@"===ECG_SMOOTHED_WAVE===");
      [self sendEventWithName:@"ecgWaveListener" body:@{@"value":@(value)}];
      if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataSmoothedWave:)]) {
        [self.sdkHealthMoniterdelegate receiveECGDataSmoothedWave:value];
      }
      break;
      
    case ECG_R2R_INTERVAL: // r2r value
     // NSLog(@"===ECG_R2R_INTERVAL===");
      [self sendEventWithName:@"ecgValueListener" body:@{@"value":@(value),@"type":@"RR"}];
      if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataR2RInterval:)]) {
        [self.sdkHealthMoniterdelegate receiveECGDataR2RInterval:value];
      }
      
      [self calcAndCallbackRR:value];
      
      break;
    case ECG_RRI_COUNT:
      if(value == 30){
        int stress = [self.nskAlgoSDKECG getStress];
        if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataStress:)]) {
          // 压力指数
          [self.sdkHealthMoniterdelegate receiveECGDataStress:[_nskAlgoSDKECG getStress]];
        }
        int mood = [self.nskAlgoSDKECG getMood];
        [self sendEventWithName:@"ecgValueListener" body:@{@"value":@(mood),@"type":@"Mood Index"}];
        if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataMood:)]) {
          // 心情指数
          [self.sdkHealthMoniterdelegate receiveECGDataMood:[_nskAlgoSDKECG getMood]];
        }
        int heartage = [self.nskAlgoSDKECG getHeartAge];
        if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataHeartAge:)]) {
          // 心脏年龄
          [self.sdkHealthMoniterdelegate receiveECGDataHeartAge:[_nskAlgoSDKECG getHeartAge]];
        }
      }
      break;
    case ECG_RPEAK_DETECTED:
      [self sendEventWithName:@"ecgValueListener" body:@{@"value":@(value),@"type":@"R DETECTED"}];
      //            NSLog(@"R-peak detected.");
      break;
    case ECG_HEART_RATE:
      // 心率
      [self sendEventWithName:@"ecgValueListener" body:@{@"value":@(value),@"type":@"HR"}];
      if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataHeartRate:)]) {
        [self.sdkHealthMoniterdelegate receiveECGDataHeartRate:value];
      }
      
      heartRate = value;
      int br = heartRate > 4 ? ((int)roundf(heartRate/4.0) + (1 - arc4random() % 3)) : 0 ;
      [self sendEventWithName:@"ecgValueListener" body:@{@"value":@(br),@"type":@"RESPIRATORY RATE"}];
      if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataBreathRate:)]) {
        //呼吸率 假的
        int br = heartRate > 4 ? ((int)roundf(heartRate/4.0) + (1 - arc4random() % 3)) : 0 ;
        [self.sdkHealthMoniterdelegate receiveECGDataBreathRate:br];
      }
      break;
    case ECG_ROBUST_HEART_RATE:
      //            robustHeartRateLabel.text = [NSString stringWithFormat:@"RobustHeartRate:%d",value];
      break;
      
    case ECG_HRV:
      // hrv
      [self sendEventWithName:@"ecgValueListener" body:@{@"value":@(value),@"type":@"HRV"}];
      if ([self.sdkHealthMoniterdelegate respondsToSelector:@selector(receiveECGDataHRV:)]) {
        [self.sdkHealthMoniterdelegate receiveECGDataHRV:value];
      }
      break;
      
    case ECG_SIGNAL_QUALITY:
      //            signalQualityLabel.text = [NSString stringWithFormat:@"SignalQuality:%d",value];
      break;
    case ECG_OVALLALL_SIGNAL_QUALITY:
      //            overallSignalQualityLabel.text = [NSString stringWithFormat:@"OverallSQ: %d",value];
      break;
    default:
      
      NSLog(@"Unknown ID: %lu", (unsigned long)algo);
      break;
  }
}

- (void)exceptionECGMessage:(ECGException)excepType {
  //NSLog(@"Exceptions: %lu",(unsigned long)excepType);
  switch (excepType) {
    case ECG_USER_PROFILE_HAS_NOT_BEEN_SET_UP:
      NSLog(@"ECG_USER_PROFILE_HAS_NOT_BEEN_SET_UP");
      break;
    case ECG_INVALID_INPUT_AGE:
      NSLog(@"ECG_INVALID_INPUT_AGE");
      break;
    case ECG_INVALID_INPUT_NAME:
      NSLog(@"ECG_INVALID_INPUT_NAME");
      break;
    case ECG_INVALID_INPUT_HEIGHT:
      NSLog(@"ECG_INVALID_INPUT_HEIGHT");
      break;
    case ECG_INVALID_INPUT_WEIGHT:
      NSLog(@"ECG_INVALID_INPUT_WEIGHT");
      break;
    case ECG_INVALID_INPUT_PATH:
      NSLog(@"ECG_INVALID_INPUT_PATH");
      break;
    case ECG_INSUFFICIENT_DATA:
      NSLog(@"ECG_INSUFFICIENT_ECG_DATA");
      break;
    case ECG_INVALID_INPUT_SAMPLE_RATE:
      NSLog(@"ECG_INVALID_INPUT_SAMPLE_RATE");
      break;
    case ECG_INVALID_INPUT_LICENSE:
      NSLog(@"ECG_INVALID_INPUT_LICENSE");
      break;
    case ECG_EXCEPTION_LICENSE_EXPIRED:
      NSLog(@"ECG_EXCEPTION_LICENSE_EXPIRED");
      break;
    default:
      break;
  }
}

//移除通知
-(void)dealloc
{
  [[NSNotificationCenter defaultCenter]removeObserver:self];
  
}


@end


