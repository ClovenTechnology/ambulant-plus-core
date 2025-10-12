

import SDK from '../lib/ringSDK';
import { bleModule } from '../module/BleModule'
import { formatDateTime, formatNowTime, addOneSecond, formatDateTimeToHms } from '../utils/TimeFormat'
import { HealthViewModel } from './HealthViewModel';
import {
    NativeModules, NativeEventEmitter, Dimensions
} from "react-native";
import { requestWebEcgData, registerDevice, uploadPpgRecord, getPpgResult } from '../http/httpManager';
import { useState, useRef } from "react";
import FileUtils from '../utils/FileUtils'

let ecgArray = [];
let sportEndTimeOut = null;
let drawInterval = null;
let irDrawInterval = null;
let redDrawInterval = null;
let HeartRateProgress = "";
let HRVProgress = "";
let CardiacArrhythmiaDetectionProgress = "";
let PressureIndexProgress = "";
let EnergyConsumptionProgress = "";

let hrValue = 0;
let hrvValue = 0;
let moodValue = 0;
let respiratoryRateE = 0;
let maxRR = 0;
let minRR = 0;
const screenWidth = Dimensions.get('window').width;
export function mainViewModel(store) {

    const { NativeEcgModule, BpModule } = NativeModules;
    const ecgEmitter = new NativeEventEmitter(NativeEcgModule);
    const healthViewModel = HealthViewModel();

    const [isDateShow, setIsDateShow] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    //卡路里


    const [calorie, setCalorie] = useState()
    //血氧测试时间间隔
    const [oxMeasurementTimeInterval, setOxMeasurementTimeInterval] = useState("");

    //血氧测试开关
    const [oxMeasurementSwitch, setOxMeasurementSwitch] = useState("");

    //心率测量时间
    const [heartRateTime, setHeartRateTime] = useState("");

    //sport mode dialog visible
    const [sportModeModalVisible, setSportModeModalVisible] = useState(false);

    const sportStart = useRef(false);

    const [stepThreshold, setStepThreshold] = useState("");

    //health
    const [heartData, setHeartData] = useState({
        heartValue: 0,
        hrvValue: 0
    });
    const [healthData, setHealthData] = useState({
        oxValue: 0,
        heartValue: 0,
    });

    //ecg
    const ecgDataBuffer = useRef([]); // Used for temporary storage of data
    const dataCollectionStart = useRef(false); // Record the start of data collection
    const enoughDate = useRef(false); // Whether there is enough data to draw the chart
    const [ecgWave, setEcgWave] = useState(0);
    const [updateEcg, setUpdateEcg] = useState(false);
    const [ecgPrint, setEcgPrint] = useState("");
    const [ecgResult, setEcgResult] = useState("");
    const currentEcgMode = useRef();
    const isFingerTouch = useRef(false);
    const toastRef = useRef(null);
    const [swing, setSwing] = useState(1);

    //battery
    const [battery, setBattery] = useState({
        batteryValue: 0,
        status: 0,
        batteryPer: 0
    })

    //device1
    const [device1Value, setDevice1Value] = useState({
        color: 0,
        size: 0,
        bleAddress: 0,
        deviceVer: 0
    });
    //device2
    const [device2Value, setDevice2Value] = useState({
        sn: 0,
    });
    //device5
    const [device5Value, setDevice5Value] = useState({

    });
    //history
    const [getHistoryStart, setHistoryStart] = useState(false)
    const [history, setHistory] = useState("")
    const [progress, setProgress] = useState([])
    const [oldHistoryModalVisible, setOldHistoryModalVisible] = useState(false)
    const endUUID = useRef(0);
    const startUUID = useRef(0);
    const historyNum = useRef(0);
    const historyCount = useRef(0);

    //temperature
    const [temperatureValue, setTemperatureValue] = useState(0);
    //repackage
    const [rePackage, setRePackage] = useState(
        {
            cmd: 0,
            result: 0,
            reason: ""
        }
    )
    const currentCmd = useRef();

    //oem 认证结果
    const [oemResult, setOemResult] = useState('')
    const startOem = useRef(false);
    //ir
    const [waveData, setWaveData] = useState([]);
    const [irWaveData, setIrWaveData] = useState([]);
    const [redWaveData, setRedWaveData] = useState([]);
    const waveList = useRef([]);
    const redWaveList = useRef([]);
    const irWaveList = useRef([]);
    const drawWaveStart = useRef(true);
    const drawIrWaveStart = useRef(true);
    const drawRedWaveStart = useRef(true);

    //step 
    const [step, setStepValue] = useState(0);

    const [adjust86176Value, setAdjust86176Value] = useState("");

    //bind device status
    const [deviceBindStatus, setDeviceBindStatus] = useState("");
    const [deviceUnBindStatus, setDeviceUnBindStatus] = useState("");
    //shut down
    const [shutDownStatus, setShutDownStatus] = useState("");
    //restart
    const [restartStatus, setRestartStatus] = useState("");
    //restore factory settings
    const [restoreFactorySettingsStatus, setRestoreFactorySettingsStatus] = useState("");
    //clean historical data
    const [cleanHistoricalDataStatus, setCleanHistoricalDataStatus] = useState("");
    //time sync
    const [timeSyncStatus, setTimeSyncStatus] = useState("");
    //step threshold
    const [stepThresholdResult, setStepThresholdResult] = useState("");

    var mArray = useRef([]);
    var mHrArray = useRef([]);
    var historyDatas = useRef([]);

    //bp
    var isBpMeasuring = useRef(false);

    const bleName = useRef("");

    //history dialog
    function handleOpenOldHistoryDialog() {
        setOldHistoryModalVisible(true)
    }

    function handleOldHistoryCloseDialog() {
        setOldHistoryModalVisible(false)
    }

    //Obtain heart rate and blood oxygen
    const healthListener = {
        onResult: (data) => {
            console.log(`healthListener data=${JSON.stringify(data)}`);
            if (data && data.status == 2) {
                if (data.oxValue == 0) {
                    setHeartData({
                        heartValue: data.heartValue,
                        hrvValue: data.hrvValue,
                    })
                } else {
                    if (data.oxValue >= 95) {
                        var ox = data.oxValue >= 100 ? 99 : data.oxValue;
                        setHealthData({
                            oxValue: ox,
                            heartValue: data.heartValue,
                        })
                    }
                }
            }
        }
    }
    // const ecgData = useRef([]);
    //ECG raw data listening callback function
    const ecgRawDataListener = {
        onResult: (data) => {
            if (isBpMeasuring.current) {
                return;
            }
            // console.log(`ecgRawDataListener data=${JSON.stringify(data)}`);
            if (isFingerTouch.current) {
                if (!dataCollectionStart.current) {
                    dataCollectionStart.current = true; // 初始化开始时间
                    ecgDataBuffer.current = []; // 清空缓冲区
                    // ecgData.current = []; // 清空数据
                    enoughDate.current = false; // 标记数据是否足够绘制图表
                }
                if (ecgDataBuffer.current.length > 20000 && !enoughDate.current) {
                    enoughDate.current = true
                    stopRawEcg();
                } else {
                    ecgDataBuffer.current.push(...data.ecgList.map(item => Math.floor(SDK.convertToVoltage(item))));
                    // ecgData.current.push(...data.ecgList);
                    //Send the raw data into the software algorithm library
                    console.log(`ecgRawDataListener data=${JSON.stringify(data)}`);
                    NativeEcgModule.dealData(data.ecgList);
                }
            } else {
                dataCollectionStart.current = false;
                enoughDate.current = false;
                ecgDataBuffer.current = [];
                // ecgData.current = [];
            }
        }
    }
    function startRawEcg() {
        dataCollectionStart.current = false;
        NativeEcgModule.startECG();
        setSwing(0);
        ecgArray = [];
        maxRR = 0;
        minRR = 0;
        hrvValue = 0;
        moodValue = 0;
        currentEcgMode.current = SDK.DISP_SRC.RAW_DATA
        sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.OPEN, dispSrc: SDK.DISP_SRC.RAW_DATA });
    }
    function stopRawEcg() {
        NativeEcgModule.stopECG();
        sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.CLOSE, dispSrc: SDK.DISP_SRC.RAW_DATA });
    }
    function showEcgPrint() {
        return currentEcgMode.current === SDK.DISP_SRC.RAW_DATA && ecgPrint
    }
    //ECG algorithm data listening callback function  {SR28 is not supported}
    const ecgAlgorithmDataListener = {
        onResult: (data) => {
            if (!isFingerTouch.current) {
                return;
            }
            if (data.ecgList) {
                ecgArray.push(...data.ecgList);
                // saveEcgData.push(...data.ecgList);
                if (ecgArray.length > Math.floor(screenWidth * 4)) {
                    setEcgWave(ecgArray);
                    setUpdateEcg(!updateEcg);
                    ecgArray = [];
                }
            }
        }
    }

    function startRawEcgWithBSECURAlgorithm() {
        NativeEcgModule.startECG();
        resetProgress();
        setSwing(0);
        ecgArray = [];
        maxRR = 0;
        minRR = 0;
        hrvValue = 0;
        moodValue = 0;
        currentEcgMode.current = SDK.DISP_SRC.RAW_DATA_WITH_BSECUR_ALGORITHM
        sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.OPEN, dispSrc: SDK.DISP_SRC.RAW_DATA_WITH_BSECUR_ALGORITHM });
    }

    function stopRawEcgWithBSECURAlgorithm() {
        NativeEcgModule.stopECG();
        sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.CLOSE, dispSrc: SDK.DISP_SRC.RAW_DATA_WITH_BSECUR_ALGORITHM });
    }

    function startEcgAlgorithm() {
        setSwing(1);
        // isStartEcg = true;
        // saveEcgData = [];
        resetProgress();
        ecgArray = [];
        maxRR = 0;
        minRR = 0;
        currentEcgMode.current = SDK.DISP_SRC.ALGORITHM_LIBRARY_DATA
        sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.OPEN, dispSrc: SDK.DISP_SRC.ALGORITHM_LIBRARY_DATA });
    }

    function stopEcgAlgorithm() {
        sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.CLOSE, dispSrc: SDK.DISP_SRC.ALGORITHM_LIBRARY_DATA });
    }
    //{SR28 is not supported}
    const ecgAlgorithmResultListener = {
        onResult: (data) => {
            let checkResult = ""
            switch (data.resultOfArrhythmia) {
                case SDK.EcgCheckResult.INCOMPLETE_NO_RESULT:
                    checkResult = "Arrhythmic examination not completed with no results.";
                    break;
                case SDK.EcgCheckResult.COMPLETE_NO_ABNORMALITY:
                    checkResult = "Arrhythmic examination completed, no abnormal events found. ";
                    break;
                case SDK.EcgCheckResult.INSUFFICIENT_DATA:
                    switch (SDK.ecgUnreadable_reasons) {
                        case data.low_amplitude:
                            checkResult = "The amplitude of the electrocardiogram is very low, please make sure the contact surface is clean, and then try again. "
                            break;
                        case data.significant_noise:
                            checkResult = "There is obvious noise in the electrocardiogram signal, please make sure the device is not held too tightly, and then try again. "
                            break;
                        case data.unstable_signal:
                            checkResult = "The electrocardiogram signal is unstable, please keep it still, and then try again. "
                            break;
                        case data.not_enough_data:
                            checkResult = "There is not enough data, please make sure you keep it still, and then try again"
                            break;
                    }
                    break;
                case SDK.EcgCheckResult.BRADYCARDIA_DETECTED:
                    checkResult = "Arrhythmic examination completed and bradycardia detected.";
                    break;
                case SDK.EcgCheckResult.ATRIAL_FIBRILLATION_DETECTED:
                    checkResult = "Arrhythmia detection completed, atrial fibrillation detected.";
                    break;
                case SDK.EcgCheckResult.TACHYCARDIA_DETECTED:
                    checkResult = "Arrhythmic examination completed, detected tachycardia. ";
                    break;
                case SDK.EcgCheckResult.ABNORMALITY_DETECTED_UNSPECIFIED:
                    checkResult = "Arrhythmic examination completed, with abnormalities. However, bradycardia, atrial fibrillation, and tachycardia cannot be confirmed";
                    break;
            }
            let signalResult = ""
            switch (data.signalQuality) {
                case SDK.EcgSignalQuality.NOT_CONNECTED:
                    signalResult = "This status indicates that the electrocardiogram signal is not present. The user is not connected to the ECG device.";
                    break;
                case SDK.EcgSignalQuality.POOR_SIGNAL_QUALITY:
                    signalResult = "This status indicates that the user is connected to the electrocardiogram device, but the electrocardiogram signal quality is poor and the heartbeat cannot be determined. This can" +
                        "It can be due to excessive noise on the electrocardiogram signal. No electrocardiogram algorithm can operate at this level of signal quality Okay.";
                    break;
                case SDK.EcgSignalQuality.SIGNAL_WITH_NOISY_HEARTBEAT:
                    signalResult = "This state indicates that the heartbeat can be determined in the electrocardiogram signal, but a large amount of noise has been detected in the signal. In this kind of" +
                        "User verification/identification cannot be performed at signal quality levels.";
                    break;
                case SDK.EcgSignalQuality.CLEAR_SIGNAL:
                    signalResult = "This state indicates that the heartbeat can be determined in the electrocardiogram signal, and the signal is clear enough without noise interference, suitable for" +
                        "Run all electrocardiogram algorithms.";
                    break;
                default:
                    break;
            }
            let connectResult = data.present ? "User connected to electrocardiogram device" : "The user is not connected to the electrocardiogram device";
            let alive = data.alive ? "User heartbeat detected" : "No user heartbeat detected";
            let avgHr = data.avgHr;

            switch (data.progressType) {
                case SDK.ProcessType.HeartRate:
                    HeartRateProgress = data.progress;
                    break;
                case SDK.ProcessType.HRV:
                    HRVProgress = data.progress;
                    break;
                case SDK.ProcessType.CardiacArrhythmiaDetection:
                    CardiacArrhythmiaDetectionProgress = data.progress;
                    break;
                case SDK.ProcessType.PressureIndex:
                    PressureIndexProgress = data.progress;
                    break;
                case SDK.ProcessType.EnergyConsumption:
                    EnergyConsumptionProgress = data.progress;
                    break;
            }
            let result = `heartRate=${data.heartRate}  checkResult=${checkResult} \n rmssd=${data.rmssd} sdnn=${data.sdnn}  pressureIndex=${data.pressureIndex} bmr=${data.bmr} 
            active_cal=${data.active_cal}  signalQuality=${signalResult}  present=${connectResult}  alive=${alive}  
            avgHr=${avgHr}  HeartRateProgress=${HeartRateProgress} HRVProgress=${HRVProgress} 
            CardiacArrhythmiaDetectionProgress=${CardiacArrhythmiaDetectionProgress} PressureIndexProgress=${PressureIndexProgress}  
            EnergyConsumptionProgress=${EnergyConsumptionProgress}`
            setEcgResult(result);
        }
    }

    function resetProgress() {
        HeartRateProgress = "";
        HRVProgress = "";
        CardiacArrhythmiaDetectionProgress = "";
        PressureIndexProgress = "";
        EnergyConsumptionProgress = "";
    }

    //BATTERY INFORMATION
    const batteryDataAndStateListener = {
        onResult: (data) => {
            if (data) {
                var isWireless = false;
                if (bleName.current) {
                    isWireless = bleName.current.toUpperCase().indexOf('W') == -1 ? false : true;
                }
                var charging = data.status == 1
                var result = charging ? "charging" : "uncharged";
                var batteryPer = 0
                console.log(`  data.batteryPer=${data.batteryPer} `);
                if (data.batteryPer) {
                    batteryPer = data.batteryPer;
                } else {
                    batteryPer = SDK.calcBattery(data.batteryValue, charging, isWireless);
                }
                var isSleep = data.isSleep ==1 ? "sleep" : "awake";
                var isWear = data.isWear ==1 ? "wear" : "noWear";
                setBattery({
                    batteryValue: data.batteryValue,
                    status: result,
                    batteryPer,
                    isSleep,
                    isWear,
                })
            }
        }
    }

    //Device Information 1
    //Black 0x00, Silver 0x01, Gold 0x02, Rose Gold 0x03, Gold/Silver Mix 0x04, Purple/
    //Silver Mix Color 0x05, Rose Gold/Silver Mix Color 0x06, Brushed Silver 0x07, Black Matte 0x08,Dark Grey 0x09
    const deviceInfo1Listener = {
        onResult: (data) => {
            if (data) {
                var color = ""
                if (data.color == 0) {
                    color = "Deep Black"
                } else if (data.color == 1) {
                    color = "Silver"
                } else if (data.color == 2) {
                    color = "Gold"
                } else if (data.color == 3) {
                    color = "Rose Gold"
                } else if (data.color == 4) {
                    color = "Gold/Silver Mix"
                } else if (data.color == 5) {
                    color = "Purple/Silver Mix Color"
                } else if (data.color == 6) {
                    color = "Rose Gold/Silver Mix Color"
                } else if (data.color == 7) {
                    color = "Brushed Silver"
                } else if (data.color == 8) {
                    color = "Black Matte"
                } else if (data.color == 9) {
                    color = "dark grey"
                }
                setDevice1Value({
                    color,
                    size: data.size,
                    bleAddress: data.bleAddress,
                    deviceVer: data.deviceVer,
                    switchOem: data.switchOem,
                    chargingMode: data.chargingMode,
                    mainChipModel: data.mainChipModel,
                    productIteration: data.productIteration,
                    hasSportsMode: data.hasSportsMode,
                    isSupportEcg: data.isSupportEcg,
                    isEcgAlgorithm: data.isEcgAlgorithm,//only support SR28 rings
                    isPpgAlgorithm: data.isPpgAlgorithm,//only support SR28 rings
                    deviceType: data.deviceType,
                })
                //deviceType: 
                //0x10 : SR03
                //0x20 : SR09W 无线充电
                //0x21 : SR09N NFC充电
                //0x30 : SR23 NFC充电
                //0x31 : SR28 NFC充电
                //0x40 : SR26
                console.log(` device1Value.hasSportsMode=${device1Value.hasSportsMode} deviceType=${device1Value.deviceType} `)
                setIsOemEnabled(data.switchOem == 1);
                if (data.switchOem && startOem.current) {
                    startOem.current = false
                    //Start oem certification
                    console.log(`  startOEMVerify============= SDK.OEM_TYPE=${JSON.stringify(SDK.OEM_TYPE)} `)
                    SDK.startOEMVerify(SDK.OEM_TYPE.CIRCULAR, (cmd, data) => {
                        sendData(cmd, data)
                    })
                }
            }

        }
    }

    //Device Information 2
    const deviceInfo2Listener = {
        onResult: (data) => {
            sn.current = data.sn;
            setDevice2Value({
                sn: data.sn,
                bindStatus: data.bindStatus,
                samplingRate: data.samplingRate,
            })
        }
    }
    //Device Information 5
    const deviceInfo5Listener = {
        onResult: (data) => {
            setDevice5Value({
                hrMeasurementTime: data.hrMeasurementTime,
                oxMeasurementInterval: data.oxMeasurementInterval,
                oxMeasurementSwitch: data.oxMeasurementSwitch
            })
        }
    }

    //get old History data
    function getOldHistoryData() {
        mArray.current = [];
        mHrArray.current = [];
        historyDatas.current = [];
        endUUID.current = 0;
        sendData(SDK.SendCmd.historicalNum);
        setTimeout(() => { sendData(SDK.SendCmd.historicalData) }, 500);
    }

    //old History Data
    const historicalDataListener = {
        onResult: async (data) => {
            console.log(` historicalDataListener data=${JSON.stringify(data)}`);
            setHistoryStart(true)
            setProgress("start")
            if (endUUID.current == 0) {
                setProgress("end")
                setHistoryStart(false)
                return
            }
            if (data.uuid != endUUID.current) {
                if (data.uuid % 100 == 0) {
                    setProgress(`start ${data.uuid - startUUID.current}/${endUUID.current - startUUID.current} pieces`)
                }

                historyDatas.current.push(data);
                console.log(` uuid=${data.uuid} endUUID=${endUUID.current} length=${historyDatas.current.length} data=${JSON.stringify(data)}`)
            } else {
                historyDatas.current.push(data);
                setHistoryStart(false)
                //Save historical data and sleep data to the database
                healthViewModel.storeHistoryAndSleepDataToDatabase(historyDatas.current);
                dealHistoryData(historyDatas.current);
                // setIsGetHistory(true);
            }
        }
    }

    const dealHistoryData = (arr) => {
        console.log(` dealHistoryData  arr=${arr.length} `)
        let historyData = []
        for (let index = 0; index < arr.length; index++) {
            const data = arr[index];
            console.log(`  data.hrv=${data.hrv}  formatDateTime=${formatDateTime(data.timeStamp)}`)
            // if (data.hrv > 0) {
            var wearStatus = data.wearStatus == 1 ? "wear" : "noWear";
            var chargeStatus = data.chargeStatus == 1 ? "charging" : "uncharged";
            var detectionModeStatus = data.detectionMode == 1 ? "BloodOxygenMode" : "HeartRateMode"
            historyData.push({
                timeStamp: data.timeStamp,
                heartRate: data.heartRate,
                motionDetectionCount: data.motionDetectionCount,
                detectionMode: detectionModeStatus,
                wearStatus: wearStatus,
                chargeStatus: chargeStatus,
                uuid: data.uuid,
                hrv: data.hrv,
                temperature: data.temperature,
                step: data.step,
                ox: data.ox,
                rawHr: data.rawHr,
                sportsMode: data.sportsMode,
                batteryLevel: data.batteryLevel
            })
            // }
            var isBadData = false
            if (data.rawHr == null) {
                isBadData = false
            } else if (data.rawHr.length == 3 && data.rawHr[0] == 200 && data.rawHr[1] == 200 && data.rawHr[2] == 200) {
                isBadData = true
            }

            if (data.heartRate >= 50 && data.heartRate <= 175 && data.wearStatus == 1 && data.chargeStatus == 0 && !isBadData) {
                console.log(` formatDateTime=${formatDateTime(data.timeStamp)}`)
                mArray.current.push({
                    ts: data.timeStamp,
                    hr: data.heartRate,
                    hrv: data.hrv,
                    motion: data.motionDetectionCount,
                    steps: data.step,
                    ox: data.ox
                })
            }
            if (data.heartRate >= 60 && data.heartRate <= 175 && data.wearStatus == 1 && data.chargeStatus == 0 && !isBadData) {
                mHrArray.current.push({
                    ts: data.timeStamp,
                    hr: data.heartRate,
                })
            }
        }
        if (historyData.length > 0) {
            const jsonStringArray = historyData.map(item =>
                JSON.stringify(item)
            );
            const oldHistoryString = jsonStringArray.join('\n');
            setHistory(oldHistoryString)
            //add history data to text file
            // FileUtils.writeHistoryFile(oldHistoryString).then((data)=>{
            //     console.log(` writeHistoryFile success data=${data}`)
            // })
        }

    }


    // var arr = FileUtils.readFileAssets();
    // console.log(`arr=${arr} length=${arr.length}`)
    // dealHistoryData(arr);

    //Number of historical data
    const historicalNumListener = {
        onResult: (data) => {
            endUUID.current = data.maxUUID
            startUUID.current = data.minUUID
            console.log(`Number of historical data data=${JSON.stringify(data)}`)
        }
    }


    //Finger temperature
    const temperatureListener = {
        onResult: (data) => {
            if (data) {
                setTemperatureValue(data);
            }
        }
    }

    //Repackaging
    const rePackageListener = {
        onResult: (data) => {
            if (data) {
                setRePackage(
                    {
                        cmd: data.cmd,
                        result: data.result,
                        reason: data.reason,
                        subCmd: data.subCmd,//仅支持SR28戒指，用于锻炼，返回锻炼下发命令
                    }
                )
                dealStatus(data);
            }
        }
    }
    //OEM certification result
    const oemResultListener = {
        onResult: (data) => {
            var result = data ? "Verification successful" : "Verification fail"
            setOemResult(result);
        }
    }

    const irResouceListener = {
        onResult: (data) => {
            waveList.current.push(...data);
            console.log(` =====================irResouceListener=${waveList.current.length}`);
            if (waveList.current.length >= 600 && drawWaveStart.current) {
                drawWaveStart.current = false
                if (drawInterval) {
                    clearInterval(drawInterval)
                }
                startDraw()
            }
        }
    }

    const startDraw = () => {
        drawInterval = setInterval(() => {
            let arr = waveList.current.map(function (value, index) {
                if (index >= 0 && index <= 600) {
                    return value;
                } else {
                    return null;
                }
            }).filter(function (value) {
                return value !== null;
            });
            setWaveData(arr);
            console.log(` startDraw waveList=${waveList.current.length} `)
            waveList.current.splice(0, 80);
        }, 1000)
    }

    const stopDraw = () => {
        if (drawInterval) {
            clearInterval(drawInterval)
        }
        if (irDrawInterval) {
            clearInterval(irDrawInterval)
        }
        if (redDrawInterval) {
            clearInterval(redDrawInterval)
        }
    }

    function initWave() {
        waveList.current = [];
        irWaveData.current = [];
        redWaveList.current = [];
        drawWaveStart.current = true;
        drawIrWaveStart.current = true;
    }

    const getPath = () => {
        let max = Math.max(...waveData);
        let min = Math.min(...waveData);
        const dp = Math.abs(max - min) / 75;
        const path = waveData.reduce((acc, value, index) => {
            const x = index;
            // const y = 125 - (value - min) / dp;
            const y = (value - min) / dp;
            console.log(` y=${y} dp=${dp} min=${min} max=${max} value=${value}`)
            if (index === 0) {
                return `M ${x} ${y}`;
            } else {
                return `${acc} L ${x} ${y}`;
            }
        }, '');
        return path;
    };

    const irOrRedListener = {
        onResult: (data) => {
            irWaveList.current.push(...data.irOrGreen);
            redWaveList.current.push(...data.redOrGreen);
            console.log(` ==========irOrRedListener=${irWaveList.current.length} redWaveList=${redWaveList.current.length}`);

            // console.log(` irWaveList=${JSON.stringify(irWaveList)} redWaveList=${JSON.stringify(redWaveList)}`);
            // console.log(` irWaveList=${irWaveList.current.length} redWaveList=${redWaveList.current.length} `);
            if (irWaveList.current.length >= 600 && drawIrWaveStart.current) {
                drawIrWaveStart.current = false
                if (irDrawInterval) {
                    clearInterval(irDrawInterval)
                }
                startIrDraw();
            }
            if (redWaveList.current.length >= 600 && drawRedWaveStart.current) {
                drawRedWaveStart.current = false
                if (redDrawInterval) {
                    clearInterval(redDrawInterval)
                }
                startRedDraw();
            }
        }
    }

    const startIrDraw = () => {
        irDrawInterval = setInterval(() => {
            let arr = irWaveList.current.map(function (value, index) {
                if (index >= 0 && index <= 600) {
                    return value;
                } else {
                    return null;
                }
            }).filter(function (value) {
                return value !== null;
            });
            setIrWaveData(arr);
            irWaveList.current.splice(0, 20);
            console.log(` startIrDraw irWaveList=${irWaveList.current.length} `)
        }, 1000)
    }

    const getIrPath = () => {
        let max = Math.max(...irWaveData);
        let min = Math.min(...irWaveData);
        const dp = Math.abs(max - min) / 75;
        const path = irWaveData.reduce((acc, value, index) => {
            const x = index;
            // const y = 125 - (value - min) / dp;
            const y = (value - min) / dp;
            if (index === 0) {
                return `M ${x} ${y}`;
            } else {
                return `${acc} L ${x} ${y}`;
            }
        }, '');
        return path;
    };

    const startRedDraw = () => {
        redDrawInterval = setInterval(() => {
            let arr = redWaveList.current.map(function (value, index) {
                if (index >= 0 && index <= 600) {
                    return value;
                } else {
                    return null;
                }
            }).filter(function (value) {
                return value !== null;
            });
            setRedWaveData(arr);
            redWaveList.current.splice(0, 20);
        }, 1000)
    }

    const getRedPath = () => {
        let max = Math.max(...redWaveData);
        let min = Math.min(...redWaveData);
        const dp = Math.abs(max - min) / 75;
        if (dp != 0) {
            const path = redWaveData.reduce((acc, value, index) => {
                const x = index;
                // const y = 125 - (value - min) / dp;
                const y = (value - min) / dp;
                if (index === 0) {
                    return `M ${x} ${y}`;
                } else {
                    return `${acc} L ${x} ${y}`;
                }
            }, '');
            return path;
        }

    };


    const ecgFingerDetectListener = {
        onResult: (data) => {
            isFingerTouch.current = data.fingerDetect == 1;
            if (!isFingerTouch.current) {
                showToast("Finger not touch detected");
            }
            console.log(`ecgFingerDetectListener isFingerTouch=${isFingerTouch.current} `)
        }
    }

    const registerEcg = () => {
        ecgEmitter.addListener(
            'ecgWaveListener',
            (data) => {
                if (data.value) {
                    if (data.value && !isBpMeasuring.current) {
                        console.log(`ecgWaveListener_main data=${data.value}`)
                        // saveNskEcgData.push(data.value);
                        ecgArray.push(data.value);
                        if (ecgArray.length > Math.floor(screenWidth * 4)) {
                            setEcgWave(ecgArray);
                            setUpdateEcg(!updateEcg);
                            ecgArray = [];
                        }
                    }
                }
            }
        );

        ecgEmitter.addListener(
            'ecgValueListener',
            (data) => {
                if (isBpMeasuring.current) {
                    return
                }
                switch (data.type) {
                    case 'HR':
                        hrValue = data.value;
                        break;
                    case 'HRV':
                        hrvValue = data.value;
                        if (moodValue != 0 && currentEcgMode.current === SDK.DISP_SRC.RAW_DATA) {
                            sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.CLOSE, dispSrc: SDK.DISP_SRC.RAW_DATA });
                        }
                        break;
                    case 'Mood Index':
                        moodValue = data.value;
                        if (hrvValue != 0 && currentEcgMode.current === SDK.DISP_SRC.RAW_DATA) {
                            sendData(SDK.SendCmd.handleEcg, { samplingRate: SDK.ECG_PPG_SAMPLE_RATE.ECG_PPG_SAMPLE_RATE_512, clockFrequency: SDK.ECG_CLOCK_FREQUENCY.ECG_CLOCK_FREQUENCY_0, switch: SDK.SWITCH.CLOSE, dispSrc: SDK.DISP_SRC.RAW_DATA });
                        }
                        break;
                    case 'RESPIRATORY RATE':
                        respiratoryRateE = data.value;
                    case 'RR':
                        if (data.value > maxRR) {
                            maxRR = data.value;
                        } else if (data.value < minRR && data.value > 300) {
                            minRR = data.value;
                        } else if (minRR == 0 && data.value > 300) {
                            minRR = data.value;
                        }
                        break;
                }
                setEcgPrint(`hr=${hrValue} hrv=${hrvValue}  mood=${moodValue}  respiratoryRate=${respiratoryRateE} minRR=${minRR} maxRR=${maxRR}`);
            }
        );
    }

    const showToast = (message) => {
        // 显示一个简单的Toast消息
        toastRef.current.show(message, 2000); // 2000毫秒后自动消失
    };

    //SR09 is not supported
    const stepListener = {
        onResult: (data) => {
            const { stepCount, stepAlgorithm } = data;
            console.log(`stepCount=${stepCount} stepAlgorithm=${stepAlgorithm}`)
            setStepValue(stepCount);
        }
    }

    const adjust86176Listener = {
        onResult: (data) => {
            console.log(`adjust86176Listener data=${JSON.stringify(data)}`)
            setAdjust86176Value(data);
        }
    }

    function dealStatus(data) {
        let result = data.result;
        switch (data.cmd) {
            case SDK.CMD.DeviceBindAndUnBind:
                let isBind = (currentCmd.current == SDK.SendCmd.deviceBind)
                let title = isBind ? "Device binded" : "Device unbinded";
                let status = title + result;
                // console.log(`=================currentCmd=${currentCmd.current}  deviceBind=${SDK.SendCmd.deviceBind}  isBind=${isBind} status=${status}`)
                if (isBind) {
                    setDeviceBindStatus(status)
                    setDeviceUnBindStatus("")
                } else {
                    setDeviceBindStatus("")
                    setDeviceUnBindStatus(status)
                }
                break;
            case SDK.CMD.ShutDown:
                setShutDownStatus("Shutdown" + result);
                break;
            case SDK.CMD.Restart:
                setRestartStatus("Restart" + result);
                break;
            case SDK.CMD.RestoreFactorySettings:
                setRestoreFactorySettingsStatus("Factory reset" + result);
                break;
            case SDK.CMD.CleanHistoricalData:
                setCleanHistoricalDataStatus("Clear Historical Data" + result);
                break;
            case SDK.CMD.TimeSynSettings:
                setTimeSyncStatus("Time synchronization" + result);
                break;
            case SDK.CMD.StepThreshold:
                setStepThresholdResult("set StepThreshold" + result);
                break;
            case SDK.CMD.CLEAN_HISTORY_NEW:
                setCleanHistoricalNewDataStatus("Clear Historical Data " + result);
                break;
        }
    }

    function sendData(cmd, data) {
        var result = SDK.startDetect(cmd, data);
        console.log(`sendData result=${Array.from(new Uint8Array(result))}`);
        return bleModule.write(Array.from(new Uint8Array(result)));
    }
    //Support SR09 and SR23 rings

    // const [sportModeModalVisible, setSportModeModalVisible] = useState(false);
    function handSportModeCloseDialog() {
        setSportModeModalVisible(false);
    }

    function handSportModeOpenDialog() {
        setSportModeModalVisible(true);
    }

    const handleSportModeConfirm = (sportModeSwitch, sportType, strengthGrade, personalHeight, sportModeTimeInterval, sportModeTimeDuration) => {
        console.log(` sportModeSwitch=${sportModeSwitch} sportType=${sportType} strengthGrade=${strengthGrade} personalHeight=${personalHeight} sportModeTimeInterval=${sportModeTimeInterval} sportModeTimeDuration=${sportModeTimeDuration}`)
        if (sportModeSwitch == 1) {
            startStep = 0
            endStep = 0
            sportStart.current = true
            sendData(SDK.SendCmd.step)
            setTimeout(() => {
                sendData(SDK.SendCmd.SetSportModeParameters, {
                    switch: sportModeSwitch,
                    timeInterval: sportModeTimeInterval,
                    duration: sportModeTimeDuration,
                    mode: sportType
                })
            }, 1000)
            sportEndTimeOut = setTimeout(() => {
                sportStart.current = false
                sendData(SDK.SendCmd.step)
            }, sportModeTimeDuration * 60 * 1000 + 2000)
        } else {
            sendData(SDK.SendCmd.SetSportModeParameters, {
                switch: sportModeSwitch,
                timeInterval: sportModeTimeInterval,
                duration: sportModeTimeDuration,
                mode: sportType
            })
            if (sportEndTimeOut) {
                sportStart.current = false
                sendData(SDK.SendCmd.step)
                clearTimeout(sportEndTimeOut)
            }
        }
    }

    //血氧测量设置
    const setOxMeasurementSettings = () => {
        console.log(` oxMeasurementSwitch=${oxMeasurementSwitch} oxMeasurementTimeInterval=${oxMeasurementTimeInterval} `)
        sendData(SDK.SendCmd.oxSettings, {
            switch: oxMeasurementSwitch,
            timeInterval: oxMeasurementTimeInterval,
        });
    }

    const handleHeartRateTimeChange = (inputText) => {
        console.log(` inputText ${inputText}  `)
        if (/^\d*$/.test(inputText)) {
            setHeartRateTime(inputText);
        }
    };

    const handleOxMeasurementSwitchChange = (inputText) => {
        console.log(` inputText ${inputText}  `)
        if (/^\d*$/.test(inputText)) {
            setOxMeasurementSwitch(inputText);
        }
    };

    const handleOxMeasurementTimeIntervalChange = (inputText) => {
        console.log(` inputText ${inputText}  `)
        if (/^\d*$/.test(inputText)) {
            setOxMeasurementTimeInterval(inputText);
        }
    };

    const handleStepThresholdChange = (inputText) => {
        if (/^\d*$/.test(inputText)) {
            setStepThreshold(inputText);
        }
    };


    function dateChange(event, selectedDate) {
        setIsDateShow(false);
        console.log(` event.type=${event.type} `);
        if (event.type !== 'set') {
            return;
        }
        const dateTime = selectedDate || currentDate;
        console.log(` currentDate=${currentDate} `);
        setCurrentDate(dateTime);
    }

    function showCalendar() {
        setIsDateShow(true);
    }
    //Calculate calories for a time period by obtaining the number of steps 
    //taken at the beginning and end of the time period from historical data, 
    //and combining height and strengthGrade to calculate the calories burned during this time period 
    const caloriesCalculation = (startStep, endStep) => {
        console.log(`caloriesCalculation   personalHeight=${personalHeight}  endStep=${endStep}  startStep=${startStep}`)
        if (personalHeight) {
            let step = endStep - startStep
            if (step > 0) {
                let calories = SDK.caloriesCalculation(personalHeight, step, strengthGrade);
                setCalorie(calories)
            }
        }
    }

    /////////////////////////only for SR28  start//////////////////////////////////////////
    //temperatureHistory
    const temperatureHistoryData = useRef([]);
    //excludedSwimmingActivityHistory
    const excludedSwimmingActivityHistoryData = useRef([]);
    //dailyActivityHistory
    const dailyActivityHistoryData = useRef([]);
    //dailyActivitySummary2
    const dailyActivitySummary2 = useRef([]);
    //historyDataError
    const historyDataError = useRef([]);  
    //exerciseActivityHistory
    const exerciseActivityHistoryData = useRef([]);
    //exerciseVitalSignsHistory
    const exerciseVitalSignsHistoryData = useRef([]);
    //swimmingExerciseHistory
    const swimmingExerciseHistoryData = useRef([]);
    //singleLapSwimmingHistory
    const singleLapSwimmingHistoryData = useRef([]);
    //step/Temperature/ActivityIntensityHistory
    const stepTemperatureActivityIntensityHistoryData = useRef([]);
    //sleepHistory
    const sleepHistoryData = useRef([]);
    const newAlgorithmHistoryData = useRef([]);
    //active data
    const [activeData, setActiveData] = useState({});
    //active data 2
    const [activeData2, setActiveData2] = useState({});
    //new algorithm history
    const [newAlgorithmHistory, setNewAlgorithmHistory] = useState([]);
    //history loading status
    const [loadingStatus, setLoadingStatus] = useState("");
    //startUUID
    //new history data
    const newHistoryData = useRef([]);
    //userInfo
    const [userInfo, setUserInfo] = useState({
        sex: '',
        height: '',
        weight: '',
        age: ''
    });
    //ppgMeasure
    const [ppgMeasureMode, setPpgMeasureMode] = useState(false);
    const [ppgMeasure, setPpgMeasure] = useState("");
    //ppgData
    const [ppgSwitch, setPpgSwitch] = useState(false);
    const [uploadResult, setUploadResult] = useState("");
    const [ppgMeasureResult, setPpgMeasureResult] = useState("");
    const sn = useRef(0);
    const startTime = useRef("");
    const endTime = useRef("");
    const ppgData = useRef([]);
    const ppgDataList = useRef([]);
    const zeroCount = useRef(0);
    const supplement = useRef(0);
    const currentTime = useRef(Date.now());
    const [rdModelVisible, setRDModalVisible] = useState(false);
    const handleRegisterDeviceOpenDialog = () => {
        setRDModalVisible(true);
    };

    const handleRegisterDeviceCloseDialog = () => {
        setRDModalVisible(false);
    };

    const [modalVisible, setModalVisible] = useState(false);
    const handleUserInfoOpenDialog = () => {
        setModalVisible(true);
    };
    const handleUserInfoCloseDialog = () => {
        setModalVisible(false);
    };

    const handleRegisterDeviceConfirm = async (sex, age, height, weight, familyDiabetes, highCholesterol) => {
        if (sn.current == 0) {
            sendData(SDK.SendCmd.deviceInfo2);
            await new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        }
        registerDevice({
            sn: sn.current.toString(),
            age: age,
            gender: sex,
            height: height,
            weight: weight,
            familyHistory: familyDiabetes,
            highCholesterol: highCholesterol,
        }).then(function (data) {
            console.log(`registerDevice data=${JSON.stringify(data)}`)
        });
    };

    const togglePpgSwitch = () => {
        resetPpg();
        setPpgSwitch(previousState => !previousState);
        console.log(`ppgSwitch=${ppgSwitch}`)
        sendData(SDK.SendCmd.SET_PPG, {
            on_off: ppgSwitch ? 0 : 1,
        });

    }

    const handleUploadPpgRecord = () => {
        uploadPpgRecord({
            fasting: true,
            within2HrsMeal: false,
            startTime: startTime.current,
            endTime: endTime.current,
            ppgData: ppgData.current,
        }).then((value) => {
            setUploadResult(value);
        });
    };

    const handleBloodGlucoseData = () => {
        setTimeout(() => {
            getPpgResult().then(function (data) {
                if (data != null) {
                    if (data.state == 0) {
                        if (data.data != null) {
                            var measurement_data = data.data.measurement_data;
                            setPpgMeasureResult(`lower_bound：${measurement_data.lower_bound} upper_bound：${measurement_data.upper_bound}`);
                        } else {
                            setPpgMeasureResult("no data");
                        }
                    } else if (data.state == 1) {
                        setPpgMeasureResult("sn not registered");
                    }
                }
            });
        }, 5000);
    }


    const handleUserInfoConfirm = (fuc, sex, height, weight, age) => {

        console.log('fuc:', fuc);
        console.log('sex:', sex);
        console.log('height:', height);
        console.log('weight:', weight);
        console.log('Age:', age);

        sendData(SDK.SendCmd.USER_INFO, {
            function: fuc,
            sex: sex,
            height: height,
            weight: weight,
            age: age
        });
    };
    //measurement timing
    const [measureTimingModalVisible, setMeasureTimingModalVisible] = useState(false);
    const [measurementTiming, setMeasurementTiming] = useState({});
    const handMeasureTimingOpenDialog = () => {
        setMeasureTimingModalVisible(true);
    };

    const handMeasureTimingCloseDialog = () => {
        setMeasureTimingModalVisible(false);
    };

    const handleMeasurementTimingConfirm = (fuc, type, time1, time1Interval, time2, time2Interval, time3Interval, threshold) => {

        console.log('fuc:', fuc);
        console.log('type:', type);
        console.log('time1:', time1);
        console.log('time1Interval:', time1Interval);
        console.log('time2:', time2);
        console.log('time2Interval:', time2Interval);
        console.log('time3Interval:', time3Interval);
        console.log('threshold', threshold);
        sendData(SDK.SendCmd.SET_MEASUREMENT_TIMING, {
            function: fuc,
            type: type,
            time1: time1,
            time1Interval: time1Interval,
            time2: time2,
            time2Interval: time2Interval,
            time3Interval: time3Interval,
            threshold: threshold
        });
    };

    //exercise
    const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
    const handExerciseOpenDialog = () => {
        setExerciseModalVisible(true);
    };

    const handExerciseCloseDialog = () => {
        setExerciseModalVisible(false);
    };

    const handleExerciseConfirm = (fuc, type, poolSize, exerciseTime) => {

        console.log('fuc:', fuc);
        console.log('type:', type);
        console.log('poolSize:', poolSize);
        console.log('exerciseTime:', exerciseTime);
        sendData(SDK.SendCmd.SET_EXERCISE, {
            function: fuc,
            type: type,
            poolSize: poolSize,
            exerciseTime: exerciseTime,
        });
    };

    //adjust 86176
    const [adjust86176modalVisible, set86176ModalVisible] = useState(false);
    const handle86176OpenDialog = () => {
        set86176ModalVisible(true);
    };
    const handle86176CloseDialog = () => {
        set86176ModalVisible(false);
    };

    const handleRegister86176Confirm = async (action,current,threshold) => {
        sendData(SDK.SendCmd.ADJUST_86176, {
            action: action,
            current: current,
            threshold: threshold
        });
    };

    //test mode
    const [testModeModalVisible, setTestModeModalVisible] = useState(false);
    const handleTestModeOpenDialog = () => {
        setTestModeModalVisible(true);
    };
    const handleTestModeCloseDialog = () => {
        setTestModeModalVisible(false);
    };

    const handleTestModeConfirm = async (testModeSwitch,ledTestModeSwitch,redLight,greenLight,accSwitch,oxSwitch,pdLedSpo2,hrSwitch,pdLedHr) => {
        sendData(SDK.SendCmd.TestMode, {
            test_mode_on_off: testModeSwitch,
            led_test_on_off: ledTestModeSwitch,
            led_green_on_off: greenLight,
            led_red_on_off:redLight,
            acc_on_off: accSwitch,
            blood_oxygen_test_on_off: oxSwitch,
            pd_led_spo2:pdLedSpo2,
            heart_rate_test_on_off: hrSwitch,
            pd_led_hr:pdLedHr
        });
    };
    
    //set reporting exercise
    const [reportExercise, setReportExercise] = useState("");
    const [isEnabled, setIsEnabled] = useState(false);
    const toggleSwitch = () => {
        setIsEnabled(previousState => !previousState);
        sendData(SDK.SendCmd.SET_REPORTING_EXERCISE, {
            on_off: isEnabled ? 0 : 1,
        });
    }

    //switch oem
    const [isOemEnabled, setIsOemEnabled] = useState(false);
    const toggleOemSwitch = () => {
        setIsOemEnabled(previousState => !previousState);
        console.log(`toggleOemSwitch=${isOemEnabled}`)
        sendData(SDK.SendCmd.SWITCH_OEM, {
            on_off: isOemEnabled ? 0 : 1,
        });
    }

    //cleanHistoricalNewDataStatus
    const [cleanHistoricalNewDataStatus, setCleanHistoricalNewDataStatus] = useState("");

    const userInfoListener = {
        onResult: (data) => {
            console.log(`userInfoListener data=${JSON.stringify(data)}`)
            setUserInfo(data)
        }
    }

    const activityDataListener = {
        onResult: (data) => {
            console.log(`activityDataListener data=${JSON.stringify(data)}`)
            setActiveData(data);
        }
    }
    //history dialog
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    function handleHistoryOpenDialog() {
        setHistoryModalVisible(true);
    }

    function handleHistoryCloseDialog() {
        setHistoryModalVisible(false);
    }



    const newAlgorithmHistoryNumberListener = {
        onResult: (data) => {
            if (data.num == 0) {
                setLoadingStatus("no history data");
            }
            setNewAlgorithmHistory([]);
            startUUID.current = data.minUUID;
            endUUID.current = data.maxUUID;
            historyNum.current = data.num;
            console.log(`startUUID.current=${startUUID.current} endUUID.current=${endUUID.current} historyNum.current=${historyNum.current}`)
            historyCount.current = 0;
            newHistoryData.current = [];
            temperatureHistoryData.current = [];
            excludedSwimmingActivityHistoryData.current = [];
            dailyActivityHistoryData.current = [];
            dailyActivitySummary2.current = [];
            historyDataError.current = [];
            exerciseActivityHistoryData.current = [];
            exerciseVitalSignsHistoryData.current = [];
            swimmingExerciseHistoryData.current = [];
            singleLapSwimmingHistoryData.current = [];
            stepTemperatureActivityIntensityHistoryData.current = [];
            sleepHistoryData.current = [];
            newAlgorithmHistoryData.current = [];

        }
    }

    function newHistoryReceiveFinish() {
        setLoadingStatus("done");
        console.log(`newHistoryReceiveFinish newHistoryData.current.length=${newHistoryData.current.length}`)
        const array = [];
        const newHistoryDataString = newHistoryData.current.join('\n');
        const resultTemperatureString = temperatureHistoryData.current.join('\n');
        const resultExcludedSwimmingActivityString = excludedSwimmingActivityHistoryData.current.join('\n');
        const resultDailyActivityString = dailyActivityHistoryData.current.join('\n');
        const resultExerciseActivityString = exerciseActivityHistoryData.current.join('\n');
        const resultExerciseVitalSignsString = exerciseVitalSignsHistoryData.current.join('\n');
        const resultSwimmingExerciseString = swimmingExerciseHistoryData.current.join('\n');
        const resultSingleLapSwimmingString = singleLapSwimmingHistoryData.current.join('\n');
        const resultSleepString = sleepHistoryData.current.join('\n');
        const resultStepTemperatureActivityIntensityString = stepTemperatureActivityIntensityHistoryData.current.join('\n');
        const resultDailyActivitySummary2String = dailyActivitySummary2.current.join('\n');
        const resultHistoryDataErrorString = historyDataError.current.join('\n');
        array.push(newHistoryDataString);
        array.push(resultTemperatureString);
        array.push(resultExcludedSwimmingActivityString);
        array.push(resultDailyActivityString);
        array.push(resultExerciseActivityString);
        array.push(resultExerciseVitalSignsString);
        array.push(resultSwimmingExerciseString);
        array.push(resultSingleLapSwimmingString);
        array.push(resultSleepString);
        array.push(resultStepTemperatureActivityIntensityString);
        array.push(resultDailyActivitySummary2String);
        array.push(resultHistoryDataErrorString);
        setNewAlgorithmHistory(array);
    }

    const newAlgorithmHistoryDataListener = {
        onResult: (data) => {
            historyCount.current += 1;
            newHistoryData.current.push(JSON.stringify(data));
            console.log(`newAlgorithmHistoryDataListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            if (historyCount.current != historyNum.current) {
                setLoadingStatus("Loading...");
            } else {
                newHistoryReceiveFinish();
            }

        }
    }

    const temperatureHistoryDataListener = {
        onResult: (data) => {
            historyCount.current += 1;
            temperatureHistoryData.current.push(JSON.stringify(data));
            console.log(`temperatureHistoryDataListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const measurementTimingListener = {
        onResult: (data) => {
            console.log(`measurementTimingListener data=${JSON.stringify(data)}`)
            setMeasurementTiming(data)
        }
    }

    const excludedSwimmingActivityHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`excludedSwimmingActivityHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)

            excludedSwimmingActivityHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const dailyActivityHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`dailyActivityHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            dailyActivityHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const exerciseActivityHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`exerciseActivityHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            exerciseActivityHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const exerciseVitalSignsHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`exerciseVitalSignsHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            exerciseVitalSignsHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const swimmingExerciseHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`swimmingExerciseHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            swimmingExerciseHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const singleLapSwimmingHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`singleLapSwimmingHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            singleLapSwimmingHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const stepTemperatureActivityIntensityHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`stepTemperatureActivityIntensityHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            stepTemperatureActivityIntensityHistoryData.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
        }
    }

    const sleepHistoryListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`sleepHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            sleepHistoryData.current.push(JSON.stringify(data));
            newAlgorithmHistoryData.current.push({
                ts: data.sleep_timeStamp,
                type: data.timeStamp_type,
                bed_rest_duration: data.bed_time,
                awake_order: data.wake_index
            });
            if (historyCount.current == historyNum.current) {
                setLoadingStatus("done");
                newHistoryReceiveFinish();
            }
        }
    }

    const reportingExerciseListener = {
        onResult: (data) => {
            console.log(`reportingExerciseListener data=${JSON.stringify(data)}`)
            setReportExercise(JSON.stringify(data));
        }
    }

    const ppgMeasurementListener = {
        onResult: (data) => {
            setPpgMeasure(JSON.stringify(data));
            if (!ppgMeasureMode) {
                setPpgMeasureMode(true);
            }
            console.log(`ppgMeasurementListener data=${JSON.stringify(data)}`)
        }
    }

    const ppgSetListener = {
        onResult: (data) => {
            console.log(`ppgSetListener data=${JSON.stringify(data)}`)
        }
    }

    const ppgDataListener = {
        onResult: (data) => {
            if (startTime.current == "") {
                startTime.current = formatNowTime();
                currentTime.current = Date.now();
            }
            if (ppgDataList.current.length == 100) {
                const isAllZero = ppgDataList.current.every(value => value === 0);
                if (isAllZero) {
                    zeroCount.current += 1;
                } else {
                    // 如果当前组不全为 0，重置计数器
                    zeroCount.current = 0;
                }
                // 如果连续 5 组数据都为 0，提示用户保持静止
                if (zeroCount.current >= 5) {
                    alert("请保持静止不动！");
                    zeroCount.current = 0; // 重置计数器
                    supplement.current += 1;//连续5秒无效数据，需要补足5秒数据
                }
                if (ppgData.current.length >= 300 + supplement.current * 5) {
                    endTime.current = formatNowTime();
                    sendData(SDK.SendCmd.SET_PPG, {
                        on_off: 0,
                    });
                    setPpgSwitch(false);
                } else {

                    currentTime.current = addOneSecond(currentTime.current);
                    ppgData.current.push({
                        ppg: ppgDataList.current.slice(),
                        timestamp:
                            formatDateTimeToHms(currentTime.current)
                    });
                    ppgDataList.current = [];

                }
            }
            ppgDataList.current.push(...data.ppgList);
        }
    }

    const activityData2Listener = {
        onResult: (data) => {
            setActiveData2(data);
            console.log(`activityData2Listener data=${JSON.stringify(data)}`)
        }
    }

    const dailyActivitySummary2Listener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`dailyActivityHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            dailyActivitySummary2.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
            console.log(`dailyActivitySummary2Listener data=${JSON.stringify(data)}`)
        }
    }

    const historyDataErrorCallbackListener = {
        onResult: (data) => {
            historyCount.current += 1;
            console.log(`dailyActivityHistoryListener data=${JSON.stringify(data)} historyCount.current=${historyCount.current} historyNum.current=${historyNum.current}`)
            historyDataError.current.push(JSON.stringify(data));
            if (historyCount.current == historyNum.current) {
                newHistoryReceiveFinish();
            }
            console.log(`historyDataErrorCallbackListener data=${JSON.stringify(data)}`)
        }
    }



    const resetPpg = () => {
        ppgData.current = [];
        ppgDataList.current = [];
        zeroCount.current = 0;
        supplement.current = 0;
        startTime.current = "";
        endTime.current = "";
    }

    //23 rings and 28 cut-off require a larger data reception length
    const requestMtu = () => {
        setTimeout(() => {
            bleModule.requestMtu(203)
        }, 2000);
    }

    //////////////////////////only for SR28 end////////////////////////////////////////////

    function registerListener(name) {
        bleName.current = name;
        // mArray = array;
        // mHrArray = hrArray;
        // historyDatas = historyData
        registerEcg();
        SDK.registerHealthListener(healthListener);
        SDK.registerBatteryDataAndStateListener(batteryDataAndStateListener);
        SDK.registerDeviceInfo1Listener(deviceInfo1Listener);
        SDK.registerDeviceInfo2Listener(deviceInfo2Listener);
        SDK.registerDeviceInfo5Listener(deviceInfo5Listener);//{SR28 is not supported}
        SDK.registerHistoricalDataListener(historicalDataListener);
        SDK.registerHistoricalNumListener(historicalNumListener);
        SDK.registerTemperatureListener(temperatureListener);
        SDK.registerRePackageListener(rePackageListener);
        SDK.registerOEMResultListener(oemResultListener);
        SDK.registerIRresouceListener(irResouceListener);
        SDK.registerIRorRedListener(irOrRedListener);
        SDK.registerEcgRawDataListener(ecgRawDataListener);
        SDK.registerEcgAlgorithmDataListener(ecgAlgorithmDataListener);//{SR28 is not supported}
        SDK.registerEcgAlgorithmResultListener(ecgAlgorithmResultListener);//{SR28 is not supported}
        SDK.registerEcgFingerDetectListener(ecgFingerDetectListener);
        SDK.registerStepListener(stepListener);
        SDK.register86176AdjustListener(adjust86176Listener);

        /////////////////////only supports SR28 rings start////////////////////////////////////////
        //user information
        SDK.registerUserInfoListener(userInfoListener);
        //activity data
        SDK.registerActivityDataListener(activityDataListener);
        //new algorithm history number
        SDK.registerNewAlgorithmHistoryNumberListener(newAlgorithmHistoryNumberListener);
        //new algorithm history data
        SDK.registerNewAlgorithmHistoryDataListener(newAlgorithmHistoryDataListener);
        //temperature history data
        SDK.registerTemperatureHistoryDataListener(temperatureHistoryDataListener);
        //measurement timing
        SDK.registerMeasurementTimingListener(measurementTimingListener);
        //excluded swimming activity history
        SDK.registerExcludedSwimmingActivityHistoryListener(excludedSwimmingActivityHistoryListener);
        //daily activity history
        SDK.registerDailyActivityHistoryListener(dailyActivityHistoryListener);
        //exercise activity history
        SDK.registerExerciseActivityHistoryListener(exerciseActivityHistoryListener);
        //exercise vital signs history
        SDK.registerExerciseVitalSignsHistoryListener(exerciseVitalSignsHistoryListener);
        //swimming exercise history
        SDK.registerSwimmingExerciseHistoryListener(swimmingExerciseHistoryListener);
        //single lap swimming history
        SDK.registerSingleLapSwimmingHistoryListener(singleLapSwimmingHistoryListener);
        //step/temperature/activity intensity history
        SDK.registerStepTemperatureActivityIntensityHistoryListener(stepTemperatureActivityIntensityHistoryListener);
        //reporting exercise
        SDK.registerReportingExerciseListener(reportingExerciseListener);
        //sleep history
        SDK.registerSleepHistoryListener(sleepHistoryListener);
        //ppg measurement
        SDK.registerPpgMeasurementListener(ppgMeasurementListener);
        SDK.registerPpgSetListener(ppgSetListener);
        SDK.registerPpgDataListener(ppgDataListener);
        SDK.registerActivityData2Listener(activityData2Listener);
        SDK.registerDailyActivitySummary2Listener(dailyActivitySummary2Listener);
        SDK.registerHistoryDataErrorCallbackListener(historyDataErrorCallbackListener);
        /////////////////////only supports SR28 rings end////////////////////////////////////////
    }

    function unRegisterListener() {
        SDK.unregisterHealthListener();
        SDK.unregisterBatteryDataAndStateListener();
        SDK.unregisterDeviceInfo1Listener();
        SDK.unregisterDeviceInfo2Listener();
        SDK.unregisterDeviceInfo5Listener();
        SDK.unregisterHistoricalDataListener();
        SDK.unregisterHistoricalNumListener();
        SDK.unregisterTemperatureListener();
        SDK.unregisterRePackageListener();
        SDK.unregisterOEMResultListener();
        SDK.unregisterIRresouceListener();
        SDK.unregisterIRorRedListener();
        SDK.unregisterEcgRawDataListener();
        SDK.unregisterEcgAlgorithmDataListener();
        SDK.unregisterEcgAlgorithmResultListener();
        SDK.unregisterEcgFingerDetectListener();
        SDK.unregisterStepListener();
        SDK.unregister86176AdjustListener();
        ecgEmitter.removeAllListeners('ecgWaveListener');
        ecgEmitter.removeAllListeners('ecgValueListener');
        ////////////////////only for SR28 start///////////////////////////////////
        SDK.unRegisterUserInfoListener(userInfoListener);
        SDK.unRegisterActivityDataListener(activityDataListener);
        SDK.unRegisterNewAlgorithmHistoryNumberListener(newAlgorithmHistoryNumberListener);
        SDK.unRegisterNewAlgorithmHistoryDataListener(newAlgorithmHistoryDataListener);
        SDK.unRegisterTemperatureHistoryDataListener(temperatureHistoryDataListener);
        SDK.unRegisterMeasurementTimingListener(measurementTimingListener);
        SDK.unRegisterExcludedSwimmingActivityHistoryListener(excludedSwimmingActivityHistoryListener);
        SDK.unRegisterDailyActivityHistoryListener(dailyActivityHistoryListener);
        SDK.unRegisterExerciseActivityHistoryListener(exerciseActivityHistoryListener);
        SDK.unRegisterExerciseVitalSignsHistoryListener(exerciseVitalSignsHistoryListener);
        SDK.unRegisterSwimmingExerciseHistoryListener(swimmingExerciseHistoryListener);
        SDK.unRegisterSingleLapSwimmingHistoryListener(singleLapSwimmingHistoryListener);
        SDK.unRegisterReportingExerciseListener(reportingExerciseListener);
        SDK.unRegisterSleepHistoryListener(sleepHistoryListener);
        SDK.unRegisterPpgMeasurementListener(ppgMeasurementListener);
        SDK.unRegisterPpgSetListener(ppgSetListener);
        SDK.unRegisterPpgDataListener(ppgDataListener);
        SDK.unregisterActivityData2Listener(activityData2Listener);
        SDK.unRegisterDailyActivitySummary2Listener(dailyActivitySummary2Listener);
        SDK.unRegisterHistoryDataErrorCallbackListener(historyDataErrorCallbackListener);
        ////////////////////only for SR28 end/////////////////////////////////////////////
    }

    const formatEcgData = (data) => {
        return data.map(item => `${item},1`).join('\n');
    };

    //Support server-side ECG calculation by calling this function
    function requestEcgArrhythmiaEcg() {
        requestWebEcg(false)
    }
    //Support server-side ECG calculation by calling this function
    function requestSpeEcg() {
        requestWebEcg(true)
    }
    //test key = '2901f7613ac7403e9c5fbc0248b6d94f'; 
    //test secret = 'ad58bea443d04368beb847510a37a99d';
    function requestWebEcg(isRequestSpe) {
        const data = formatEcgData(ecgDataBuffer.current);
        // FileUtils.writeFile(data);
        // setTimeout(() => {
        //     FileUtils.writeFile(ecgData.current.join('\n'),true);
        // }, 2000);


        requestWebEcgData({
            key: "2901f7613ac7403e9c5fbc0248b6d94f", sn: device2Value.sn.toString(),
            mac: device1Value.bleAddress.toString().toLowerCase(), secret: "ad58bea443d04368beb847510a37a99d",
            isSpe: isRequestSpe
        }, data).then(data => {

            console.log("response data: " + JSON.stringify(data));
            //The item with the highest value in the rhythmBurdens array is the result 
            //e.g. {"INCONCLUSIVE":0.9146644573322286,"NORMAL":94.4092792046396,"ATRIAL_FIBRILLATION":0,"BRADYCARDIA":0,"TACHYCARDIA":0,"PAUSE":0,"UNREADABLE":4.676056338028169}
            //this result is the most likely rhythm type NORMAL（Sinus rhythm）
        }).catch(error => {
            console.log(error);
        });
    }

    return {
        registerListener,
        unRegisterListener,
        sendData,
        initWave,
        getPath,
        stopDraw,
        getIrPath,
        getRedPath,
        resetProgress,
        handleRegisterDeviceOpenDialog,
        handleRegisterDeviceCloseDialog,
        handleUserInfoOpenDialog,
        handleUserInfoCloseDialog,
        handleRegisterDeviceConfirm,
        handleUserInfoConfirm,
        handMeasureTimingOpenDialog,
        handMeasureTimingCloseDialog,
        handleMeasurementTimingConfirm,
        handExerciseOpenDialog,
        handExerciseCloseDialog,
        handleExerciseConfirm,
        toggleSwitch,
        toggleOemSwitch,
        startRawEcg,
        stopRawEcg,
        startRawEcgWithBSECURAlgorithm,
        stopRawEcgWithBSECURAlgorithm,
        startEcgAlgorithm,
        stopEcgAlgorithm,
        showEcgPrint,
        setOxMeasurementSettings,
        handleHeartRateTimeChange,
        handleOxMeasurementSwitchChange,
        handleOxMeasurementTimeIntervalChange,
        handleStepThresholdChange,
        dateChange,
        handleHistoryOpenDialog,
        handleHistoryCloseDialog,
        showCalendar,
        handleOpenOldHistoryDialog,
        handleOldHistoryCloseDialog,
        getOldHistoryData,
        handSportModeCloseDialog,
        handSportModeOpenDialog,
        handleSportModeConfirm,
        requestMtu,
        requestEcgArrhythmiaEcg,
        requestSpeEcg,
        setPpgMeasureMode,
        togglePpgSwitch,
        handleUploadPpgRecord,
        handleBloodGlucoseData,
        ppgMeasureResult,
        uploadResult,
        ppgSwitch,
        rdModelVisible,
        ppgMeasure,
        ppgMeasureMode,
        sportModeModalVisible,
        oldHistoryModalVisible,
        loadingStatus,
        historyModalVisible,
        isDateShow,
        currentDate,
        calorie,
        stepThreshold,
        heartRateTime,
        oxMeasurementSwitch,
        oxMeasurementTimeInterval,
        swing,
        cleanHistoricalNewDataStatus,
        isOemEnabled,
        isEnabled,
        reportExercise,
        exerciseModalVisible,
        measureTimingModalVisible,
        measurementTiming,
        modalVisible,
        userInfo,
        activeData,
        activeData2,
        newAlgorithmHistory,
        heartData,
        healthData,
        ecgWave,
        updateEcg,
        ecgResult,
        currentEcgMode,
        battery,
        device1Value,
        device2Value,
        device5Value,
        getHistoryStart,
        progress,
        history,
        temperatureValue,
        rePackage,
        oemResult,
        step,
        deviceBindStatus,
        deviceUnBindStatus,
        shutDownStatus,
        restartStatus,
        restoreFactorySettingsStatus,
        cleanHistoricalDataStatus,
        timeSyncStatus,
        stepThresholdResult,
        hrvValue,
        moodValue,
        maxRR,
        minRR,
        currentCmd,
        startOem,
        toastRef,
        mArray,
        mHrArray,
        historyDatas,
        newAlgorithmHistoryData,
        adjust86176modalVisible,
        handle86176OpenDialog,
        handle86176CloseDialog,
        handleRegister86176Confirm,
        adjust86176Value,
        handleTestModeOpenDialog,
        testModeModalVisible,
        handleTestModeCloseDialog,
        handleTestModeConfirm,
    }
}
