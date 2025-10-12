import {
    NativeModules, NativeEventEmitter, Platform
} from "react-native";
import { HealthViewModel } from './HealthViewModel';
import SDK from '../lib/ringSDK';
import { useRef, useState } from "react";
import { bleModule } from '../module/BleModule';
import { useSelector } from 'react-redux';
import { queryLastTsBpDataFromServer, sendJsonArrayToServer } from '../http/httpManager';
var measureTimeOut = null;
export function BpViewModel() {
    const { NativeEcgModule, BpModule } = NativeModules;
    const ecgEmitter = new NativeEventEmitter(NativeEcgModule);
    const bpEmitter = new NativeEventEmitter(BpModule);
    const healthViewModel = HealthViewModel();
    const MIN_CALIBRATION_TIMES = 3; //最低校准次数
    const DATA_LOSS_THRESHOLD = 1000;
    const mCurrCalibrationInfo = useRef("");
    const count = useRef(0);
    const ecgIndex = useRef(0);
    const mPTTCount = useRef(0);
    const ppgData = useRef([]);
    const mPTTList = useRef([]);
    const mPWTTMidAvgList = useRef([]);
    const isMeasuring = useRef(false);
    const isCalibrating = useRef(false);
    const bpToastRef = useRef(null);
    const mUserCalBp = useRef("");
    const webLastTs = useRef(0);
    const addCalibrationData = useRef(false);
    const isTestCompleteShow = useRef(false);
    const isCalibrationCompleteShow = useRef(false);
    const [pttCount, setPttCount] = useState(0);
    const [measureState, setMeasureState] = useState("Start Measurement");
    const [userBpModalVisible, setUserBpModalVisible] = useState(false);
    const [bpiResult, setBpiResult] = useState("");
    const [calibrationTime, setCalibrationTime] = useState(0);
    const [isShowAddCalibrationBP, setIsShowAddCalibrationBP] = useState(false);

    const token = useSelector((state) => state.auth.token);
    const account = useSelector((state) => state.auth.account);

    async function updateToServer() {
        let bpData = await healthViewModel.queryBpInTimeStamp(webLastTs.current);
        console.log(` bpData=${JSON.stringify(bpData)} length=${bpData.length}`);
        const jsonData = bpData.map(item => JSON.parse(JSON.stringify(item)));
        console.log(` jsonData=${jsonData} `);
        if (bpData.length > 0) {
            let result = await sendJsonArrayToServer({ account: account, t: token, data: jsonData });
            console.log(`result=${JSON.stringify(result)}  `);
        }
    }

    async function bpInit() {
        setTimeout(async () => {
            console.log(`delay 1000 token=${token}  account=${account} `);
            let ts = await queryLastTsBpDataFromServer({
                token: token,
                account: account
            });
            console.log(` ts=${JSON.stringify(ts)} `);
            if (ts != null) {
                webLastTs.current = ts;
            } else {
                alert("Failed to retrieve server data");
            }
        }, 1000);

        if (Platform.OS == "android") {
            bleModule.requestMtu(203);
        }
        BpModule.initial();
        let infoArr = await healthViewModel.getAllBpCalibrationInfo();
        if (infoArr.length > 0) {
            const info = infoArr
                .filter(item => item.account === account)
                .map(({ sys_d, dias_d, hr, pwtt }) =>
                    `${sys_d}/${dias_d}/${hr}/${pwtt}`
                )
                .join(";");
            mCurrCalibrationInfo.current = info;
        }
        console.log(`mCurrCalibrationInfo=${mCurrCalibrationInfo.current}  infoArr=${infoArr.length} `);
        let size = getCalibrationSize();
        setCalibrationTime(size);
        if (size >= MIN_CALIBRATION_TIMES) {
            BpModule.setBPCalibrationInfo(mCurrCalibrationInfo.current);
            setIsShowAddCalibrationBP(true);
        }
        registerEcgValueListener();
        registerEcgWaveListener();
        registerBpListener();
        registerFilteredEcgAndPpgWaveListener();
        registerEcgAndPpgListener();
    }

    function bpUnInit() {
        unRegisterAllListener
    }

    const ecgAndPpgListener = {
        onResult: (data) => {
            count.current += data.ecgList.length;
            if (measureTimeOut) {
                clearTimeout(measureTimeOut);
                measureTimeOut = null;
            }
            //数据丢失判断
            if (count.current < data.dataCount * 3 - DATA_LOSS_THRESHOLD) {
                stop();
                updateMeasure(false);
                setMeasure(false);
            } else {
                processData(data);
            }
        }
    }

    function processData(data) {
        ppgData.current.push(...data.ppgList);
        NativeEcgModule.dealData(data.ecgList);
    }

    function registerBpListener() {
        bpEmitter.addListener(
            'bpDataListener',
            (data) => {
                console.log(`bpDataListener data=${JSON.stringify(data)}`);
                if (mPTTCount.current != data.rriCount) {
                    mPTTCount.current = data.rriCount;
                    setPttCount(data.rriCount);
                }
                if (data.rriCount == 20) {
                    BpModule.getCalibrationInfo((pwtt) => {
                        console.log(`calibrationInfo  pwtt=${pwtt} isCalibrating.current=${isCalibrating.current}`);
                        if (pwtt.length > 0) {
                            if (isMeasuring.current) {
                                let size = getCalibrationSize();
                                setCalibrationTime(size);
                                stop();
                            }
                            if (isCalibrating.current) {
                                updateBPCalibrationInfo();
                            } else {
                                BpModule.getPwttInfo(async (data) => {
                                    let d = data.split(",");
                                    let bp = d.length >= 3 ? `${d[1]}/${d[2]}` : "0/0";
                                    let sys = await getSys();
                                    let dia = await getDia();
                                    let hr = await getHR();
                                    let result = `Systolic Pressure: ${sys}, Diastolic Pressure: ${dia}, Heart Rate: ${hr} `;
                                    setBpiResult(result);

                                    let bp_1 = bp.split("/");

                                    console.log(`  account=${account} hr=${hr} pwtt=${pwtt} 
                                        Number(bp_1[0])=${Number(bp_1[0])} Number(bp_1[1])=${Number(bp_1[1])} 
                                        sys=${sys}  dia=${dia}
                                        `)
                                    healthViewModel.setBpCalibrationInfo({
                                        ts: getUnixTimestamp(),//时间戳
                                        account: account,//帐号
                                        sys_d: 0,//血压计
                                        dias_d: 0,//血压计
                                        hr: hr,//心率
                                        pwtt: Number(pwtt),
                                        sys_r1: Number(bp_1[0]),//戒指获取
                                        dias_r1: Number(bp_1[1]),//戒指获取
                                        sys_r2: sys,
                                        dias_r2: dia,
                                    });
                                    if (!isTestCompleteShow.current) {
                                        isTestCompleteShow.current = true;
                                        alert("Blood pressure measurement completed");
                                    }

                                    console.log(`result=${result}`);
                                });
                            }
                        }
                    });
                }
            }
        );
    }

    function getUnixTimestamp() {
        return Math.floor(Date.now() / 1000);
    }


    function registerEcgValueListener() {
        ecgEmitter.addListener(
            'ecgValueListener',
            (data) => {
                if (data.type == "R DETECTED" && isMeasuring.current) {
                    BpModule.ecgRDetected();
                }
            }
        );
    }

    function registerEcgWaveListener() {
        ecgEmitter.addListener(
            'ecgWaveListener',
            async (data) => {
                if (!isMeasuring.current) {
                    return;
                }
                let ppg = Number(ppgData.current[ecgIndex.current++]);
                console.log(`ecgWaveListener  ppg=${ppg}`);
                BpModule.addSample(Number(data.value), ppg);
            }
        );
    }

    // function registerFilteredEcgAndPpgWaveListener() {
    //     bpEmitter.addListener(
    //         'bpWaveListener',
    //         (data) => {
    //             // console.log(`bpWaveListener_bpViewModel data=${data.filteredECGList.length}  data.filteredPPGList.length=${data.filteredPPGList.length}  `);

    //         }
    //     );
    // }



    function registerEcgAndPpgListener() {
        SDK.registerEcgAndPpgListener(ecgAndPpgListener)
    }

    function unRegisterAllListener() {
        SDK.unregisterEcgAndPpgListener()
        ecgEmitter.removeAllListeners('ecgWaveListener');
        ecgEmitter.removeAllListeners('ecgValueListener');
        bpEmitter.removeAllListeners('bpDataListener');
        bpEmitter.removeAllListeners('bpWaveListener');
    }

    async function reset() {
        isTestCompleteShow.current = false;
        isCalibrationCompleteShow.current = false;
        count.current = 0
        ecgIndex.current = 0
        mPTTCount.current = 0
        setPttCount(0);
        ppgData.current = []
        mPTTList.current = []
        mPWTTMidAvgList.current = []
        BpModule.reset()
        console.log("reset startECG")
    }

    const startBp = () => {
        console.log(`startBp  isMeasuring.current=${isMeasuring.current} `);
        if (isMeasuring.current) {
            stop();
        } else {
            let size = getCalibrationSize();
            isCalibrating.current = size < MIN_CALIBRATION_TIMES;
            setCalibrationTime(size);
            console.log(`isCalibrating=${isCalibrating.current}  mUserCalBp.current=${mUserCalBp.current}  size=${size}`);
            if (isCalibrating.current && mUserCalBp.current == "") {
                setUserBpModalVisible(true);
            } else {

                updateMeasure(true);
                bpToastRef.current.show("Blood pressure measurement begins", 2000);
                reset();
                start();
                measureTimeOut = setTimeout(() => {
                    console.warn("==============measureTimeOut=============   ")
                    updateMeasure(false);
                    stop();

                }, 10000);
            }

        }
    }


    async function updateBPCalibrationInfo() {
        let hr = await getHR();
        let calibrationInfo = await getCalibrationInfo();
        let info = `${mUserCalBp.current}/${hr}/${calibrationInfo}`;
        let oldInfo = mCurrCalibrationInfo.current;
        let newInfo = oldInfo.trim() === "" ? info : `${oldInfo};${info}`;
        let userBp = mUserCalBp.current.split('/');
        console.log(`saveCalibrationToDB userBp=${JSON.stringify(userBp)} hr=${hr} calibrationInfo=${calibrationInfo}`);
        saveCalibrationToDB({
            sys: Number(userBp[0]),
            disa: Number(userBp[1]),
            hr: hr,
            pwtt: Number(calibrationInfo)
        })
        mCurrCalibrationInfo.current = newInfo;
        console.log(`hr=${hr},calibrationInfo=${calibrationInfo}  info=${info}  oldInfo=${oldInfo}  newInfo=${newInfo}  mCurrCalibrationInfo.current=${mCurrCalibrationInfo.current}`);
        let size = getCalibrationSize();
        if (size >= MIN_CALIBRATION_TIMES) {
            BpModule.setBPCalibrationInfo(mCurrCalibrationInfo.current);
            setIsShowAddCalibrationBP(true);
        }
        mUserCalBp.current = "";
        setCalibrationTime(size);
        if (!isCalibrationCompleteShow.current) {
            alert("Blood pressure calibration completed");  // Replace with actual toast implementation if available
            isCalibrationCompleteShow.current = true
        }
    }


    function getCalibrationSize() {
        console.log("calibrationSize  mCurrCalibrationInfo.current", mCurrCalibrationInfo.current);
        if (mCurrCalibrationInfo.current.trim() !== '') {
            let count = 0;
            mCurrCalibrationInfo.current.split(';').forEach(item => {
                if (item.trim() !== '' && (item.match(/\//g) || []).length === 3) {
                    const [first, second] = item.split('/');
                    // 判断前两个字段是否都不是同时为 '0'
                    if (!(first === '0' && second === '0')) {
                        count++;
                    }
                }
            });
            return count;
        } else {
            return 0;
        }
    }

    function getHR() {
        return new Promise((resolve, reject) => {
            BpModule.getHR((hr) => {
                if (hr !== undefined && hr !== null) {
                    resolve(hr);
                } else {
                    reject(new Error('Failed to get HR'));
                }
            });
        });
    }

    function getSys() {
        return new Promise((resolve, reject) => {
            BpModule.statSys((sys) => {
                if (sys !== undefined && sys !== null) {
                    resolve(sys);
                } else {
                    reject(new Error('Failed to get SYS'));
                }
            });
        });
    }

    function getDia() {
        return new Promise((resolve, reject) => {
            BpModule.statDia((dia) => {
                if (dia !== undefined && dia !== null) {
                    resolve(dia);
                } else {
                    reject(new Error('Failed to get DIA'));
                }
            });
        });
    }

    function getCalibrationInfo() {
        return new Promise((resolve, reject) => {
            BpModule.getCalibrationInfo((info) => {
                console.log(`info=${info}`);
                resolve(info)
            })
        });
    }

    function updateMeasure(isMeasure) {
        isMeasuring.current = isMeasure;
        var state = isMeasure ? "Stop Measurement" : "Start Measurement";
        setMeasureState(state)
    }

    function addCalibrationBP() {
        addCalibrationData.current = true;
        setUserBpModalVisible(true);
    }

    function setUserBP(sys, dias) {
        mUserCalBp.current = `${sys}/${dias}`;
    }

    function addNewCalibrationBP(sys, dias) {
        mUserCalBp.current = `${sys}/${dias}`;
        updateBPCalibrationInfo();
    }

    async function requiredCalibrationTimes() {
        let needTimes = 0;
        await BpModule.requiredCalibrationTimes((times) => {
            console.log(`requiredCalibrationTimes=${times}`);
            needTimes = times;
        })
        return needTimes;
    }

    function handleUserBpCloseDialog() {
        setUserBpModalVisible(false);
    }

    function handleUserBpConfirm(sys, dias) {
        setUserBpModalVisible(false);
        if (addCalibrationData.current) {
            addNewCalibrationBP(sys, dias);
        } else {
            setUserBP(sys, dias);
        }

    }

    function stop() {
        console.log(` 停止测量 `);
        NativeEcgModule.stopECG();
        updateMeasure(false);
        sendData(SDK.SendCmd.handleEcgAndPpg, { switch: 0, samplingRate: 3 });
    }

    function start() {
        console.log(` 开始测量 `);
        NativeEcgModule.startECG();
        updateMeasure(true);
        sendData(SDK.SendCmd.handleEcgAndPpg, { switch: 1, samplingRate: 3 });
    }

    function sendData(cmd, data) {
        var result = SDK.startDetect(cmd, data);
        console.log(`sendData result=${Array.from(new Uint8Array(result))}`);
        return bleModule.write(Array.from(new Uint8Array(result)));
    }

    function saveCalibrationToDB({
        sys, disa, hr, pwtt
    }) {
        healthViewModel.setBpCalibrationInfo({
            ts: getUnixTimestamp(),//时间戳
            account: account,//帐号
            sys_d: sys,//血压计
            dias_d: disa,//血压计
            hr: hr,//心率
            pwtt: pwtt,
            sys_r1: 0,//戒指获取
            dias_r1: 0,//戒指获取
            sys_r2: 0,
            dias_r2: 0,
        });
    }


    return {
        stop,
        startBp,
        bpInit,
        requiredCalibrationTimes,
        handleUserBpCloseDialog,
        handleUserBpConfirm,
        addCalibrationBP,
        bpUnInit,
        updateToServer,
        bpToastRef,
        isShowAddCalibrationBP,
        bpiResult,
        isMeasuring,
        measureState,
        userBpModalVisible,
        pttCount,
        calibrationTime,
    }

}
