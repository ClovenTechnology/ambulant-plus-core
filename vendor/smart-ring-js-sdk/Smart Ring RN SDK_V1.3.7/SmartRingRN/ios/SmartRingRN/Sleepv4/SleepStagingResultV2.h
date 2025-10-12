//
//  SleepStagingResultV2.h
//  sr01sdkProject
//
//  Created by 兰仲平 on 2022/8/16.
//

#import <Foundation/Foundation.h>
#import "StagingDataV2.h"
NS_ASSUME_NONNULL_BEGIN

@interface SleepStagingResultV2 : NSObject

@property(strong, nonatomic)NSNumber *  averageHeartRate; //平均心率
@property(strong, nonatomic)NSNumber *  restingHeartRate; //静息心率

@property(strong, nonatomic) NSMutableArray <StagingDataV2 *> *stagingDataList; //StagingData = 每段睡眠

@property(strong, nonatomic)NSNumber *localrestHr; //非从睡眠内部计算出来的静息心率

- (instancetype)init:(NSNumber * _Nullable)avgHr RestHr:(NSNumber * _Nullable)restHr;

-(StagingDataV2 *)getLongestStagingData;

@end

NS_ASSUME_NONNULL_END
