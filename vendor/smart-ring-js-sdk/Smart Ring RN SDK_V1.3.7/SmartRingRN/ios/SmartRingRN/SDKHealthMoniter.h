//
//  SDKHealthMoniter.h
//  SDKHealthMoniter
//
//  Created by xxoo on 15-6-15.
//  Copyright (c) 2015年 beibei. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>


@protocol sdkHealthMoniterDelegate <NSObject>

@required



/**
 *  @discussion Get ECG results
 *
 *  @param rrMax value rrMin value HRV value
 *                  mood value smoothWave LineData heartRate Value
 */
-(void)receiveECGDataRRmax:(int)rrMax;

-(void)receiveECGDataRRMin:(int)rrMin;

-(void)receiveECGDataHRV:(int)hrv;

-(void)receiveECGDataMood:(int)mood;

-(void)receiveECGDataSmoothedWave:(int)smoothedWave;

-(void)receiveECGDataHeartRate:(int)heartRate;

-(void)receiveECGDataBreathRate:(int)breathRate;

-(void)receiveECGDataFingerTouch:(BOOL)isTouch;

-(void)receiveECGDataRowData:(int)rowData;

-(void)receiveECGDataR2RInterval:(int)r2rValue;
-(void)receiveECGDataHeartAge:(int)heartAge;
-(void)receiveECGDataStress:(int)stress;


@end


#pragma mark -- interface SDKHealthMoniter

@interface SDKHealthMoniter : RCTEventEmitter<RCTBridgeModule>

//SDKHealthMoniter delegate
@property(weak, nonatomic)id sdkHealthMoniterdelegate;




///// startECG
///// @param username not null
///// @param isFemale is Female
///// @param age user age
///// @param height user height (unit:KG)
///// @param weight user weight (unit:cm)
//-(void)startECGWith:(NSString * _Nonnull)username Gender:(bool)isFemale Age:(int)age Height:(int)height Weight:(int)weight;

-(void)startECGWithDefVal;

/*!
 *  @method endECG
 *
 *  @discussion         end ECG test for device.
 *
 */
-(void)endECG;

// 传入蓝牙原始数据
-(void)decodeECGData:(NSArray * _Nonnull)recvData;

@end
