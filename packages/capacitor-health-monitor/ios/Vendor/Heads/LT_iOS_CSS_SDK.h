//
//  LT_iOS_CSS_SDK.h
//  LT_iOS_CSS_SDK
//
//  Created by LinktopMac on 14-11-27.
//  Copyright (c) 2014年 LinktopMac. All rights reserved.
//  云同步模块(登录,注册,忘记密码,文件云同步等功能)

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>


@class TH_MeasureDataObj;

typedef NS_ENUM(NSInteger,LTFileType) {
    LTFileTypeRear = 0,//主摄像头
    LTFileTypeFront,//次摄像头
    LTFileTypeSOSRear,//主摄像头的sos照片
    LTFileTypeSOSFront,//次摄像头的sos照片
    //健康检测仪
    LTFileTypeBloodOxygen,
    LTFileTypeECG,
    LTFileTypeBloodPressure,
    LTFileTypeBloodSugar,
    LTFileTypeTemperature,
    LTFileTypeNone
    
};

@interface LT_iOS_CSS_SDK : NSObject
@property(atomic, strong) NSString *loginAccount; //此时登录的账户


-(NSDictionary*)SetYunPush:(NSString*)bundleid DeviceToken:(NSData*)devicetoken OsVer:(NSString*)ver Flag:(Boolean)flag andType:(NSString *)type;
//设置百度推送
-(NSDictionary*)SetYunPush:(NSString*)userid ChannelID:(NSString*)channelid AppID:(NSString*)appid Flag:(Boolean)flag;
//极光推送
-(NSDictionary *)SetJiGuangYun:(NSString *)apikey RegID:(NSString *)regid OsVer:(NSString*)osVer Flag:(Boolean)flag;


//激活绑定
-(NSDictionary *)BindDevice:(NSString *)qr_code;
//按id绑定
-(NSDictionary *)BindDeviceID:(NSString *)deviceID AKey:(NSString *)akey;
//解除绑定
-(Boolean)UnbindDevice:(NSString*)deviceid;
//设置与宝贝的关系
-(Boolean)UploadNicknameOfDevice:(NSString *)nickname DeviceID:(NSString*)deviceid;

//获得监控日志和通知中心
-(NSArray *)GetMonitorLogAndInformationLog:(Boolean)IsMonitorLog DeviceID:(NSString *)deviceid Src:(NSNumber *)src;

//获得设备列表
-(NSArray *)GetListOfDevice:(NSString *)accountname;

/**
 返回设备列表
 
 @param accountname 账号
 @return 列表+ 服务器返回错误码
 */
-(NSDictionary *)GetListOfDeviceAndServerCode:(NSString *)accountname;

//子账号申请关注
-(NSDictionary*)ApplyToFolow:(NSString *)qr_code;
-(NSDictionary*)ApplyToFolow:(NSString *)ak andPid:(NSString *)pid;


//下载白名单---通讯录
- (NSDictionary *)GetWhiteListForAddressListDeviceID:(NSString *)deviceid;

//****Account****//
//注册
+(NSDictionary *)registerForAppKey:(NSString *)appkey Secret:(NSString *)secret AccountName:(NSString *)accountName PhoneNumber:(NSString *)phoneNumber PassWord:(NSString *)password is3rd:(BOOL)is3rd;
//短信验证激活
+(NSDictionary *)ThirdRegisterUser:(NSString*)user Password:(NSString *)password Code:(NSString *)code;
//忘记密码
+(NSDictionary *)thirdNewSendAuthCodeForAppKey:(NSString *)appkey Secret:(NSString *)secret User:(NSString *)user;
//重置密码
+(NSDictionary *)newThirdRegisterUser:(NSString*)user Code:(NSString *)code NewPwd:(NSString *)newpwd;
//检测账号是否已经存在
+(NSDictionary *)isAccountExist:(NSString *)accountName;

//登录
-(NSDictionary *)loginfunUserName:(NSString *)username PassWord:(NSString *)password;
//检查关注验证码是否正确
-(NSDictionary *)authCodeForDeviceID:(NSString *)deviceid Account:(NSString *)account Val:(NSString *)val;


// 重新获取QR码
-(NSString*)GetQR_Code:(NSString*)deviceID;
// 获取设备终端号
-(NSString*)GetTid_Code:(NSString*)deviceID;


/**
 邀请好友关注

 @param pid 设备id
 @param no 电话号码, 多个电话用","分隔电话号码内部不能有","
 @param action 0 邀请 1撤销邀请
 @param alias 关系(可选),多个关系使用","分隔, 别名内部不能有逗号.单个别名长度(0,10] 无需设置填nil
 */
-(NSDictionary *)InviteByDeviceID:(NSString *)pid PhoneNumber:(NSString *)no Action:(NSNumber *)action Alias:(NSString *)alias;
-(NSDictionary *)BugReportUploadDeviceFile:(NSData *)fileData DeviceID:(NSString*)deviceid Src:(NSNumber *)src Usage:(NSString *)usage;

-(Boolean)Deactive:(NSString*)deviceid;
//由客户端发起的通知推送
-(Boolean)PushNotifitcation:(NSString *)title Description:(NSString *)description CallBack:(NSString *)cb DeviceID:(NSString *)deviceid;

//图片文件下载
-(NSData *)DownLoadImageFile:(NSString *)r FileName:(NSString *)fileName DeviceID:(NSString*)deviceid Src:(NSNumber *)src;
//录音文件下载
-(NSData *)DownLoadVoiceFile:(NSString *)r FileName:(NSString *)fileName DeviceID:(NSString*)deviceid Src:(NSNumber *)src;
//文件上传
-(NSDictionary *)UploadDeviceFile:(NSData *)data DeviceID:(NSString*)deviceid Src:(NSNumber *)src Usage:(NSString *)usage;
//- (CssAPI *)returnCssApi;

-(NSNumber *)TimeFormat:(Boolean)IsTwelve DeviceID:(NSString *)deviceid;


//获取账户信息
-(id)getAccountInfo:(NSString *)deviceid;


/**
 * @brief 获取短信验证码
 * @param type 类型
 0	帐号注册
 1	申请关注
 2	重置密码
 3	sos提醒
 目前只用于获取 申请关注 验证码
 * @param followAccountID 关注账号ID
 * @param deviceid 设备ID
 * @return NSDictionary*
 参数	说明
 state	0: 成功；1：参数非法
 code	验证码值
 */
-(NSDictionary *) getValCodeType:(NSNumber *)type deviceID:(NSString *) deviceid followAccountID:(NSString *)followAccountID;


/**
 *  设置推送设备别名
 *
 *  @param nickname 别名 传入nil清空推送设备别名
 *  @param deviceID 设备
 *  return: state :
 0	设置成功
 2	设备号为空
 3	帐号不是绑定帐号
 */
- (NSDictionary *)settingDeviceRemoteNotiNickName:(NSString *)nickname andDeviceID:(NSString *)deviceID;

#pragma mark --体温计相关
- (NSArray *)THDownMeasureData:(NSString *)deviceID;

//同步测量数据
- (BOOL)TH_MeasureDataSyncToServer:(NSString *)deviceID LoginName:(NSString *)loginName List:(NSArray<TH_MeasureDataObj *> *) measureList;


@end
















