//
//  OxygnModel.h
//  linktop_HealthDetector
//
//  Created by xxoo on 15-3-13.
//  Copyright (c) 2015年 linktop. All rights reserved.
//

#import <Foundation/Foundation.h>


@interface HMOxygnModel : NSObject//血氧


@property(copy,nonatomic)NSString *user;
@property(copy,nonatomic)NSString *family;
@property(strong,nonatomic)NSDate *time;
@property(assign,nonatomic)float oxygn;
@property(assign,nonatomic)int heartRate;

@property (nonatomic, retain) NSString * accountID;
@property (nonatomic, strong) NSNumber * dataID;
@property (nonatomic, strong) NSNumber * memberNumber;//成员编号，用于识别


-(id)initWithID:(NSString *)AccountID memberNumber:(NSNumber *)MemberNumber;


@end
