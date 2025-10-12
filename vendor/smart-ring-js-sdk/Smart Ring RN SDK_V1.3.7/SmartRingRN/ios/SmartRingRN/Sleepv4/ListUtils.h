//
//  ListUtils.h
//  sr01sdkProject
//
//  Created by 兰仲平 on 2022/8/16.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ListUtils : NSObject

+(NSMutableArray <NSMutableDictionary *>*)segmentStandardDiviation:(NSMutableArray <NSMutableDictionary *>*) data TimeMinute:(int)timeMinute;
/**
   * 将列表里的数 按照数字连续 进行拆分
   * e.g [1,2,3,5,7,8,9]->{[1,2,3],[5],[7,8,9]}
   * @param indexArr 源List
   * return List<List<Int>> 拆分后的list
   */
+(NSMutableArray <NSMutableArray <NSNumber *>* >*)splitConsecutiveNumbers:(NSMutableArray<NSNumber *> *)indexArr;

+(NSMutableArray <NSMutableDictionary *> *)calculateVariance2:(NSArray <NSMutableDictionary *> *)hrdata IntervalTime:(int)intervalTime Sd:(BOOL)sd UseInterval:(BOOL)useInterval;

@end

NS_ASSUME_NONNULL_END
