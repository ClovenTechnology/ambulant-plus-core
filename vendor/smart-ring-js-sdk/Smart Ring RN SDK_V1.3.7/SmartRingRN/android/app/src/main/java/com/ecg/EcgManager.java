package com.ecg;

import android.util.Log;
import com.neurosky.AlgoSdk.NskAlgoDataType;
import com.neurosky.AlgoSdk.NskAlgoECGValueType;
import com.neurosky.AlgoSdk.NskAlgoProfile;
import com.neurosky.AlgoSdk.NskAlgoSampleRate;
import com.neurosky.AlgoSdk.NskAlgoSdk;
import com.neurosky.AlgoSdk.NskAlgoState;
import com.neurosky.AlgoSdk.NskAlgoType;
import java.util.Arrays;

public class EcgManager {

    private final static String TAG = "EcgManager";
    private final static String NSK_ALGO_SDK_LICENCE = "NeuroSky_Release_To_GeneralFreeLicense_Use_Only_Dec  1 2016";

    private final static int OUTPUT_INTERVAL = 30;

    private boolean isEcgTest = false;
    private int ecgStageFlag = 0;
    public int ecgStep = 0;

    // private int ecgDataNum2 = 0;
    private int dataEcg = 0;

    private EcgListener mEcgListener;
    // private OnSendCodeToDevCallback callback;
    private boolean isModuleExist;
    private boolean outputRawData = false;
    private boolean outputArrayData;
    private boolean isFingerTouchOnSensor;
    private NskAlgoSdk mNskAlgoSdk;
    private int ecgDataIndex;
    private int activeProfile;

    private int pkgIndex = 0;
    private static final int pkgLen = 128;
    private int[] outputPkg;

    private static EcgManager ecgManager = new EcgManager();

    public static EcgManager getInstance() {
        return ecgManager;
    }

    public void init(int... algoTypes) {
        mNskAlgoSdk = new NskAlgoSdk();
        mNskAlgoSdk.setOnStateChangeListener((state, reason) -> Log.e(TAG, "state:" + new NskAlgoState(state)
                + ", reason:" + new NskAlgoState(reason)));
        if (algoTypes == null || algoTypes.length == 0) {
            algoTypes = new int[] { Constant.ECG_KEY_HEART_AGE, Constant.ECG_KEY_HEART_RATE
                    // , ECG_KEY_HRV_FD, ECG_KEY_HRV_TD
                    , Constant.ECG_KEY_HRV, Constant.ECG_KEY_MOOD, Constant.ECG_KEY_RESPIRATORY_RATE,
                    Constant.ECG_KEY_SMOOTH, Constant.ECG_KEY_STRESS };
        }
        int algoType = 0;
        for (int type : algoTypes) {
            algoType |= type;
        }
        final int ret = NskAlgoSdk.NskAlgoInit(algoType, "", NSK_ALGO_SDK_LICENCE);
        if (ret == 0) {
            Log.e(TAG, "ECG algo has been initialized successfully.");
        } else {
            Log.e(TAG, "Failed to initialize ECG algo, code = " + ret);
        }
        if (!mNskAlgoSdk.setBaudRate(NskAlgoDataType.NSK_ALGO_DATA_TYPE_ECG,
                NskAlgoSampleRate.NSK_ALGO_SAMPLE_RATE_512)) {
            Log.e(TAG, "Failed to set the sampling rate: " + NskAlgoSampleRate.NSK_ALGO_SAMPLE_RATE_512);
            return;
        }

        // 信号质量回调
        mNskAlgoSdk.setOnSignalQualityListener(new NskAlgoSdk.OnSignalQualityListener() {
            @Override
            public void onSignalQuality(int level) {// 实时信号质量
                if (mEcgListener != null)
                    mEcgListener.onSignalQuality(level);
            }

            @Override
            public void onOverallSignalQuality(int value) {// 总体信号质量

            }
        });

        String sdkVersion = "SDK ver: " + NskAlgoSdk.NskAlgoSdkVersion();
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_AFIB) != 0) {
            NskAlgoSdk.NskAlgoSetECGConfigAfib(3.5f);
            sdkVersion += "\nAfib ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_AFIB);
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_HEARTAGE) != 0) {
            NskAlgoSdk.NskAlgoSetECGConfigHeartage(OUTPUT_INTERVAL);
            sdkVersion += "\nHeartage ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_HEARTAGE);
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_HEARTRATE) != 0) {
            sdkVersion += "\nHeartrate ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_HEARTRATE);
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_HRV) != 0) {
            NskAlgoSdk.NskAlgoSetECGConfigHRV(OUTPUT_INTERVAL);
            sdkVersion += "\nHRV ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_HRV);
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_HRVFD) != 0) {
            NskAlgoSdk.NskAlgoSetECGConfigHRVFD(OUTPUT_INTERVAL, OUTPUT_INTERVAL);
            sdkVersion += "\nHRVFD ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_HRVFD);
            mNskAlgoSdk.setOnECGHRVFDAlgoIndexListener(new NskAlgoSdk.OnECGHRVFDAlgoIndexListener() {
                /**
                 * 频域分析回调
                 * 
                 * @param hf        HF
                 * @param lf        LF
                 * @param lfhfRatio LF to HF ratio
                 * @param hflfRatio HF to LF ratio
                 * @remark for the value representation, please refer to the algorithm
                 *         description
                 */
                @Override
                public void onECGHRVFDAlgoIndexListener(float hf, float lf, float lfhfRatio, float hflfRatio) {
                    Log.e(TAG, "FD hf:" + hf + ", lf:" + lf + ", lfhfRatio:" + lfhfRatio + ", hflfRatio:" + hflfRatio);
                }
            });
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_HRVFD) != 0) {// 时域分析
            NskAlgoSdk.NskAlgoSetECGConfigHRVTD(OUTPUT_INTERVAL, OUTPUT_INTERVAL);
            sdkVersion += "\nHRVTD ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_HRVFD);
            mNskAlgoSdk.setOnECGHRVTDAlgoIndexListener(new NskAlgoSdk.OnECGHRVTDAlgoIndexListener() {
                /**
                 * 时域分析回调
                 * 
                 * @param nn50        NN50
                 * @param sdnn        SDNN
                 * @param pnn50       PNN50
                 * @param rrTranIndex triangular index
                 * @param rmssd       RMSSD
                 * @remark for the value representation, please refer to the algorithm
                 *         description
                 */
                @Override
                public void onECGHRVTDAlgoIndexListener(float nn50, float sdnn, float pnn50, float rrTranIndex,
                        float rmssd) {
                    Log.e(TAG, "TD nn50:" + nn50 + ", sdnn:" + sdnn + ", pnn50:" + pnn50
                            + ", rrTranIndex:" + rrTranIndex + ", rmssd:" + rmssd);
                }
            });
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_MOOD) != 0) {
            sdkVersion += "\nMood ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_MOOD);
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_RESPIRATORY) != 0) {
            sdkVersion += "\nResp ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_RESPIRATORY);
        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_SMOOTH) != 0) {
            sdkVersion += "\nSmooth ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_SMOOTH);

        }
        if ((algoType & NskAlgoType.NSK_ALGO_TYPE_ECG_STRESS) != 0) {
            NskAlgoSdk.NskAlgoSetECGConfigStress(OUTPUT_INTERVAL, OUTPUT_INTERVAL);
            sdkVersion += "\nStress ver: " + NskAlgoSdk.NskAlgoAlgoVersion(NskAlgoType.NSK_ALGO_TYPE_ECG_STRESS);
        }
        Log.d(TAG, sdkVersion);
        mNskAlgoSdk.setOnECGAlgoIndexListener((type, value) -> {
            Log.d("setOnECGAlgoIndexListener","type"+type+"value"+value);
            switch (type) {
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_HR:// 心率
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_HEART_RATE, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_ROBUST_HR:// 稳定的心率
                    if (mEcgListener != null && value > 0) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_ROBUST_HR, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_MOOD:// 心情指数
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_MOOD, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_R2R:// RR间隔
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_R2R, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_HRV:// 心率变异性
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_HRV, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_HEARTAGE:// 心脏年龄
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_HEART_AGE, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_RDETECTED:// 检测到R
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_R_DETECTED, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_SMOOTH:// 滤波ECG曲线
                    if (outputArrayData) {
                        if (pkgIndex % pkgLen == 0) {
                            pkgIndex = 0;
                            outputPkg = new int[pkgLen];
                        }
                        outputPkg[pkgIndex] = value;
                        pkgIndex++;
                        if (mEcgListener != null && pkgIndex == pkgLen) {
                            // mEcgListener.onDrawWave(outputPkg);
                        }
                    } else {
                        if (mEcgListener != null) {
                            mEcgListener.onDrawWave(value);
                        }
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_STRESS:// 压力指数（精神压力）
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_STRESS, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_HEARTBEAT:// 心跳
                    if (mEcgListener != null) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_HEART_BEAT, value);
                    }
                    break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_RESPIRATORY_RATE:// 呼吸率
                    if (mEcgListener != null && value > 0) {
                        mEcgListener.onECGValues(Constant.ECG_KEY_RESPIRATORY_RATE, value);
                    }
                    break;
                // case NskAlgoECGValueType.NSK_ALGO_ECG_VALUE_TYPE_BASELINE_UPDATED://基线更新通知
                // String s =
                // Arrays.toString(NskAlgoSdk.NskAlgoProfileGetBaseline(activeProfile,
                // NskAlgoType.NSK_ALGO_TYPE_ECG_HEARTRATE));
                // Log.e(TAG, "Update baseline:" + s);
                // PreferenceManager.getDefaultSharedPreferences(mContext)
                // .edit()
                // .putString("ecgbaseline", s)
                // .apply();
                // break;
                case NskAlgoECGValueType.NSK_ALGO_ECG_TYPE_UNKNOWN:// 未知
                default:
                    break;
            }
        });
    }

    public void setOnEcgResultListener(EcgListener listener) {
        this.mEcgListener = listener;
    }

    public void startECG() {
        ecgDataIndex=0;
        NskAlgoSdk.NskAlgoStart(false);
        
    }

    public void stopECG() {
        NskAlgoSdk.NskAlgoPause();
        NskAlgoSdk.NskAlgoStop();
    }

    public void dealEcgVal(int[] bytes) {
        for (int b : bytes) {
            if (ecgDataIndex == 0 || ecgDataIndex % 256 == 0) {
                // send the good signal for every half second
                short[] pqValue = { (short) 200 };
                NskAlgoSdk.NskAlgoDataStream(NskAlgoDataType.NSK_ALGO_DATA_TYPE_ECG_PQ, pqValue, 1);
            }
            Log.d("dealEcgVal",""+b);
            NskAlgoSdk.NskAlgoDataStream(NskAlgoDataType.NSK_ALGO_DATA_TYPE_ECG, new short[] { (short) b }, 1);
            ecgDataIndex++;
        }

        // Log.e("dealEcgVal",Arrays.toString(bytes));
        // for (int b : bytes) {
        // int dataRec = (b & 0xff);
        // Log.e("dealEcgVal",dataRec+""+"ecgStageFlag="+ecgStageFlag);
        // if (ecgStageFlag == 0) {
        // if (dataRec == 0xaa) {
        // Log.e("czq", "dataRec:" + dataRec + ", b:" + Integer.toHexString(b & 0xff));
        // ecgStageFlag++;
        // }
        // } else if (ecgStageFlag == 1) {
        // if (dataRec == 0xaa) {

        // ecgStageFlag++;
        // } else {
        // ecgStageFlag = 0;
        // }
        // } else if (ecgStageFlag == 2) {
        // if (dataRec == 0x12) {
        // ecgStageFlag++;
        // } else {
        // ecgStageFlag = 0;
        // }
        // } else if (ecgStageFlag == 3) {
        // if (dataRec == 0x02) {
        // ecgStageFlag++;
        // //包头
        // } else {
        // ecgStageFlag = 0;
        // }
        // } else if (ecgStageFlag == 4) {
        // if (dataRec == 0x00) {
        // Log.e("czq", "手指离开ECG传感器");
        // if (isFingerTouchOnSensor && !outputRawData) {//手指由接触转未接触时，暂停计算
        // NskAlgoSdk.NskAlgoPause();
        // NskAlgoSdk.NskAlgoStop();
        // }
        // isFingerTouchOnSensor = false;
        // } else if (dataRec == 0xC8) {
        // Log.e("czq", "手指放在ECG传感器上");
        // pkgIndex = 0;
        // if (!isFingerTouchOnSensor && !outputRawData) {//手指由未接触转接触时，开始计算
        // NskAlgoSdk.NskAlgoStart(false);
        // }
        // isFingerTouchOnSensor = true;
        // }
        // if (mEcgListener != null) {
        // mEcgListener.onFingerDetection(isFingerTouchOnSensor);
        // }
        // ecgStageFlag++;
        // } else if (ecgStageFlag >= 5 && ecgStageFlag <= 21) {
        // ecgStageFlag++;
        // } else if (ecgStageFlag >= 22 && ecgStageFlag <= 1045) {
        // // 有效数据
        // Log.e("czq", "有效数据");
        // if (ecgStageFlag % 2 == 0) {
        // dataEcg = dataRec << 8;
        // } else {
        // dataEcg += dataRec;
        // // 调用算法
        // if (dataEcg >= 32768) {
        // dataEcg -= 65536;
        // }
        // if (outputRawData) {
        // if (isFingerTouchOnSensor) {
        // //callback raw data
        // if (outputArrayData) {
        // if (pkgIndex % pkgLen == 0) {
        // pkgIndex = 0;
        // outputPkg = new int[pkgLen];
        // }
        // outputPkg[pkgIndex] = dataEcg;
        // pkgIndex++;
        // if (mEcgListener != null && pkgIndex == pkgLen) {
        // // mEcgListener.onDrawWave(outputPkg);
        // }
        // } else {
        // if (mEcgListener != null) {
        // mEcgListener.onDrawWave(dataEcg);
        // }
        // }
        // }
        // } else {
        // //deal data by Algo
        // if (ecgDataIndex == 0 || ecgDataIndex % 256 == 0) {
        // // send the good signal for every half second
        // short[] pqValue = {(short) 200};
        // NskAlgoSdk.NskAlgoDataStream(NskAlgoDataType.NSK_ALGO_DATA_TYPE_ECG_PQ,
        // pqValue, 1);
        // }
        // NskAlgoSdk.NskAlgoDataStream(NskAlgoDataType.NSK_ALGO_DATA_TYPE_ECG, new
        // short[]{(short) dataEcg}, 1);
        // }
        // ecgDataIndex++;
        // }
        // ecgStageFlag = ecgStageFlag == 1045 ? 0 : ecgStageFlag + 1;
        // } else {
        // Log.e("czq", "ecgStageFlag=0");
        // ecgStageFlag = 0;
        // }
        // }
    }

}
