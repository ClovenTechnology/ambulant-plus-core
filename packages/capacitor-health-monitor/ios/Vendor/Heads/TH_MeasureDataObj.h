//
//  UserTemp.h
//  test6
//
//  Created by linktop-sf on 14/11/11.
//  Copyright (c) 2014年 linktop-sf. All rights reserved.
//  体温计数据类

#import <Foundation/Foundation.h>


@interface TH_MeasureDataObj : NSObject

@property (strong, nonatomic) NSString *uid;        //用户id
@property (strong, nonatomic) NSString *eqid;       //设备id
@property (strong, nonatomic) NSDate *date;         //测量日期
@property (assign, nonatomic) float temp;           //测量温度 摄氏度
@property (assign, nonatomic) float showTemp;       //补偿测量温度 摄氏度



@end
