//
//  LibHealthCombine.h
//  LibHealthCombine
//
//  Created by linktoplinktop on 2017/2/8.
//  Copyright © 2017年 Linktop. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "ThermometerBlueToohPtotocol.h"
#import "SDKHealthMoniter.h"

@class LT_ThermometerSDK;
@class SDKHealthMoniter;
@class LT_iOS_CSS_SDK;

@interface LibHealthCombineSDK : NSObject



@property(nonatomic, strong, readonly) LT_ThermometerSDK * LT_ThermometerSDK; //体温计sdk
@property(nonatomic, strong, readonly) SDKHealthMoniter * LT_HealthMonitor;   //健康监测仪sdk
@property(nonatomic, strong, readonly) LT_iOS_CSS_SDK * LT_Css; //云服务

/**
 初始化实例 单例
 */
+ (LibHealthCombineSDK *)Instance;


/**
 启动体温计功能

 @param delegate 代理回调对象 NOT NULL
 @return 服务启动结果
 */
- (BOOL)StartThermeterServerceWithDelegate:(id<ThermometerDelegate>)delegate;
/**
 * 关闭体温计功能, 关闭后句柄为nil.
 */
-(void)stopThermeterServerce;
/**
 启动健康检测仪功能
 
 @param delegate 蓝牙代理 NOT NULL
 @param stateNotiBlock tcp状态 单机模式赋值nil
 @{
 @"LongLiveState" : 0/1
 @"StreamName" : String
 @"Reason" :   String
 } @return yes/no
 */
- (BOOL)StartHealthMonitorServiceWithDelegate:(id<sdkHealthMoniterDelegate>)delegate TcpStateChangeBlock: (void (^)(NSDictionary *dict)) stateNotiBlock;
/**
 * 关闭健康检测仪功能, 关闭后句柄为nil.
 */
- (void)StopHealthMonitorService;
/**

 云服务
 
 @param appKey 加密key
 @param secret 加密 secret
 @return 服务启动结果
 */
- (BOOL)StartCloudService:(NSString *)appKey AppSecret:(NSString *)secret;

/**
 * 关闭云服务功能, 关闭后句柄为nil.
 */
- (void)stopCloudService;

@end
