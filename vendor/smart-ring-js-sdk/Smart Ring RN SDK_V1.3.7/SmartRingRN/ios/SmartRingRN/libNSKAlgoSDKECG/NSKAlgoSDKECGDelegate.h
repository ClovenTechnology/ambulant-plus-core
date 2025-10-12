//
//  NSKAlgoSDKECGDelegate.h
//  NSKAlgoSDKECG
//
//  Created by Fei Deng on 7/23/15.
//  Copyright (c) 2015 NeuroSky. All rights reserved.
//

#import <Foundation/Foundation.h>

@protocol NSKAlgoSDKECGDelegate <NSObject>

enum {
    ECG_SDK_HAS_NOT_BEEN_INITIALIZED = 0,
    ECG_USER_PROFILE_HAS_NOT_BEEN_SET_UP = 1,
    ECG_USER_PROFILE_CORRUPTED_DATA = 3,
    ECG_USER_PROFILE_EMPTY_FILE = 4,
    ECG_INVALID_INPUT_AGE = 5,
    ECG_INVALID_INPUT_NAME = 6,
    ECG_INVALID_INPUT_HEIGHT = 7,
    ECG_INVALID_INPUT_WEIGHT = 8,
    ECG_INVALID_INPUT_PATH = 13,
    ECG_INSUFFICIENT_DATA = 16,
    ECG_INVALID_INPUT_SAMPLE_RATE = 17,
    ECG_INVALID_INPUT_LICENSE = 18,
    ECG_EXCEPTION_LICENSE_EXPIRED = 19,
};
typedef NSUInteger ECGException;
- (void)exceptionECGMessage:(ECGException)excepType;

enum {
    ECG_SMOOTHED_WAVE = 1,
    ECG_RPEAK_DETECTED = 2,
    ECG_R2R_INTERVAL = 3,
    ECG_RRI_COUNT = 4,
    ECG_SIGNAL_QUALITY = 5,
    ECG_OVALLALL_SIGNAL_QUALITY = 6,
    ECG_HEART_RATE = 7,
    ECG_ROBUST_HEART_RATE = 8,
    ECG_HRV = 9,
};
typedef NSUInteger ECGAlgorithmsData;
- (void)dataReceived:(ECGAlgorithmsData)algo results:(int)value;

@end