//
//  NSKAlgoSDKECG.h
//  NSKAlgoSDKECG
//
//  Created by Fei Deng on 7/23/15.
//  Copyright (c) 2015 NeuroSky. All rights reserved.
//

#import <Foundation/Foundation.h>
#include "NSKAlgoSDKECGDelegate.h"

@interface NSKAlgoSDKECG : NSObject {
    id<NSKAlgoSDKECGDelegate> delegate;
}

@property (retain) id<NSKAlgoSDKECGDelegate> delegate;

//Step 1: init object of SDK
- (id)init;
//set up the license and sample rate for SDK analyze
- (void)setupSDKProperty:(NSString *)licenseString withSampleRate:(int)sampleRate enableSmoothed:(int)powerlineFreq;
//get basic information of SDK
- (NSString *)getVersion;
- (NSString *)getAlgoVersion;
- (void)enableNSLogMessages:(bool) enable;

//Step 2: reset to clean up the buffer
- (void)resetECGAnalysis;

//Step 3: set up the utility methods, use the method to reset profile when switch users.
- (void)setUserProfile:(NSString*)profileID withGender:(bool)isFemale withAge:(int)userAge withHeight:(int)userHeight withWeight:(int)userWeight withPath:(NSString*)filePath;//for same user, only need call this method once

//Step 4: fill ECG raw sample and signal quality
- (void)requestECGAnalysis:(int) rawValue withPoorSignal:(int) poorSignal;

//Step 7: request ECG analytical results, require 30 rri in order to generate results.
- (int)getStress;
- (int)getHeartAge;
- (int)getMood;
@end