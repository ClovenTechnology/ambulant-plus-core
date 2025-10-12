//
//  SleepStagingV2.h
//  sr01sdkProject
//
//  Created by Linktop on 2022/8/16.
//  第4版本的睡眠计算-使用 时间 心率 运动计数

#import <Foundation/Foundation.h>
#import "SleepStagingResultV2.h"
#import "ListUtils.h"
#import "SleepSourceData.h"
#import "SleepCmAstncData.h"

NS_ASSUME_NONNULL_BEGIN


@interface SleepStagingV2 : NSObject

+(NSString *)versionTag;
+(NSString *)buildDate;


/// 使用V4 的算法计算睡眠
/// @param originData 数据库数据
-(SleepStagingResultV2 *)findSleepDataByLib:(NSMutableArray <SleepSourceData *> *)originData;


// 用于 csXm设备的睡眠计算
-(SleepStagingResultV2 *)findCMSleepDataByLib:(NSMutableArray <SleepSourceData *> *)originData SlpAssistData:(NSMutableArray <SleepCmAstncData *> *)sleepAstDataArray;

//csXm数据+凌拓方式计算睡眠
-(SleepStagingResultV2 *)findCMSleepRingByLib:(NSMutableArray <SleepSourceData *> *)originData SlpAssistData:(NSMutableArray <SleepCmAstncData *> *)sleepAstDataArray;

//csXm数据+ 混合方式计算睡眠
-(SleepStagingResultV2 *)findCMSleepFusionByLib:(NSMutableArray <SleepSourceData *> *)originData SlpAssistData:(NSMutableArray <SleepCmAstncData *> *)sleepAstDataArray;

/* 测试使用 */
-(NSMutableArray<NSMutableDictionary *> *)readFile;
-(NSMutableArray<NSMutableDictionary *> *)readFileV3FileName:(NSString *)fileName;
-(NSString *)TestformatTimeStamp:(NSTimeInterval)timeInterval;
@end

NS_ASSUME_NONNULL_END
