import testJson from '../assets/test.json';
import historyJson from '../assets/Historical.json'
import HealthModel from '../model/HealthModel';
import { showDialog } from '../utils/dialogUtil'
import { useRef, useState } from "react";
import { formatMinutesToHours } from '../utils/TimeFormat';
//Used for calculating pressure and temperature fluctuations
export function HealthViewModel() {
    const healthModel = new HealthModel();
    healthModel.init();
    //Temperature fluctuations
    const [ftcW, setFtcW] = useState(0);
    const [tempArr, setTempArr] = useState([]);
    const [ftcBase, setFtcBase] = useState(0);
    const [showTempChart, setShowTempChart] = useState(false);
    const [tempTitle, setTempTitle] = useState('GetTemperature');

    //stress
    const [stressDays, setStressDays] = useState("");
    const [pressureArray, setPressureArray] = useState({});
    const [motionArray, setMotionArray] = useState([]);
    const [pressureBaseLine, setPressureBaseLine] = useState(0);
    const [recoveryTime, setRecoveryTime] = useState("");
    const [stressTime, setStressTime] = useState("");
    const [showStressChart, setShowStressChart] = useState(false);
    const [stressTitle, setStressTitle] = useState('GetStress');
    const isGetHistoryData = useRef(false);

    function getAllBpCalibrationInfo() {
       return healthModel.getAllBpCalibrationInfo();
    }

    function setBpCalibrationInfo(data) {
       return healthModel.setBpCalibrationInfo(data);
    }

    function getLastBpCalibrationInfo(){
        return healthModel.getLastBpCalibrationInfo();
    }


    function queryBpInTimeStamp(ts){
        return healthModel.queryBpInTimeStamp(ts);
    }

    function deleteAllBp(){
        healthModel.deleteAllBp();
    }

    function deleteBpByTs(ts){
        healthModel.deleteBpByTs(ts);
    }



    // function deleteBpHistory() {
    //     healthModel.deleteBpHistory();
    // }

    function handleTempChartClose() {
        setShowTempChart(false);
    }

    function setTemperatureShowTitle(data) {
        setTempTitle(data)
    }

    function handleStressChartClose() {
        setShowStressChart(false);
    }

    function setStressShowTitle(data) {
        setStressTitle(data)
    }

    //Obtain Stress data
    async function getStress(currentDate) {
        if (isGetHistoryData.current) {
            console.log(`getStress=====================进入 `)
            setPressureArray([]);
            setMotionArray([]);
            setRecoveryTime("");
            setStressTime("");
            const pressureBaseLineData = await getPressureBaseLine(currentDate);
            if (0 < pressureBaseLineData["downCount"] &&
                pressureBaseLineData["downCount"] < 5) {
                setStressDays(`还有${pressureBaseLineData["downCount"]}天提供压力数据`);
            } else {
                setStressDays("");
            }
            var baseLine = pressureBaseLineData["baseLine"];
            console.log(`getStress=======================baseLine=${baseLine} `)
            if (baseLine > 0) {
                await storePressureZone();
                console.log(`getStress=======================storePressureZone=`)
                let pressureArray = [];
                let motionArray = [];

                getPressureByDateTime(currentDate)
                    .then((array) => {
                        console.log(`getStress=======================getPressureByDateTime=`)
                        var _recoveryTime = 0;
                        var _stressTime = 0;
                        for (var element of array) {
                            pressureArray.push(JSON.parse(element.allZoneList));
                            motionArray.push(...element.allMotionList);
                            _recoveryTime += element.recoveryZoneList.length;
                            _stressTime += element.stressZoneList.length;
                            setPressureBaseLine(element.pressureBaseLine);
                        }
                        setPressureArray(pressureArray);
                        setMotionArray(motionArray);
                        setShowStressChart(true);
                        if (_recoveryTime != 0) {
                            var totalMinutes = _recoveryTime * 15;
                            setRecoveryTime(formatMinutesToHours(totalMinutes));
                        } else {
                            setRecoveryTime("");
                        }
                        if (_stressTime != 0) {
                            var totalMinutes = _stressTime * 15;
                            setStressTime(formatMinutesToHours(totalMinutes));
                        } else {
                            setStressTime("");
                        }
                    });
            }

        } else {
            showDialog();
        }
        setStressTitle('GetStress')
    }



    //Obtain temperature fluctuation data
    async function getTemperature(currentDate) {
        if (isGetHistoryData.current) {
            const temperatureFluctuateData =
                await getSleepTemperatureFluctuateData(
                    currentDate);
            console.log(`temperatureFluctuateData=${JSON.stringify(temperatureFluctuateData)} `)
            if (temperatureFluctuateData != null) {
                setShowTempChart(true);
                setFtcW(Math.round(temperatureFluctuateData["ftcW"] * 100) / 100);
                setTempArr(temperatureFluctuateData["temperatureArray"]);
                setFtcBase(temperatureFluctuateData["ftcBase"]);
            } else {
                setFtcW(0);
                setTempArr([]);
                setFtcBase(0);
            }
        } else {
            showDialog();
        }
        setTempTitle('GetTemperature')
    }

    //从json文件中加载数据到数据库
    async function loadJsonToDB() {
        console.log("loadJsonToDB  after init");
        // for (let index=0;index<historyJson.length;index++){
        //     const data = historyJson[index];
        //     await healthModel.addHistoryDataToDatabase({
        //         timeStamp: data.ts,
        //         heartRate: data.hr,
        //         motionDetectionCount: data.motion,
        //         detectionMode: 0,
        //         wearStatus: data.worn,
        //         chargeStatus: data.workout,
        //         uuid: data.uuid,
        //         hrv: data.hrv,
        //         temperature: parseFloat(data.skinTc),
        //         step: data.steps,
        //         ox: data.spo2,
        //         rawHr: null,
        //         sportsMode: "close",
        //         respiratoryRate: data.rr,
        //     })

        // }
        for (let index = 0; index < testJson.length; index++) {
            const data = testJson[index];
            console.log(`   `);
            await healthModel.addHistoryDataToDatabase({
                timeStamp: data.timeStamp,
                heartRate: data.heartRate,
                motionDetectionCount: data.motionDetectionCount,
                detectionMode: data.detectionMode,
                wearStatus: data.wearStatus,
                chargeStatus: data.chargeStatus,
                uuid: data.uuid,
                hrv: data.hrv,
                temperature: parseFloat(data.temperature),
                step: data.step,
                ox: data.ox,
                rawHr: data.rawHr,
                sportsMode: data.sportsMode,
                respiratoryRate: data.respiratoryRate,
            })
        }
        healthModel.storeSleepData();
        isGetHistoryData.current = true;
    }

    async function storeHistoryAndSleepDataToDatabase(historyData) {
        for (let index = 0; index < historyData.length; index++) {
            const data = historyData[index];
            await healthModel.addHistoryDataToDatabase({
                timeStamp: data.timeStamp,
                heartRate: data.heartRate,
                motionDetectionCount: data.motionDetectionCount,
                detectionMode: data.detectionMode,
                wearStatus: data.wearStatus,
                chargeStatus: data.chargeStatus,
                uuid: data.uuid,
                hrv: data.hrv,
                temperature: parseFloat(data.temperature),
                step: data.step,
                ox: data.ox,
                rawHr: data.rawHr,
                sportsMode: data.sportsMode,
                respiratoryRate: data.respiratoryRate,
            })
        }
        healthModel.storeSleepData();
    }

    async function getSleepTemperatureFluctuateData(date) {
        return await healthModel.getSleepTemperatureFluctuateData(
            date);
    }

    async function getPressureBaseLine(date) {
        return await healthModel.getPressureBaseLine(date);
    }

    async function storePressureZone() {
        await healthModel.storePressureZone();
    }

    async function getPressureByDateTime(date) {
        return await healthModel.getPressureByDateTime(date);
    }

    return {
        loadJsonToDB,
        storeHistoryAndSleepDataToDatabase,
        getTemperature,
        handleTempChartClose,
        setTemperatureShowTitle,
        handleStressChartClose,
        setStressShowTitle,
        getStress,
        getAllBpCalibrationInfo,
        getLastBpCalibrationInfo,
        deleteAllBp,
        setBpCalibrationInfo,
        deleteBpByTs,
        queryBpInTimeStamp,
        // deleteBpHistory,
        ftcW,
        tempArr,
        ftcBase,
        showTempChart,
        tempTitle,
        stressDays,
        pressureArray,
        motionArray,
        pressureBaseLine,
        recoveryTime,
        stressTime,
        showStressChart,
        stressTitle,
    }


}