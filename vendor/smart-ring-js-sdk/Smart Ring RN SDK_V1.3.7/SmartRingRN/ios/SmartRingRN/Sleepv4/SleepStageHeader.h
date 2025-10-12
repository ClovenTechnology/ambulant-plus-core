//
//  SleepStageHeader.h
//  sr01sdkProject
//
//  Created by 兰仲平 on 2022/10/19.
//

#ifndef SleepStageHeader_h
#define SleepStageHeader_h

typedef NS_ENUM(NSUInteger, SleepStagingType) {
    NONE,  // 无睡眠
    WAKE,  // 醒来
    NREM1, // 浅度
    NREM2, // 中度
    NREM3, // 深度
    REM,   // REM
    NAP,   // 打盹小睡
}; // 睡眠类型分期

#endif /* SleepStageHeader_h */
