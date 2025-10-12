
import {
    NativeModules, Platform, Alert
} from "react-native";
import { useRef, useState } from "react";
import { formatToHm, formatDateTime } from "../utils/TimeFormat";
import SDK from '../lib/ringSDK';
export function sleepViewModel() {

    const { NativeSleepModule, SleepDataMoudle } = NativeModules

    //静息心率
    const [restingHeartRate, setRestingHeartRate] = useState("");
    //呼吸率
    const [respiratoryRate, setRespiratoryRate] = useState("");
    //血氧饱和度
    const [oxygenSaturation, setOxygenSaturation] = useState([]);
    //心率沉浸
    const [heartRateImmersion, setHeartRateImmersion] = useState("");

    const [sleepTime, setSleepTime] = useState([]);
    const [newSleepTime, setNewSleepTime] = useState([]);
    const mSleepTimeArray = useRef([]);

    //New algorithm sleep data
    //Need to request new algorithm history data and old algorithm history data, and then pass the data to the getNewAlgorithmSleepData interface
    function getNewAlgorithmSleepData(mArray,newAlgorithmHistoryData) {
        console.log(`newAlgorithmHistoryData=${JSON.stringify(newAlgorithmHistoryData.current)}`)
        if (mArray.current.length != 0&&newAlgorithmHistoryData.current.length!=0) {
            if (Platform.OS == "android") {
                NativeSleepModule.getNewAlgorithmSleepFusion(mArray.current,newAlgorithmHistoryData.current, (result) => {
                    sleepDataProcess(result)
                })
                
            } else if (Platform.OS == "ios") {
                SleepDataMoudle.getNewAlgorithmSleepData(mArray.current,newAlgorithmHistoryData.current, (error,result) => {
                    sleepDataProcess(result);
                })
            }
        }else {
            showDialog(true);
        }
    }

    function sleepDataProcess(result){
        var sleepTimeArray = [];
        var sleepTimePeriodArray = [];
        for (let index = 0; index < result.length; index++) {
            const data = result[index];
            var lightTime = 0;
            var deepTime = 0;
            var remTime = 0;
            var wakeTime = 0;
            var napTime = 0;
            for (let index = 0; index < data.stagingList.length; index++) {
                const element = data.stagingList[index];
                switch (element.stagingType) {
                    case "NREM1":
                        lightTime += element.endTime - element.startTime
                        break
                    case "NREM3":
                        deepTime += element.endTime - element.startTime
                        break;
                    case "REM":
                        remTime += element.endTime - element.startTime
                        break;
                    case "WAKE":
                        wakeTime += element.endTime - element.startTime
                        break;
                    case "NAP":
                        napTime += element.endTime - element.startTime
                        break;
                }
            }
            sleepTimeArray.push({
                deepSleep: `deepTime=` + formatToHm(deepTime),
                lightTime: `lightTime=` + formatToHm(lightTime),
                remTime: `remTime=` + formatToHm(remTime),
                wakeTime: `wakeTime=` + formatToHm(wakeTime),
                napTime: `napTime=` + formatToHm(napTime),
                startTime: formatDateTime(data.startTime),
                endTime: formatDateTime(data.endTime)
            })
            sleepTimePeriodArray.push({
                sleepTimePeriod: {
                    startTime: data.startTime,
                    endTime: data.endTime
                },
                deepSleepTime: deepTime,
                lightSleepTime: lightTime,
                remSleepTime: remTime,
                wakeSleepTime: wakeTime,
                napSleepTime: napTime,
            })
        }
        setNewSleepTime(sleepTimeArray);
    }

    //Old algorithm sleep data
    //Need to request old algorithm history data and pass the data to the getSleepData interface
    //Sleep data calculation  At least one day's sleep data history is required
    function getSleepData(mArray, historyDatas) {
        if (mArray.current.length != 0) {
            if (Platform.OS == "android") {
                NativeSleepModule.getSleepData(mArray.current, (result) => {
                    var sleepTimeArray = [];
                    var sleepTimePeriodArray = [];
                    for (let index = 0; index < result.length; index++) {
                        const data = result[index];
                        var lightTime = 0;
                        var deepTime = 0;
                        var remTime = 0;
                        var wakeTime = 0;
                        var napTime = 0;
                        for (let index = 0; index < data.stagingList.length; index++) {
                            const element = data.stagingList[index];
                            switch (element.stagingType) {
                                case "NREM1":
                                    lightTime += element.endTime - element.startTime
                                    break
                                case "NREM3":
                                    deepTime += element.endTime - element.startTime
                                    break;
                                case "REM":
                                    remTime += element.endTime - element.startTime
                                    break;
                                case "WAKE":
                                    wakeTime += element.endTime - element.startTime
                                    break;
                                case "NAP":
                                    napTime += element.endTime - element.startTime
                                    break;
                            }
                        }
                        sleepTimeArray.push({
                            deepSleep: `deepTime=` + formatToHm(deepTime),
                            lightTime: `lightTime=` + formatToHm(lightTime),
                            remTime: `remTime=` + formatToHm(remTime),
                            wakeTime: `wakeTime=` + formatToHm(wakeTime),
                            napTime: `napTime=` + formatToHm(napTime),

                            startTime: formatDateTime(data.startTime),
                            endTime: formatDateTime(data.endTime)
                        })
                        sleepTimePeriodArray.push({
                            sleepTimePeriod: {
                                startTime: data.startTime,
                                endTime: data.endTime
                            },
                            deepSleepTime: deepTime,
                            lightSleepTime: lightTime,
                            remSleepTime: remTime,
                            wakeSleepTime: wakeTime,
                            napSleepTime: napTime,
                        })
                    }
                    setSleepTime(sleepTimeArray);
                    console.log(`sleepTimeArray=${JSON.stringify(sleepTimeArray)}`)
                    mSleepTimeArray.current = sleepTimePeriodArray
                    ObtainValidHistoricalData(historyDatas);
                })
            } else {
                SleepDataMoudle.getIOSSleepData(mArray.current, (error, result) => {
                    var sleepTimeArray = [];
                    var sleepTimePeriodArray = [];
                    for (let index = 0; index < result.length; index++) {
                        const data = result[index];
                        var lightTime = 0;
                        var deepTime = 0;
                        var remTime = 0;
                        var wakeTime = 0;
                        var napTime = 0;
                        for (let index = 0; index < data.stagingList.length; index++) {
                            const element = data.stagingList[index];
                            switch (element.stagingType) {
                                case "NREM1":
                                    lightTime += element.endTime - element.startTime
                                    break
                                case "NREM3":
                                    deepTime += element.endTime - element.startTime
                                    break;
                                case "REM":
                                    remTime += element.endTime - element.startTime
                                    break;
                                case "WAKE":
                                    wakeTime += element.endTime - element.startTime
                                    break;
                                case "NAP":
                                    napTime += element.endTime - element.startTime
                                    break;
                            }
                        }
                        sleepTimeArray.push({
                            deepSleep: `deepTime=` + formatToHm(deepTime),
                            lightTime: `lightTime=` + formatToHm(lightTime),
                            remTime: `remTime=` + formatToHm(remTime),
                            wakeTime: `wakeTime=` + formatToHm(wakeTime),
                            napTime: `napTime=` + formatToHm(napTime),
                            startTime: formatDateTime(data.startTime),
                            endTime: formatDateTime(data.endTime)
                        })
                        sleepTimePeriodArray.push({
                            sleepTimePeriod: {
                                startTime: data.startTime,
                                endTime: data.endTime
                            },
                            deepSleepTime: deepTime,
                            lightSleepTime: lightTime,
                            remSleepTime: remTime,
                            wakeSleepTime: wakeTime,
                            napSleepTime: napTime,
                        })
                    }
                    setSleepTime(sleepTimeArray);
                    mSleepTimeArray.current = sleepTimePeriodArray
                    ObtainValidHistoricalData(historyDatas);
                })
            }
        } else {
            showDialog();
        }
    }

    function ObtainValidHistoricalData(historyDatas) {
        let historicalDataArray = SDK.ObtainValidHistoricalData(mSleepTimeArray.current, historyDatas.current);
        //Obtain data on sleep time periods
        let sleepDataArray = historicalDataArray.filter(historyItem => {
            const { timeStamp, heartRate, wearStatus, chargeStatus, hrv, temperature, step, sportsMode } = historyItem;
            const isSleepTime = mSleepTimeArray.current.some(sleepPeriod => {
                return sleepPeriod.sleepTimePeriod.startTime <= timeStamp && timeStamp <= sleepPeriod.sleepTimePeriod.endTime;
            });
            return isSleepTime
        })

        //Obtain data from non sleep time periods
        let nonSleepDataArray = historicalDataArray.filter(historyItem => {
            const { timeStamp, heartRate, wearStatus, chargeStatus, hrv, temperature, step, sportsMode } = historyItem;
            const isSleepTime = mSleepTimeArray.current.some(sleepPeriod => {
                return sleepPeriod.sleepTimePeriod.startTime <= timeStamp && timeStamp <= sleepPeriod.sleepTimePeriod.endTime;
            });
            return !isSleepTime
        })
        //Sports mode data
        let sportSModeDataArray = nonSleepDataArray.filter(historyItem => {
            const { timeStamp, heartRate, wearStatus, chargeStatus, hrv, temperature, step, sportsMode } = historyItem;
            if (sportsMode === "open") {
                return true
            }
        })
        //Non Sports mode data
        let nonSportSModeDataArray = nonSleepDataArray.filter(historyItem => {
            const { timeStamp, heartRate, wearStatus, chargeStatus, hrv, temperature, step, sportsMode } = historyItem;
            if (sportsMode === "close") {
                return true
            }
        })
    }

    const showDialog = (newAlgorithm=false) => {
        Alert.alert(
            'Warning',
            newAlgorithm?"Please test old historical data and new historical data first":'Please test historical data first',
            [
                { text: 'Cancel', style: 'cancel' },
            ],
            {
                cancelable: false
            }
        );
    }

    function initSleepData(mArray) {
        if (mArray.current.length != 0) {
            if (mSleepTimeArray.current.length == 0) {
                mSleepTimeArray.current = SDK.calcSleepTime(mArray.current);
            }
        } else {
            showDialog();
        }
    }

    //Calculate resting heart rate
    function calcRestingHeartRate(mHrArray, timeStamp = -1, refresh = true) {
        if (mHrArray.current.length != 0) {
            var restingHeartRate = SDK.calcRestingHeartRate(mHrArray.current, timeStamp);
            // console.log(`Calculate resting heart rate restingHeartRate=${JSON.stringify(restingHeartRate)} `)
            if (typeof restingHeartRate == 'number') {
                if (refresh) {
                    setRestingHeartRate(Math.floor(restingHeartRate) + " BPM");
                }
                return restingHeartRate;
            } else if (restingHeartRate instanceof Array) {
                let result = ""
                for (let index = 0; index < restingHeartRate.length; index++) {
                    const element = restingHeartRate[index];
                    var ts = formatDateTime(element.ts, false);
                    var data = Math.floor(element.data);
                    result += ts + " restingHeartRate=" + data + " BPM "
                }
                if (refresh) {
                    setRestingHeartRate(result);
                }
                return restingHeartRate;
            }
        } else {
            showDialog();
        }

    }

    //Calculate respiratory rate
    function calcRespiratoryRate(mArray, timeStamp = -1) {
        initSleepData(mArray);
        var result = SDK.calcRespiratoryRate(mSleepTimeArray.current, mArray.current, timeStamp);
        if (result?.type == 'number') {
            setRespiratoryRate(result.respiratoryRate + " BPM")
        } else if (result?.type == 'Array') {
            var arr = result?.result;
            var result = ""
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                result += (index + 1) + "group startTime" + formatDateTime(element.timeSlot.startTime) + "-> endTime" + formatDateTime(element.timeSlot.endTime) + " [respiratoryRate]:" + element.respiratoryRate + "per minute"
            }
            setRespiratoryRate(result);
        }
    }

    //Blood oxygen saturation
    function getOxygenSaturation(mArray) {
        if (mArray.current.length != 0) {
            if (mSleepTimeArray.current.length == 0) {
                mSleepTimeArray.current = SDK.calcSleepTime(mArray.current);
            }
            let array = SDK.calcOxygenSaturation(mSleepTimeArray.current, mArray.current);
            setOxygenSaturation(array)
        } else {
            showDialog();
        }
    }

    function showOxygenSaturation() {
        let result = ""
        for (let index = 0; index < oxygenSaturation.length; index++) {
            const element = oxygenSaturation[index];
            result += (index + 1) + "group startTime" + formatDateTime(element.startTime) + "-> endTime" + formatDateTime(element.endTime) + " [oxygen]:" + element.oxygen + "%  "
        }
        return result
    }

    //Obtain heart rate immersion
    function getHeartRateImmersion(mArray, mHrArray, timeStamp = -1) {
        initSleepData(mArray);
        var result = SDK.calcHeartRateImmersion(mSleepTimeArray.current, mArray.current, mHrArray.current, timeStamp)
        if (result.type == 'number') {
            setHeartRateImmersion(result + "%");
        } else if (result.type == 'Array') {
            var data = "";
            var arr = result.result
            for (let index = 0; index < arr.length; index++) {
                const element = arr[index];
                data += element.time + " heartRateImmersion:" + element.heartRateImmersion + "% "
            }
            setHeartRateImmersion(data);
        }
    }

    //Display sleep time data
    function showSleepTime() {
        let total = ""
        for (let index = 0; index < sleepTime.length; index++) {
            total += (index + 1) + "group startTime" + sleepTime[index].startTime + "-> endTime" + sleepTime[index].endTime + " [deepSleep]:" + sleepTime[index].deepSleep + " [lightTime]:" + sleepTime[index].lightTime + " [remTime]:" + sleepTime[index].remTime + " [wakeTime]:" + sleepTime[index].wakeTime + " [napTime]:" + sleepTime[index].napTime + "  "
        }
        return total
    }

    function showNewSleepTime(){
        let total = ""
        for (let index = 0; index < newSleepTime.length; index++) {
            total += (index + 1) + "group startTime" + newSleepTime[index].startTime + "-> endTime" + newSleepTime[index].endTime + " [deepSleep]:" + newSleepTime[index].deepSleep + " [lightTime]:" + newSleepTime[index].lightTime + " [remTime]:" + newSleepTime[index].remTime + " [wakeTime]:" + newSleepTime[index].wakeTime + " [napTime]:" + newSleepTime[index].napTime + "  "
        }
        return total
    }

    return {
        getSleepData,
        getNewAlgorithmSleepData,
        showSleepTime,
        showNewSleepTime,
        calcRestingHeartRate,
        calcRespiratoryRate,
        getOxygenSaturation,
        showOxygenSaturation,
        getHeartRateImmersion,
        sleepTime,
        heartRateImmersion,
        respiratoryRate,
        restingHeartRate
    }
}