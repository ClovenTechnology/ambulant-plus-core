//
//  StagingDataV2.h
//  sr01sdkProject
//
//  Created by 兰仲平 on 2022/8/16.
//

#import <Foundation/Foundation.h>
#import "StagingSubObj.h"
NS_ASSUME_NONNULL_BEGIN

@interface StagingDataV2 : NSObject

@property(assign, nonatomic)NSTimeInterval startTime; // 本段睡眠开始时间
@property(assign, nonatomic)NSTimeInterval endTime;  // 本段睡眠结束时间
@property(assign, nonatomic)double averageHr; //睡眠平均心率

// NSDictionary {@"SleepStagingType":type, @"list": 数组(内容为字典)  }
// list  字典内容 
@property(strong, nonatomic, nullable)NSMutableArray<NSMutableDictionary *> *stagingList;// 睡眠分期

@property(strong, nonatomic, nullable)NSMutableArray<StagingSubObj *> *ousideStagingList;// 外部使用 睡眠分期数据
/// 转换字典数组为对象数组给外部使用
-(void)transStagingListToOuside; // 仅V2 使用

+ (NSDictionary *)mj_objectClassInArray;


@end

NS_ASSUME_NONNULL_END
