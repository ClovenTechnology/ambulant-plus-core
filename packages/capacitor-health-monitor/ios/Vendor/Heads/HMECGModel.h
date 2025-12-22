//
//  ECGModel.h
//  linktop_HealthDetector
//
//  Created by xxoo on 15-3-30.
//  Copyright (c) 2015年 linktop. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "SDBManager.h"

@interface HMECGModel : NSObject

@property(copy,nonatomic)NSString *user;
@property(copy,nonatomic)NSString *family;
@property(strong,nonatomic)NSDate *testTime;//开始测试的时间
@property(strong,nonatomic)NSDate *time;//结束测试的时间
@property(assign,nonatomic)int r2rInterval;
@property(assign,nonatomic)int rrMax;
@property(assign,nonatomic)int rrMin;
@property(assign,nonatomic)int mood;//心情
@property(assign,nonatomic)int heartAge;
@property(assign,nonatomic)int hrv;//心率变异性
@property(assign,nonatomic)int br;//呼吸率
@property(assign,nonatomic)int heartRate;//心率
@property(assign,nonatomic)int smoothedWave;//画图数据

@property (nonatomic, retain) NSString * accountID;
@property (nonatomic, strong) NSNumber * dataID;
@property (nonatomic, strong) NSNumber * memberNumber;//成员编号，用于识别

@property (nonatomic, strong) NSArray *pointArray;
@property (nonatomic, strong) NSString *pointStr;

-(id)initWithID:(NSString *)AccountID memberNumber:(NSNumber *)MemberNumber;
-(id)initWithID:(NSString *)AccountID memberNumber:(NSNumber *)MemberNumber andDict:(NSDictionary *)retdic;

@end
