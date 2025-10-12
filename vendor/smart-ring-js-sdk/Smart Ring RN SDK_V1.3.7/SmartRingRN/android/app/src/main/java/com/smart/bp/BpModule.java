package com.smart.bp;

import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import androidx.core.app.ActivityCompat;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableArray;
import org.apache.commons.io.FileUtils;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.BufferedOutputStream;
import java.io.OutputStream;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import com.facebook.react.modules.core.RCTNativeAppEventEmitter;

public class BpModule extends ReactContextBaseJavaModule {


    private final ReactApplicationContext mReactContext;

    private int DATA_LOSS_THRESHOLD = 1000; //丢包阈值
    private int DATA_SAMPLE_RATE = 512;  //采样率
    private int MIN_CALIBRATION_TIMES = 3; //最低校准次数
    private int PPG_DATA_SAMPLE_RATE=1000; //采样率；
    private String mUserCalBp = ""; //用户当前校准的血压值

    private String mCurrCalibrationInfo = ""; //当前校准信息


    private int ecgIndex = 0;
    private int mPTTCount = 0;
    private List<Float> ppgData = new ArrayList<>();
    private List<Integer> mPTTList = new ArrayList<>();
    private List<Integer> mPWTTMidAvgList = new ArrayList<>();
    private List<Double> filteredPPGList = new ArrayList<>();
    private List<Double> filteredECGList = new ArrayList<>();
    private boolean isCalibrating = false;
    private boolean isMeasuring = false;
    private final ExecutorService executorService;


    public BpModule(ReactApplicationContext reactContext) {
        super(reactContext);

        mReactContext = reactContext;
        this.executorService = Executors.newCachedThreadPool();
    }

    @Override
    public String getName() {
        return "BpModule";
    }

    // @ReactMethod
    // public void init(String bpCalibrationInfo){
    //     SmartBPNative.initial();
    //     this.mCurrCalibrationInfo = bpCalibrationInfo;
    //     Log.e("czq"," init mCurrCalibrationInfo= "+mCurrCalibrationInfo);
    //     if(calibrationSize() >= MIN_CALIBRATION_TIMES){
    //         SmartBPNative.setBPCalibrationInfo(mCurrCalibrationInfo);
    //     }
    // }

    @ReactMethod
    public void initial(){
        SmartBPNative.initial();
    }

    @ReactMethod
    public void reset(){
        mPTTCount = 0;
        SmartBPNative.reset();
    }


    // @ReactMethod
    // public void outPutFilteredECGData(Integer data,ReadableArray ppgData){
    //     if(!isMeasuring) return;
    //     double ppg = ppgData.getDouble(ecgIndex++);
    //     SmartBPNative.addSample((double) data, ppg);
    // }

    @ReactMethod
    public void addSample(int ecg, int ppg){
        // 打印原始的int值
        Log.e("czq", "addSample ecg= " + ecg + " ppg= " + ppg);
    
        // 将int类型的ecg和ppg转换为double类型
        double ecgDouble = (double) ecg;
        double ppgDouble = (double) ppg;
        Log.e("czq","addSample double ecg= " + ecg + " ppg= " + ppg);
        // 调用需要double类型参数的方法
        SmartBPNative.addSample(ecgDouble, ppgDouble);
        
        int rriCount = SmartBPNative.getRRICount();
        double filteredPpg= SmartBPNative.getFilteredPPG();
        Log.e("czq","addSample double filteredPpg= " + filteredPpg);
        filteredPPGList.add(filteredPpg);
        filteredECGList.add(ecgDouble);
        Log.e("czq","addSample double rriCount= " + rriCount );
        if(rriCount>mPTTCount){
            mPTTCount = rriCount;
            WritableMap map = Arguments.createMap();
            map.putInt("rriCount", rriCount);
            sendEvent("bpDataListener", map);
        }

        if(filteredECGList.size()==PPG_DATA_SAMPLE_RATE){
            WritableMap map = Arguments.createMap();
            WritableArray ppGArray = Arguments.createArray();
            for(double value : filteredPPGList){
                ppGArray.pushDouble(value);
            }
            Log.e("czq","addSample double filteredPPGList= " + filteredPPGList.size()+"  ppGArray.size()="+ppGArray.size());
            map.putArray("filteredPPGList", ppGArray);
    
            // 同样处理filteredECGList
            WritableArray ecGArray = Arguments.createArray();
            for(double value : filteredECGList){
                ecGArray.pushDouble(value);
            }
            map.putArray("filteredECGList", ecGArray);
            filteredECGList.clear();
            filteredPPGList.clear();
            // Log.e("czq","addSample double map= " + map.toString());
            sendEvent("bpWaveListener", map);
        }

    }


    @ReactMethod
    public void getRRICount(final Callback callback){
        // executorService.submit(() -> {
        //     try {
        //         int rriCount = SmartBPNative.getRRICount();
        //         // 注意：如果需要更新UI，确保回调是在主线程上执行
        //         getReactApplicationContext().runOnUiQueueThread(() -> callback.invoke(rriCount));
        //     } catch (Exception e) {
        //         // 处理异常情况
        //         callback.invoke(0); // 或者根据需要传递错误信息
        //     }
        // });
        int rriCount = SmartBPNative.getRRICount();
        Log.e("czq"," getRRICount= "+rriCount);
        if(rriCount>mPTTCount&&rriCount!=20){
            mPTTCount = rriCount;
            callback.invoke(rriCount);
        }
    }

    @ReactMethod
    public void getHR(final Callback callback){
        int hr = SmartBPNative.getHR();
        Log.e("czq"," getHR= "+hr);
        callback.invoke(hr);
    }

    @ReactMethod
    public void getFilteredPPG(final Callback callback){
        double ppg = SmartBPNative.getFilteredPPG();
        callback.invoke(ppg);
    }

    @ReactMethod
    public void getCalibrationInfo(final Callback callback){
        String calibrationInfo = SmartBPNative.getCalibrationInfo();
        Log.d("czq","getCalibrationInfo  calibrationInfo"+calibrationInfo);
        callback.invoke(calibrationInfo);
    }

    @ReactMethod
    public void setBPCalibrationInfo(String bpCalibrationInfo){
        Log.e("czq"," setBPCalibrationInfo bpCalibrationInfo= "+bpCalibrationInfo);
        SmartBPNative.setBPCalibrationInfo(bpCalibrationInfo);
    }

    @ReactMethod
    public void getPwttInfo(final Callback callback){
        String pwttInfo = SmartBPNative.getPwttInfo();
        Log.d("czq","getPwttInfo  pwttInfo"+pwttInfo);
        callback.invoke(pwttInfo);
    }

    @ReactMethod
    public void statSys(final Callback callback){
        int statSys = SmartBPNative.statSys();
        Log.d("czq","statSys  statSys"+statSys);
        callback.invoke(statSys);
    }

    @ReactMethod
    public void statDia(final Callback callback){
        int statDia = SmartBPNative.statDia();
        Log.d("czq","statDia  statDia"+statDia);
        callback.invoke(statDia);
    }

    @ReactMethod
    public void getCalibrationSize(final Callback callback){
        int size = calibrationSize();
        Log.d("czq","getCalibrationSize  size"+size);
        callback.invoke(size);
    }

    @ReactMethod
    public void requiredCalibrationTimes(final Callback callback){
        int times = requiredCalibrationTimes();
        Log.d("czq","requiredCalibrationTimes  times"+times);
        callback.invoke(times);
    }

    @ReactMethod
    public void ecgRDetected(){
        SmartBPNative.ecgRDetected();
    }
    

    @Override
    public void onCatalystInstanceDestroy() {
        // 当React实例被销毁时关闭线程池
        if (executorService != null && !executorService.isShutdown()) {
            executorService.shutdownNow();
        }
        super.onCatalystInstanceDestroy();
    }

    private int requiredCalibrationTimes() {
        return MIN_CALIBRATION_TIMES - calibrationSize();
    }

    private int calibrationSize() {
        Log.d("czq","calibrationSize  this.mCurrCalibrationInfo"+this.mCurrCalibrationInfo);
        if (this.mCurrCalibrationInfo != null && !this.mCurrCalibrationInfo.trim().isEmpty()) {
            // 使用AtomicInteger来允许在lambda表达式中修改其值
            AtomicInteger count = new AtomicInteger();
    
            Arrays.stream(this.mCurrCalibrationInfo.split(";"))
                  .map(String::trim)
                  .filter(item -> !item.isEmpty())
                  .filter(item -> item.chars().filter(c -> c == '/').count() == 3)
                  .forEach(item -> count.incrementAndGet());
            Log.d("czq","calibrationSize  count.get()"+count.get());      
    
            return count.get();
        } else {
            return 0;
        }
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
		mReactContext.getJSModule(RCTNativeAppEventEmitter.class).emit(eventName, params);
	}



}
