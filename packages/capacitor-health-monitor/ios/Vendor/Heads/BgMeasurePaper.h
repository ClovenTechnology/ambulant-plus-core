//
//  BgMeasurePaper.h
//  HealthDeviceCombineSDK
//
//  Created by 兰仲平 on 2023/2/2.
//  Copyright © 2023 Linktop. All rights reserved.
//  单独封装 血糖试纸

#import <Foundation/Foundation.h>

extern const NSString * _Nonnull PAPER_BENE_9cc3;
extern const NSString * _Nonnull PAPER_BENE_b0f3;

typedef NS_ENUM(NSUInteger, BG_PAGER_MANUFACTUER) {
    BG_PAGER_MANUFACTUER_YICHENG = 0,   // 怡成
    BG_PAGER_MANUFACTUER_HMD,       // 阿尔及利亚垃圾
    BG_PAGER_MANUFACTUER_BENE,      // 百捷
}; // 厂家码


NS_ASSUME_NONNULL_BEGIN

@interface BgMeasurePaper : NSObject

@property(assign, nonatomic, readonly) BG_PAGER_MANUFACTUER manuCode; // 试纸厂家码



- (instancetype)initWithManufactuer:(BG_PAGER_MANUFACTUER)manuCode;

-(NSString *)manufactuerName;
-(NSArray<NSString *> *)measurePaperArray;


- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
