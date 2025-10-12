//
//  SleepSourceData.h
//  CareRingApp
//
//  Created by 兰仲平 on 2023/4/27.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SleepSourceData : NSObject

@property(strong, nonatomic)NSNumber * time;    //时间戳
@property(strong, nonatomic)NSNumber * soprtTimes;// 运动计数
@property(strong, nonatomic)NSNumber * deviceModifyHeartRate ; // 心率
@property(strong, nonatomic)NSNumber * hrv;    // hrv
@property(strong, nonatomic)NSNumber * steps; // 计步

@end

NS_ASSUME_NONNULL_END
