//
//  SDKHealthMoniter.h
//  SDKHealthMoniter
//
//  Created by xxoo on 15-6-15.
//  Copyright (c) 2015年 beibei. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "LT_iOS_CSS_SDK.h"

@class BgMeasurePaper;

typedef NS_ENUM(NSUInteger, MSGTYPE) {
    MSGTYPE_PAPERISREADY,
    MSGTYPE_PAPERISUSED,
    MSGTYPE_BLOODINDETECTED,
    MSGTYPE_TIMEOUT,
    MSGTYPE_BLOODDETECTEDCOMPLATED,
    MSGTYPE_PAPEROUT,
    MSGTYPE_PAPERIN, //试纸插入
    MSGTYPE_PAPER_NOT_IN, //试纸未插入
    MSGTYPE_ABOUT_MODULM = 0X08,// about device's glucose modulm type
    MSGTYPE_DEVICE_ERROR,  // device error,
    
    MSGTYPE__INIT = 0xef,  //初始状态
    MSGTYPE__OTHER_ERROR,

};

typedef NS_ENUM(NSUInteger, BG_MODULM_TYPE) {
    BG_MODULM_TYPE_NO = 0X00,
    BG_MODULM_TYPE_SINGLE = 0X01,  // single way glucose
    BG_MODULM_TYPE_DOUBLE = 0X02,  // double way glucose

};

typedef NS_ENUM(NSUInteger, BATTERYSTATE) {
    BATTERYSTATE_NORMAL = 0,  //正常
    BATTERYSTATE_CHARGING,   //充电中
    BATTERYSTATE_CHARGEFULL, //充满电
};

typedef NS_ENUM(NSUInteger, BPAbnornalType) {
    
    BPAbnornalTypeAirLeak = 1,  //漏气
    BPAbnornalTypeNoisy = 2,   //环境不安静
    BPAbnornalTypeUnknow = 0xff, //未知错误
};  //血压异常类型

@protocol sdkHealthMoniterDelegate <NSObject>

@required

/**
 * @discussion Get battery results
 
 * @param sate  is battery charging
 * @param value power value
 */
-(void)receiveBatteryData:(BATTERYSTATE)state BatteryValue:(double)value;
/**
 *  @discussion Get temperature results
 *
 *  @param temperature temperature value
 */
-(void)receiveThermometerData:(double)temperature;


/**
 *  @discussion  Get Oximetry results
 *
 *  @param Oximetry Oximetry value
 *  @param heartRate heartRate value
 */
-(void)receiveOximetryData:(double)oxy andHeartRate:(int)heartRate;

/**
 *   @discussion  Get Oximetry wave data
 *
 *   @param oxyWave 单个点的值
 */
-(void)receiveOximetryWave:(double)oxyWave;

/**
*   @discussion  oximetry measure did stop call back
*/
-(void)didStopOximetryMeasure;

/// Manufacturer verification callback
/// @param isSucc YES = Validation succeeded
///               NO=Validation failed, device will disconnect ble after few seconds.
-(void)receiveManufaterVerifyRes:(BOOL)isSucc;

/**
 *  @discussion Get BloodPressure results
 *
 *  @param BloodPressure Systolic_pressure value Diastolic_pressure value
 *          Heart_beat value
 */
-(void)receiveBloodPressure:(int)Systolic_pressure andDiastolic_pressure:(int)Diastolic_pressure andHeart_beat:(int)Heart_beat;

/**
 *  @discussion
 *
 *  @param msgtype msgType ENUM
 *  @param row     if row!=nil , according to this param ,invoke method getBloodSugarInRow in this object(SDKHealthMoniter) to transform blood sugar
 */
-(void) receiveBloodSugar:(MSGTYPE) msgtype andRow:(NSNumber*) row;



/**
 *  @discussion Get ECG results
 *
 *  @param ECGData rrMax value rrMin value HRV value
 *                  mood value smoothWave LineData heartRate Value
 */
-(void)receiveECGDataRRmax:(int)rrMax;

-(void)receiveECGDataRRMin:(int)rrMin;

-(void)receiveECGDataHRV:(int)hrv;

-(void)receiveECGDataMood:(int)mood;

-(void)receiveECGDataSmoothedWave:(int)smoothedWave;

-(void)receiveECGDataHeartRate:(int)heartRate;

-(void)receiveECGDataBreathRate:(int)breathRate;


/// finger detect call back
/// @param isTouch YES = finger touched device
-(void)receiveECGDataFingerTouch:(BOOL)isTouch;

/// call back ecg row data
/// @param rowData ecg row data
-(void)receiveECGDataRowData:(int)rowData;

-(void)receiveECGDataR2RInterval:(int)r2rValue;
-(void)receiveECGDataHeartAge:(int)heartAge;
-(void)receiveECGDataStress:(int)stress;


/*!
 *  @method didScanedPeripherals:(NSMutableArray  *)foundPeripherals
 *
 *  @param foundPeripherals           A <code>foundPeripherals</code> object.
 *
 *  @discussion                 This method is invoked while scanning, upon the discovery
 *
 */
- (void) didScanedPeripherals:(NSMutableArray  *)foundPeripherals;





/*!
 *  @method didConnectPeripheral:(CBPeripheral *)peripheral
 *
 *  @param peripheral   The <code>CBPeripheral</code> that has connected.
 *
 *  @discussion         This method is invoked when a connection initiated by @link UartLib:ConnectPeripheral: @/link has succeeded.
 *
 */
- (void) didConnectPeripheral:(CBPeripheral *)peripheral;




/*!
 *  @method disconnectPeripheral:(CBPeripheral *)peripheral
 *
 *  @param peripheral   The <code>CBPeripheral</code> that has connected.
 *
 *  @discussion         This method is invoked when a disconnection initiated by @link UartLib:ConnectPeripheral: @/link has disconnect.
 *
 */
- (void)disconnectPeripheral:(CBPeripheral *)peripheral;

/*!
 *  @method didPeripheralServiceReady:(CBPeripheral *)peripheral
 *
 *  @param peripheral   The <code>CBPeripheral</code> that has connected.
 *
 *  @discussion         This method is invoked when a connected peripheral initialized the service succeeded.
 *
 */
- (void) didBluetoothServiceReady:(CBPeripheral *)peripheral;


/// device battery service ready
/// @param peripheral ble device
- (void) didBluetoothBatteryServiceReady:(CBPeripheral *)peripheral;


@optional
/*!
 *  @method blueToothAbnormalDisconnect
 *
 
 *
 *  @discussion         This method is invoked when blueTooth
 *  abnormal dicconnect
 */
-(void)blueToothAbnormalDisconnect;


/*!
 *  @method bloodPressureAbnormal
 *
 *  @param message   The <code>str</code> that abnormal message.
 *
 *  @discussion         This method is invoked when bloodPressure
 *  abnormal dicconnect
 */
-(void)bloodPressureAbnormal:(NSString *)message;

/*!
 *  @method bloodPressureAbnormalWithType  avaliable V2.4
 *
 *  @param type BPAbnornalType
 *
 *  @discussion         This method is invoked when bloodPressure
 *  abnormal dicconnect
 */
-(void)bloodPressureAbnormalWithType:(BPAbnornalType)type;


/// debug only
/// @param bpValue 
-(void)bloodPressureDebugPressure:(int)bpValue;



/// debug only
/// @param isEnd
/// @param array
-(void)bloodPressureDebugFilterData:(BOOL)isEnd Array:(NSMutableArray<NSNumber *> *)array;


/*!
 *  @method softVersion  软件版本
 *
 *  @param softversion   software version in device
 */
- (void)softVersion:(NSString*) softversion;



/*!
 *  @method hardVersion  硬件版本
 *
 *  @param hardversion  hardware version
 *
 */
- (void)hardVersion:(NSString*) hardversion;

/*!
 *  @method devicePidAndKey  获取设备id 和 安全码
 *
 *  @param pid 设备id
 *  @param key 安全码
 *
 */
- (void)devicePidAndKey:(NSString *)pid Key:(NSString *)key;
@end


#pragma mark -- interface SDKHealthMoniter

@interface SDKHealthMoniter : NSObject

//SDKHealthMoniter delegate
@property(weak, nonatomic)id<sdkHealthMoniterDelegate>sdkHealthMoniterdelegate;
@property(copy, nonatomic) void (^stateNotiBlock)(NSDictionary *dict); //虚拟sdk tcp状态通知
@property(assign, nonatomic, readonly)BOOL isConnected;  // is already connect one device
@property(assign, nonatomic, readonly)BATTERYSTATE batteryState; // 电池状态
@property(assign, nonatomic, readonly)float batteryLevel; // 电量

-(CBPeripheral *)currentConnectedPerphel;
/*!
 *  @method startToGetBattery
 *
 *  @discussion         send commond to device and wait for infomation that contain battery value.
 *
 */
-(void)startToGetBattery;
/*!
 *  @method startToGetPidAndKey
 *  start file syschronize service
 *
 *  @discussion         send commond to device and wait for infomation that contain pid and key.
 *
 */

-(void)startToGetPidAndKey;
/*!
 *  @method startThermometerTest
 *
 *  @discussion         Start temperature test for device.
 *
 */
-(void)startThermometerTest;



/*!
 *  @method endThermometerTest
 *
 *  @discussion         end temperature test for device.
 *
 */
-(void)endThermometerTest;


/*!
 *  @method startOximetryTest
 *
 *  @discussion         Start Oximetry test for device.
 *
 */
-(void)startOximetryTest;


/*!
 *  @method endOximetryTest
 *
 *  @discussion         end Oximetry test for device.
 *
 */
-(void)endOximetryTest;



/*!
 *  @method startBloodPressure
 *
 *  @discussion         Start BloodPressure test for device. Use for Arm cuff.
 *
 */
-(void)startBloodPressure;

/*!
 *  @method startBloodPressure
 *  @param isArmType YES = Arm cuff,  NO = Wrist cuff
 *  @discussion         Start BloodPressure test for device.
 *
 */
-(void)startBloodPressure:(BOOL)isArmType;

/*!
 *  @method endBloodPressure
 *
 *  @discussion         end BloodPressure test for device.
 *
 */
-(void)endBloodPressure;



/// startECG
/// @param username not null
/// @param isFemale is Female
/// @param age user age
/// @param height user height (unit:KG)
/// @param weight user weight (unit:cm)
-(void)startECGWith:(NSString * _Nonnull)username Gender:(bool)isFemale Age:(int)age Height:(int)height Weight:(int)weight;


/*!
 *  @method endECG
 *
 *  @discussion         end ECG test for device.
 *
 */
-(void)endECG;


/*!
 *  @method startBloodSugar
 *
 *  @discussion         start BloodSugar test for device.
 *
 */
-(void)startBloodSugar:(NSString *_Nullable)paperType MeasurePaperObj:(BgMeasurePaper *)measurePaperObj;


/*!
 *  @method endBloodSugar
 *
 *  @discussion         end  BloodSugar test for device.
 *
 */
-(void) endBloodSugar;

/// Send Manufacturer Verification Instructions
-(void)sendManufacterVeryCmd;

/// current connected device's glucose modulm type
-(BG_MODULM_TYPE)currentGlucoseModuleTyle;

/*!
 *  @method getBloodSugarInRow
 *
 *  @discussion         according to paper and receiveBloodSugar row  to get blood sugar
 *
 */
-(double) getBloodSugarInRow:(int) row andPaperType:(NSString*) paperType;

/*!
 *  @method getAllPaperType
 *
 *  @discussion     getAllPaperType in database.
 *
 */
-(NSArray*) getAllPaperType;



/**
 V2.9 add
 notify sdk that outside will connect blk device
 
 @param cbCentral CBCentralManager
 @return is successful
 */
- (BOOL)scanStartWithCbCbcentral:(CBCentralManager *)cbCentral;

/*!
 *  @method scanStart
 *
 *  @discussion         Start scanning for peripherals.
 *
 */
-(void)scanStart;




/*!
 *  @method scanStop
 *
 *  @discussion         Stops scanning for peripherals.
 *
 */
-(void)scanStop;



/*!
 *  @method connectPeripheral:(CBPeripheral*)peripheral
 *
 *  @param peripheral   The <code>CBPeripheral</code> to be connected.
 *
 *  @discussion         Initiates a connection to <i>peripheral</i>. Connection attempts never time out and, depending on the outcome, will result in a call to either @link UartLib:didConnectPeripheral: @/link or
 @link UartLib:didDisconnectPeripheral:error: @/link.
 *                      Pending attempts are cancelled automatically upon deallocation of <i>peripheral</i>, and explicitly via @link cancelPeripheralConnection @/link.
 *
 *
 */
-(void)connectBlueTooth:(CBPeripheral*)peripheral;


/*!
 *  @method disconnectPeripheral:(CBPeripheral*)peripheral
 *
 *  @param peripheral   A <code>CBPeripheral</code>.
 *
 *  @discussion         Cancels an active or pending connection to <i>peripheral</i>. Note that this is non-blocking, and any <code>CBPeripheral</code>
 *                      commands that are still pending to <i>peripheral</i> may or may not complete.
 *
 */
-(void)disconnectBlueTooth:(CBPeripheral*)peripheral;

/***
 *  外部管理扫描和连接使用
 *
 ***/
//

/**
 V2.9 add
 外部添加到sdk内部已连接设备

 @param peripheral 已连接的外设
 @return
 */
- (BOOL)addConnectedPeripheral:(CBPeripheral *)peripheral;

/**
 V2.9 add
 外部移除已连接设备
 
 @param peripheral 已断开连接的外设
 @return
 */
- (BOOL)removeConnectedPeripheral:(CBPeripheral *)peripheral;

/**
 V2.9 add
 移除所有已连接设备
 @return
 */
- (BOOL)removeAllConnectedPeripheral;


/**
 上传健康检测仪测量数据
 
 @param result 数据类实例
 @param usage 用途字段
 @param currentMemberBelongDeviceID NullAble 当前成员所属设备id
 @param phoneNumber 账号相关电话
 @return 是否下发
 */
- (BOOL)uploadMeasureResult:(id)result
                   andUsage:(LTFileType)usage
                andDeviceId:(NSString *)currentMemberBelongDeviceID
                phoneNumber:(NSString *)phoneNumber
               cpmleteBlock:(void (^)(BOOL succ, NSUInteger errcode))block;

/**
 下载测量数据
 
 @param startDate 起始日期
 @param endDate 结束日期
 @param deviceID 设备id
 @param accountIdOrMemberId 账户或者member id
 @param fileType 文件类型
 @return 数据模型
 */
- (id)downloadLogAndStoreDuringStateDate:(NSDate *)startDate
                                 endDate:(NSDate *)endDate
                                DeviceID:(NSString *)deviceID
                               AccountId:(NSString *)accountIdOrMemberId //账号:前后缀都要
                                FileType:(LTFileType)fileType;


@end
