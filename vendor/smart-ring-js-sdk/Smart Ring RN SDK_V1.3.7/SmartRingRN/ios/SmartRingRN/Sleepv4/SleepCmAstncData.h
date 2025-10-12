//
//  SleepCmAstncData.h
//  CareRingApp
//
//  Created  on 2024/12/20.
//  csXm 设备上报的睡眠数据, 辅助计算睡眠, 仅用于csXm设备
    

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SleepCmAstncData : NSObject

@property(strong, nonatomic)NSNumber *ts;// uint64_t 设备上报 睡眠时间戳
@property(strong, nonatomic)NSNumber *awake_order;// int 设备报 睡眠次序

/* type:0: sleep, 1: wake.*/
@property(strong, nonatomic)NSNumber *type;// uint8_t 设备报 类型 0/1
@property(strong, nonatomic)NSNumber *bed_rest_duration;// long 设备报 卧床时间

@end

NS_ASSUME_NONNULL_END
