//
//  ThermometerSDK.h
//  ThermometerSDK
//
//  Created by linktop-sf on 15/11/19.
//  Copyright © 2015年 L-SF. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "ThermometerBlueToohPtotocol.h"

/*******************************************************
 *                                                     *
 *                Property and Method                  *
 *                                                     *
 *******************************************************/
@interface LT_ThermometerSDK : NSObject

/******************************
 *          property          *
 ******************************/

/*!
 *  @property Thermometer的代理
 *
 *  @discussion 设置代理，通过代理方法拿到相应的值
 */
@property (nonatomic, strong) id<ThermometerDelegate>delegate;

/******************************
 *           method           *
 ******************************/

/*!
 *  @method startScanning
 *
 *  @discussion  开始扫描
 */
- (void)startScanning;

/*!
 *  @method stopScanning
 *
 *  @discussion  停止扫描
 */
- (void)stopScanning;

/*!
 *  @method connectPeripheralToGetTemperature:
 *
 *  @discussion  连接设备，获取温度
 */
- (void)connectPeripheralToGetTemperature:(CBPeripheral *)peripheral;

/*!
 *  @method connectPeripheralToGetTemperature: timeInterval:
 *
 *  @discussion  连接设备，获取温度,可设置获取频率
 */
- (void)connectPeripheralToGetTemperature:(CBPeripheral *)peripheral timeInterval:(NSTimeInterval)ti;

/*!
 *  @method stopGetTemperature
 *
 *  @discussion  停止获取温度
 */
- (void)stopGetTemperature;

/*!
 *  @method getTheQRCodeOfPeripheral:
 *
 *  @discussion 调用后可在代理方法中获取该设备的QR code,在绑定该设备时需要用到QR code
 */
- (void)getTheQRCodeOfPeripheral:(CBPeripheral *)peripheral;
@end
