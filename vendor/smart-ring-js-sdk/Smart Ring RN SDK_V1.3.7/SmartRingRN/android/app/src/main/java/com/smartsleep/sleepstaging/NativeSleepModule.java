package com.smartsleep.sleepstaging;

import com.facebook.react.bridge.ReactContextBaseJavaModule;

import android.widget.Toast;
import com.facebook.react.bridge.ReactApplicationContext;
import android.content.Context;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Callback;
import java.util.List;
import java.util.ArrayList;
import android.util.Log;
import com.smartsleep.sleepstaging.SleepStagingResult;
import com.smartsleep.sleepstaging.HealthData;
import com.smartsleep.sleepstaging.SlpWakeData;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
public class NativeSleepModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("sleepstaging");
    }

    private Context mContext;

    public NativeSleepModule(ReactApplicationContext reactContext) {
        super(reactContext);
        mContext = reactContext;
    }

    @Override
    public String getName() {
        // 返回的这个名字是必须的，在rn代码中需要这个名字来调用该类的方法。
        return "NativeSleepModule";
    }

    @ReactMethod
    public void getSleepData(ReadableArray healthDataArray, Callback callback) {
        List<HealthData> healthDataList = new ArrayList<>();
        for (int i = 0; i < healthDataArray.size(); i++) {
            ReadableMap healthDataItem = healthDataArray.getMap(i);
            double ts = healthDataItem.getDouble("ts");
            int hr = healthDataItem.getInt("hr");
            int hrv = healthDataItem.getInt("hrv");
            int motion = healthDataItem.getInt("motion");
            int steps = healthDataItem.getInt("steps");
            Log.e("czq"," ts= "+ts+" ts="+(long)ts+" hrv="+hrv+" motion="+motion+" steps="+steps);
            HealthData healthData = new HealthData((long)ts, hr, hrv, motion, steps);
            healthDataList.add(healthData);
        }
        SleepStagingResult sleepStagingResult=SleepStagingNative.analysis(healthDataList);
        if(sleepStagingResult.stagingList!=null){
            // 将 Staging 对象列表转换为可写数组
            WritableArray stagingDataList = Arguments.createArray();
            for (StagingData stagingData : sleepStagingResult.stagingList) {
                WritableMap stagingV3Map = Arguments.createMap();
                stagingV3Map.putDouble("startTime", (double)stagingData.startTime);
                stagingV3Map.putDouble("endTime", (double)stagingData.endTime);
                stagingV3Map.putDouble("averageHr", stagingData.averageHr);
                WritableArray stagingList = Arguments.createArray();
                for(Staging staging:stagingData.stagingList){
                    WritableMap stagingMap = Arguments.createMap();
                    stagingMap.putDouble("startTime", (double)staging.startTime);
                    stagingMap.putDouble("endTime", (double)staging.endTime);
                    stagingMap.putString("stagingType", staging.stagingType.name());
                    stagingList.pushMap(stagingMap);
                }
                stagingV3Map.putArray("stagingList",stagingList);
                stagingDataList.pushMap(stagingV3Map);
            }
            // stagingData.putArray("stagingList", stagingList);
            Log.e("czq"," stagingDataList= "+stagingDataList.toString()+"callback="+callback);
            // 在适当的时机调用回调函数并传递对象
            if (callback != null) {
                callback.invoke(stagingDataList);
            }
        }
        
    }

    @ReactMethod
    public void getNewAlgorithmSleepRing(ReadableArray healthDataArray, Callback callback) {
        List<HealthData> healthDataList = new ArrayList<>();
        for (int i = 0; i < healthDataArray.size(); i++) {
            ReadableMap healthDataItem = healthDataArray.getMap(i);
            double ts = healthDataItem.getDouble("ts");
            int hr = healthDataItem.getInt("hr");
            int hrv = healthDataItem.getInt("hrv");
            int motion = healthDataItem.getInt("motion");
            int steps = healthDataItem.getInt("steps");
            Log.e("czq"," ts= "+ts+" ts="+(long)ts+" hrv="+hrv+" motion="+motion+" steps="+steps);
            HealthData healthData = new HealthData((long)ts, hr, hrv, motion, steps);
            healthDataList.add(healthData);
        }
        SleepStagingResult sleepStagingResult=SleepStagingNative.analysisSleepRing(healthDataList);
        if(sleepStagingResult.stagingList!=null){
            // 将 Staging 对象列表转换为可写数组
            WritableArray stagingDataList = Arguments.createArray();
            for (StagingData stagingData : sleepStagingResult.stagingList) {
                WritableMap stagingV3Map = Arguments.createMap();
                stagingV3Map.putDouble("startTime", (double)stagingData.startTime);
                stagingV3Map.putDouble("endTime", (double)stagingData.endTime);
                stagingV3Map.putDouble("averageHr", stagingData.averageHr);
                WritableArray stagingList = Arguments.createArray();
                for(Staging staging:stagingData.stagingList){
                    WritableMap stagingMap = Arguments.createMap();
                    stagingMap.putDouble("startTime", (double)staging.startTime);
                    stagingMap.putDouble("endTime", (double)staging.endTime);
                    stagingMap.putString("stagingType", staging.stagingType.name());
                    stagingList.pushMap(stagingMap);
                }
                stagingV3Map.putArray("stagingList",stagingList);
                stagingDataList.pushMap(stagingV3Map);
            }
            // stagingData.putArray("stagingList", stagingList);
            Log.e("czq"," stagingDataList= "+stagingDataList.toString()+"callback="+callback);
            // 在适当的时机调用回调函数并传递对象
            if (callback != null) {
                callback.invoke(stagingDataList);
            }
        }
        
    }

    

    @ReactMethod
    public void getNewAlgorithmSleepData(ReadableArray healthDataArray,ReadableArray sleepDataArray, Callback callback) {
        List<HealthData> healthDataList = new ArrayList<>();
        for (int i = 0; i < healthDataArray.size(); i++) {
            ReadableMap healthDataItem = healthDataArray.getMap(i);
            double ts = healthDataItem.getDouble("ts");
            int hr = healthDataItem.getInt("hr");
            int hrv = healthDataItem.getInt("hrv");
            int motion = healthDataItem.getInt("motion");
            int steps = healthDataItem.getInt("steps");
            Log.e("czq"," ts= "+ts+" ts="+(long)ts+" hr="+hr+" motion="+motion+" steps="+steps);
            HealthData healthData = new HealthData((long)ts, hr, hrv, motion, steps);
            healthDataList.add(healthData);
        }
        List<SlpWakeData> sleepDataList = new ArrayList<>();
        for (int i = 0; i < sleepDataArray.size(); i++) {
            ReadableMap sleepDataItem = sleepDataArray.getMap(i);
            double ts = sleepDataItem.getDouble("ts");
            int type = sleepDataItem.getInt("type");
            int bedRestDuration = sleepDataItem.getInt("bed_rest_duration");
            int awakeningOrder = sleepDataItem.getInt("awake_order");
            SlpWakeData sleepData = new SlpWakeData((long)ts, type, bedRestDuration, awakeningOrder);
            sleepDataList.add(sleepData);
        }
        SleepStagingResult sleepStagingResult=SleepStagingNative.analysisSleepData(sleepDataList,healthDataList);
        Log.e("czq"," sleepStagingResult= "+sleepStagingResult.toString());
        if(sleepStagingResult.stagingList!=null){
            // 将 Staging 对象列表转换为可写数组
            WritableArray stagingDataList = Arguments.createArray();
            for (StagingData stagingData : sleepStagingResult.stagingList) {
                WritableMap stagingV3Map = Arguments.createMap();
                stagingV3Map.putDouble("startTime", (double)stagingData.startTime);
                stagingV3Map.putDouble("endTime", (double)stagingData.endTime);
                stagingV3Map.putDouble("averageHr", stagingData.averageHr);
                WritableArray stagingList = Arguments.createArray();
                for(Staging staging:stagingData.stagingList){
                    WritableMap stagingMap = Arguments.createMap();
                    stagingMap.putDouble("startTime", (double)staging.startTime);
                    stagingMap.putDouble("endTime", (double)staging.endTime);
                    stagingMap.putString("stagingType", staging.stagingType.name());
                    stagingList.pushMap(stagingMap);
                }
                stagingV3Map.putArray("stagingList",stagingList);
                stagingDataList.pushMap(stagingV3Map);
            }
            // stagingData.putArray("stagingList", stagingList);
            Log.e("czq"," stagingDataList= "+stagingDataList.toString()+"callback="+callback);
            // 在适当的时机调用回调函数并传递对象
            if (callback != null) {
                callback.invoke(stagingDataList);
            }
        }
    }

    @ReactMethod
    public void getNewAlgorithmSleepFusion(ReadableArray healthDataArray,ReadableArray sleepDataArray, Callback callback) {
        List<HealthData> healthDataList = new ArrayList<>();
        for (int i = 0; i < healthDataArray.size(); i++) {
            ReadableMap healthDataItem = healthDataArray.getMap(i);
            double ts = healthDataItem.getDouble("ts");
            int hr = healthDataItem.getInt("hr");
            int hrv = healthDataItem.getInt("hrv");
            int motion = healthDataItem.getInt("motion");
            int steps = healthDataItem.getInt("steps");
            Log.e("czq"," ts= "+ts+" ts="+(long)ts+" hr="+hr+" motion="+motion+" steps="+steps);
            HealthData healthData = new HealthData((long)ts, hr, hrv, motion, steps);
            healthDataList.add(healthData);
        }
        List<SlpWakeData> sleepDataList = new ArrayList<>();
        for (int i = 0; i < sleepDataArray.size(); i++) {
            ReadableMap sleepDataItem = sleepDataArray.getMap(i);
            double ts = sleepDataItem.getDouble("ts");
            int type = sleepDataItem.getInt("type");
            int bedRestDuration = sleepDataItem.getInt("bed_rest_duration");
            int awakeningOrder = sleepDataItem.getInt("awake_order");
            SlpWakeData sleepData = new SlpWakeData((long)ts, type, bedRestDuration, awakeningOrder);
            sleepDataList.add(sleepData);
        }
        SleepStagingResult sleepStagingResult=SleepStagingNative.analysisSleepFusion(sleepDataList,healthDataList);
        Log.e("czq"," sleepStagingResult= "+sleepStagingResult.toString());
        if(sleepStagingResult.stagingList!=null){
            // 将 Staging 对象列表转换为可写数组
            WritableArray stagingDataList = Arguments.createArray();
            for (StagingData stagingData : sleepStagingResult.stagingList) {
                WritableMap stagingV3Map = Arguments.createMap();
                stagingV3Map.putDouble("startTime", (double)stagingData.startTime);
                stagingV3Map.putDouble("endTime", (double)stagingData.endTime);
                stagingV3Map.putDouble("averageHr", stagingData.averageHr);
                WritableArray stagingList = Arguments.createArray();
                for(Staging staging:stagingData.stagingList){
                    WritableMap stagingMap = Arguments.createMap();
                    stagingMap.putDouble("startTime", (double)staging.startTime);
                    stagingMap.putDouble("endTime", (double)staging.endTime);
                    stagingMap.putString("stagingType", staging.stagingType.name());
                    stagingList.pushMap(stagingMap);
                }
                stagingV3Map.putArray("stagingList",stagingList);
                stagingDataList.pushMap(stagingV3Map);
            }
            // stagingData.putArray("stagingList", stagingList);
            Log.e("czq"," stagingDataList= "+stagingDataList.toString()+"callback="+callback);
            // 在适当的时机调用回调函数并传递对象
            if (callback != null) {
                callback.invoke(stagingDataList);
            }
        }
    }

    @ReactMethod
    public void setSampleInterval(int interval){
        SleepStagingNative.setSampleInterval(interval);
    }

    @ReactMethod
    public void getSampleInterval(){
        int interval=SleepStagingNative.getSampleInterval();
        Log.e("czq"," interval= "+interval);
    }

}