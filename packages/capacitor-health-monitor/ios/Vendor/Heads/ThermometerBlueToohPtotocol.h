//
//  ThermometerBlueToohPtotocol.h
//  HealthDeviceCombineSDK
//
//  Created by linktoplinktop on 2017/2/13.
//  Copyright © 2017年 Linktop. All rights reserved.
//

#ifndef ThermometerBlueToohPtotocol_h
#define ThermometerBlueToohPtotocol_h


/*******************************************************
 *                                                     *
 *                     delegate                        *
 *                                                     *
 *******************************************************/
@protocol ThermometerDelegate <NSObject>
@optional
/**
 *  @discussion 获得蓝牙搜索到的设备数组，开始扫描后会调用
 *
 *  @param foundPeripherals 数组内的对象为CBPeripheral类
 **/
- (void)obtianArrayOfFoundDevice:(NSArray *)foundPeripherals;

/**
 *  @discussion 获得设备温度，连接后2秒调用一次
 *
 *  @param name        为设备名
 *         temperature 为该设备对应的温度
 *         lowBattery  为低电量标识，YES为低电量，NO为电量充足
 **/
- (void)obtianPeripheralName:(NSString *)name andTemperature:(NSNumber *)temperature andLowBattery:(BOOL)lowBattery;

/**
 *
 *  @discussion 连接后10秒未获取到温度时回调，会调用stopGetTemperature方法，要重新获取需重新连接
 *
 **/
- (void)noTemperature;

/**
 *
 *  @discussion 测试过程中长时间（获取温度时间间隔*30）未收到温度时调用，并断开连接
 *
 **/
- (void)noSignal;

/**
 *  @discussion 获得QR code，调用getTheQRCodeOfPeripheral:后回调
 *
 *  @param QR code
 **/
- (void)obtianQRCode:(NSString *)code;

/**
 *
 *  @discussion 获取QR code失败，原因可能有很多种:蓝牙未开启，设备正忙，设备已关机等
 *
 **/
- (void)getQRCodeFailed;

/**
 *
 *  @discussion 温度达到平衡状态时回调
 *
 **/
- (void)temperatureIsBalance;

/**
 *
 *  @discussion 温度达到平衡状态后数值异常回调
 *
 **/
- (void)temperatureIsAbnormal;
@end



#endif /* ThermometerBlueToohPtotocol_h */
