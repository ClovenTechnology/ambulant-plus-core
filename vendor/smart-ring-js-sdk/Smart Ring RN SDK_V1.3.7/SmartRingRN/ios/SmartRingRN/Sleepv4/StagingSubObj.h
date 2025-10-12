//
//  StagingSubObj.h
//  sr01sdkProject
//
//  Created by 兰仲平 on 2022/10/19.
//

#import <Foundation/Foundation.h>
#import "SleepStageHeader.h"
#import "StagingListObj.h"
NS_ASSUME_NONNULL_BEGIN

@interface StagingSubObj : NSObject

@property(assign, nonatomic)SleepStagingType type;
@property(strong, nonatomic)NSMutableArray<StagingListObj *> *list;

- (instancetype)initWithDict:(NSDictionary *)dict;
+ (NSDictionary *)mj_objectClassInArray;

@end

NS_ASSUME_NONNULL_END
