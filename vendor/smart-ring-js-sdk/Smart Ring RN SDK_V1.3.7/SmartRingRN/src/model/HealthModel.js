import RealmManager from '../db/RealmManager';
import { TrainingZone, MotionType, classifyStressLevel, getMotionType } from '../db/common/pressureCommon';
import { formatDateTime } from '../utils/TimeFormat';
import {
  NativeModules
} from "react-native";
import {formatToHm} from '../utils/TimeFormat';
const { NativeSleepModule, SleepDataMoudle } = NativeModules;

//Obtain pressure and temperature fluctuations
export default class HealthModel {
  static instance = null;
  MINUTE = 60 * 1000;
  HOUR = 60 * 60 * 1000;
  isInit = false;

  constructor() {
    if (HealthModel.instance) {
      return HealthModel.instance;
    }
    HealthModel.instance = this;
    
  }

  init() {
    if(!this.isInit){
      this.isInit=true;
      this.realmManager = new RealmManager();
      this.realmManager.init();
      this.historyModel = this.realmManager.getHistoryModel();
      this.sleepModel = this.realmManager.getSleepModel();
      this.pressureModel = this.realmManager.getPressureModel();
      this.bloodPressureModel = this.realmManager.getBloodPressureModel();
    }
  }

  getHistoryModel() {
    return this.historyModel;
  }

  getSleepModel() {
    return this.sleepModel;
  }

  getBloodPressureModel() {
    return this.bloodPressureModel;
  }

  // async getBpCalibrationInfo() {
  //   return await this.bloodPressureModel.queryBpCalibrationInfo();
  // }

  async getLastBpCalibrationInfo(){
    return await this.bloodPressureModel.queryLastBp();
  }

  async queryBpInTimeStamp(ts){
    return await this.bloodPressureModel.queryBpInTimeStamp(ts);
  }

  async getAllBpCalibrationInfo(){
    return await this.bloodPressureModel.queryAllBpCalibrationInfo();
  }

  async deleteAllBp(){
    return await this.bloodPressureModel.deleteAllBp();
  }

  async deleteBpByTs(ts){
    return await this.bloodPressureModel.deleteBpByTs(ts);
  }

  setBpCalibrationInfo(info) {
    return this.bloodPressureModel.setBpCalibrationInfo(info);
  }

  // deleteBpHistory = () => {
  //   return this.bloodPressureModel.deleteHistory();
  // }

  async storeSleepData() {
    await this.sleepModel.deleteLastSleepData();  
    // await this.sleepModel.deleteAllSleep();
    // await this.pressureModel.deletePressure();
    const timeStamp = await this.sleepModel.getLastSleepTime();
    // debugPrint("storeSleepData timeStamp=$timeStamp");
    // eslint-disable-next-line no-console
    console.log(`storeSleepData timeStamp=${timeStamp}`);
    let historyArr = [];
    if (timeStamp == null) {
      historyArr = await this.historyModel.queryAllHistory();
    } else {
      historyArr = await this.historyModel.queryInTimeStamp(timeStamp);
    }
    await this.addSleepData(historyArr);
  }

  async addSleepData(historyData) {
    if (historyData.length == 0) {
      return;
    }
    const sleepArray = this.dealHistoryData(historyData);
    if (sleepArray.length == 0) {
      return;
    }
    const result = await this.sleepAlgorithm(sleepArray);
    const sleepTimePeriodArray = result.sleepTimePeriodArray;
    const sleepPeriodItemArray = result.sleepPeriodItemArray;
    const sleepTimeArray = result.sleepTimeArray;
    for (var i = 0; i < sleepTimePeriodArray.length; i++) {
      var sleepPeriodTime = sleepTimePeriodArray[i];
      var sleepPeriodItem = sleepPeriodItemArray[i];
      var sleepTime = sleepTimeArray[i];
      var wakeArr = sleepPeriodItem.wakePeriod;
      let ftcAvg = 0;
      //睡眠开始时间
      let sleepStartTime = sleepPeriodTime.sleepTimePeriod.startTime;
      //睡眠结束时间
      let sleepEndTime = sleepPeriodTime.sleepTimePeriod.endTime;
      let duration = sleepEndTime - sleepStartTime;
      if (this.isMoreThanThreeHours(sleepStartTime, sleepEndTime)) {
        ftcAvg = await this.historyModel.calFtcAvg(
          sleepStartTime, sleepEndTime, wakeArr);
        // debugPrint("isMoreThanThreeHours ftcAvg=$ftcAvg");
      }

      var pressureBaseLine = await this.sleepModel.findPressureBaseLine(
        new Date(sleepEndTime));
      let hrvAvg = await this.historyModel.calHrvAvg(sleepStartTime, sleepEndTime);
      let isNap = sleepTime.napSleepTime > 0 ? true : false;
      let ftcBase = await this.sleepModel.findFtcAvgGreaterThanZeroFor7Days(
        new Date(sleepEndTime));
        
      ftcBase = ftcBase == null ? ftcAvg : ftcBase;
      let isFtcOutlier = this.sleepModel.isFtcOutlier(ftcAvg, ftcBase);
      console.log("addSleepData ftcBase=" + ftcBase+"  ftcAvg="+ftcAvg+"sleepEndTime="+sleepEndTime+" isFtcOutlier="+isFtcOutlier);
      await this.sleepModel.addSleep({
        startTimeStamp: sleepStartTime,
        endTimeStamp: sleepEndTime,
        duration: duration,
        ftcAvg: ftcAvg,
        avgHrv: hrvAvg,
        startTime: sleepTime.startTime,
        endTime: sleepTime.endTime,
        deepSleep: sleepTime.deepSleep,
        deepSleepTime: sleepTime.deepSleepTime,
        lightSleep: sleepTime.lightTime,
        lightSleepTime: sleepTime.lightSleepTime,
        remSleep: sleepTime.remTime,
        remSleepTime: sleepTime.remSleepTime,
        wakeSleep: sleepTime.wakeTime,
        wakeSleepTime: sleepTime.wakeSleepTime,
        napSleep: sleepTime.napTime,
        napSleepTime: sleepTime.napSleepTime,
        ftcBase: ftcBase,
        nap: isNap,
        isFtcOutlier: isFtcOutlier,
        pressureBaseLine: pressureBaseLine
      });
    }
  }

  //比较2个毫秒时间戳是否超过3小时
  isMoreThanThreeHours = (startTime, endTime) => {
    const duration = Math.abs(endTime - startTime);
    return duration >= 3 * 60 * 60 * 1000;
  }

  sleepAlgorithm(sleepArray) {
    return new Promise((resolve, _) => {
      if (Platform.OS == "android") {
        NativeSleepModule.getSleepData(sleepArray, (result) => {
          var sleepTimeArray = [];
          var sleepTimePeriodArray = [];
          var sleepPeriodItemArray = [];
          for (let index = 0; index < result.length; index++) {
            const data = result[index];
            var lightTime = 0;
            var deepTime = 0;
            var remTime = 0;
            var wakeTime = 0;
            var napTime = 0;
            var lightArr = [];
            var deepArr = [];
            var napArr = [];
            var remArr = [];
            var wakeArr = [];
            var stagingList = data.stagingList;
            for (let index = 0; index < stagingList.length; index++) {
              const element = stagingList[index];
              switch (element.stagingType) {
                case "NREM1":
                  lightTime += element.endTime - element.startTime
                  lightArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break
                case "NREM3":
                  deepTime += element.endTime - element.startTime
                  deepArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
                case "REM":
                  remTime += element.endTime - element.startTime
                  remArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
                case "WAKE":
                  wakeTime += element.endTime - element.startTime
                  wakeArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
                case "NAP":
                  napTime += element.endTime - element.startTime
                  napArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
              }
            }
            sleepPeriodItemArray.push({
              lightPeriod: lightArr,
              remPeriod: remArr,
              deepPeriod: deepArr,
              napPeriod: napArr,
              wakePeriod: wakeArr,
            });
            let formatMn=`deepTime=`+formatToHm(deepTime)
            console.log("formatHn="+formatMn);
            sleepTimeArray.push({
              deepSleep: `deepTime=`+formatToHm(deepTime),
              lightTime: `lightTime=`+formatToHm(lightTime),
              remTime: `remTime=`+formatToHm(remTime),
              wakeTime: `wakeTime=`+formatToHm(wakeTime),
              napTime: `napTime=`+formatToHm(napTime),
              deepSleepTime: deepTime,
              lightSleepTime: lightTime,
              remSleepTime: remTime,
              wakeSleepTime: wakeTime,
              napSleepTime: napTime,
              startTime: formatDateTime(data.startTime),
              endTime: formatDateTime(data.endTime)
            })
            sleepTimePeriodArray.push({
              sleepTimePeriod: {
                startTime: data.startTime,
                endTime: data.endTime
              }
            })
          }
          resolve({
            "sleepTimeArray": sleepTimeArray,
            "sleepTimePeriodArray": sleepTimePeriodArray,
            "sleepPeriodItemArray": sleepPeriodItemArray
          })
        })
      } else {
        SleepDataMoudle.getIOSSleepData(sleepArray, (error, result) => {
          var sleepTimeArray = [];
          var sleepTimePeriodArray = [];
          var sleepPeriodItemArray = [];
          for (let index = 0; index < result.length; index++) {
            const data = result[index];
            var lightTime = 0;
            var deepTime = 0;
            var remTime = 0;
            var wakeTime = 0;
            var napTime = 0;
            var lightArr = [];
            var deepArr = [];
            var napArr = [];
            var remArr = [];
            var wakeArr = [];
            var stagingList = data.stagingList;
            for (let index = 0; index < stagingList.length; index++) {
              const element = stagingList[index];
              switch (element.stagingType) {
                case "NREM1":
                  lightTime += element.endTime - element.startTime
                  lightArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break
                case "NREM3":
                  deepTime += element.endTime - element.startTime
                  deepArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
                case "REM":
                  remTime += element.endTime - element.startTime
                  remArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
                case "WAKE":
                  wakeTime += element.endTime - element.startTime
                  wakeArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
                case "NAP":
                  napTime += element.endTime - element.startTime
                  napArr.push({
                    startTime: element.startTime,
                    endTime: element.endTime
                  });
                  break;
              }
            }
            sleepPeriodItemArray.push({
              lightPeriod: lightArr,
              remPeriod: remArr,
              deepPeriod: deepArr,
              napPeriod: napArr,
              wakePeriod: wakeArr,
            });

            sleepTimeArray.push({
              deepSleep: `deepTime=`+formatToHm(deepTime),
              lightTime: `lightTime=`+formatToHm(lightTime),
              remTime: `remTime=`+formatToHm(remTime),
              wakeTime: `wakeTime=`+formatToHm(wakeTime),
              napTime: `napTime=`+formatToHm(napTime),
              deepSleepTime: deepTime,
              lightSleepTime: lightTime,
              remSleepTime: remTime,
              wakeSleepTime: wakeTime,
              napSleepTime: napTime,
              startTime: formatDateTime(data.startTime),
              endTime: formatDateTime(data.endTime)
            })
            sleepTimePeriodArray.push({
              sleepTimePeriod: {
                startTime: data.startTime,
                endTime: data.endTime
              }
            })
          }
          resolve({
            "sleepTimeArray": sleepTimeArray,
            "sleepTimePeriodArray": sleepTimePeriodArray,
            "sleepPeriodItemArray": sleepPeriodItemArray
          })
        })
      }

    })
  }

  dealHistoryData(historyArr) {
    const sleepArray = [];
    // var hrArray = [];
    historyArr.forEach((data) => {
      let isBadData = false;
      if (data.rawHr == null) {
        isBadData = false;
      } else if (data.rawHr.length == 3 &&
        data.rawHr[0] == 200 &&
        data.rawHr[1] == 200 &&
        data.rawHr[2] == 200) {
        isBadData = true;
      }
      // debugPrint("data[heartRate]=${data["heartRate"]}  data[wearStatus]=${data["wearStatus"]} data[chargeStatus]=${data["chargeStatus"]}");
      if (data.heartRate >= 50 &&
        data.heartRate <= 175 &&
        data.wearStatus == 1 &&
        data.chargeStatus == 0 &&
        !isBadData) {
        sleepArray.push({
          "ts": data.timeStamp,
          "hr": data.heartRate,
          "hrv": data.hrv,
          "motion": data.motionDetectionCount,
          "steps": data.step,
          "ox": data.ox
        });
      }
      //   if (data.heartRate >= 60 &&
      //       data.heartRate <= 175 &&
      //       data.wearStatus == 1 &&
      //       data.chargeStatus == 0 &&
      //       !isBadData) {
      //     hrArray.push({
      //       "ts": data.timeStamp,
      //       "hr": data.heartRate,
      //     });
      //   }
    });
    return sleepArray
  }

  async getSleepTemperatureFluctuateData(date) {
    const sleepData = await this.sleepModel.getSleepDataByDate(date);
    console.log("getSleepTemperatureFluctuateData sleepData="+JSON.stringify(sleepData) +" date="+date);
    if (sleepData==null) return null;
    const sleepDataWithoutNap = sleepData
      .filter(element => !element.nap && element.ftcAvg !== 0);
    if (sleepDataWithoutNap.length == 0) return null;
    console.log("getSleepTemperatureFluctuateData sleepDataWithoutNap.length=" + sleepDataWithoutNap.length+" sleepDataWithoutNap.isEmpty="+sleepDataWithoutNap.isEmpty);
    const longestSleepRecord = sleepDataWithoutNap.reduce(
      (longestSoFar, current) =>
        longestSoFar.duration > current.duration ? longestSoFar : current);
    const historyData = await this.historyModel.queryInTimeStamp(
      longestSleepRecord.startTimeStamp, longestSleepRecord.endTimeStamp);
    const baseDate = longestSleepRecord.ftcBase == 0
      ? longestSleepRecord.ftcAvg
      : longestSleepRecord.ftcBase;
    const temperatureArray = historyData.map((data) => {
      return {
        timeStamp: data.timeStamp,
        temp: data.temperature - baseDate,
      };
    });
    return {
      temperatureArray: temperatureArray,
      ftcW: longestSleepRecord.ftcAvg - baseDate,
      ftcBase: baseDate,
    };
  }

  async getPressureBaseLine(date) {
    return await this.sleepModel.findPressureBaseLine(date);
  }

  async getPressureByDateTime(dateTime){
    return await this.pressureModel.getPressureByDateTime(dateTime);
  }

  async storePressureZone() {
    const timeStamp = await this.pressureModel.getLastPressureTimeStamp();
    // eslint-disable-next-line no-console
  console.log(`storePressureZone timeStamp=${timeStamp}`);
    let historyArr = [];
    if (timeStamp == null) {
      historyArr = await this.historyModel.queryAllHistory();
    } else {
      historyArr = await this.historyModel.queryInTimeStamp(timeStamp);
    }
    if (historyArr.isEmpty) {
      return;
    }
    await this.pressureModel.deleteLastPressure();
    // 创建一个Map来存储按天分组的历史数据
    let dailyDataMap = new Map();

    for (var data of historyArr) {
      let dateTime = new Date(data.timeStamp);
      let startDateOfTheDay = new Date(dateTime.getFullYear(), dateTime.getMonth(), dateTime.getDate());
      let dateString = startDateOfTheDay.toISOString().split('T')[0];
      // let startDateOfTheDay1 = new Date(dateString);
      // startDateOfTheDay1.setHours(24, 0, 0, 0);
      // console.log("storePressureZone startDateOfTheDay=" + startDateOfTheDay+" startDateOfTheDay1="+startDateOfTheDay1+" dateString"+dateString +"dailyDataMap.has(startDateOfTheDay)=" + dailyDataMap.has(dateString));
      // 检查Map中是否已经存在这一天的列表
      if (!dailyDataMap.has(dateString)) {
        // 如果没有，则初始化一个新数组并将数据添加进去
        dailyDataMap.set(dateString, [data]);
      } else {
        // 如果已有，则直接向存在的数组中添加数据
        dailyDataMap.get(dateString).push(data);
      }
    }

    // console.log("storePressureZone dailyDataMap.size=" + dailyDataMap.size+"  dailyDataMap"+JSON.stringify(Object.fromEntries(dailyDataMap)));

    let classifiedDataMap = new Map();
    // debugPrint("classifiedDataMap 开始初始化");
    const future = Array.from(dailyDataMap.keys()).map(async (dateString) => {
      let date = new Date(dateString);
      date.setHours(24, 0, 0, 0);
      // console.log("storePressureZone date=" + date);
      let count = 0;
      let hrvaSum = 0.0;
      let motionSum = 0;
      let initialTimestamp = 0;
      let isDirtyData = false;
      let previousData = null;
      let previousSteps = 0;
      const sleepDataForDate = await this.sleepModel.getSleepDataByDate(date);
      // console.log("storePressureZone 1");
      // if (date.day == 16) {
      //   debugPrint("date=$date date.day=${date.day}");
      // }
      for (var data of dailyDataMap.get(dateString)) {
        // console.log("storePressureZone 2 time="+new Date().getTime());
        const pressureBaseLineMap = await this.getPressureBaseLine(date);
        const pressureBaseLine = pressureBaseLineMap.baseLine;
        // console.log("storePressureZone data="+JSON.stringify(data) +" pressureBaseLine="+pressureBaseLine);
        // if (date.day == 16) {
        //   debugPrint(
        //       "date=$date date.day=${date.day} ${smartring_plugin.formatDateTime(data.timeStamp)} data.wearStatus=${data.wearStatus} data.chargeStatus=${data.chargeStatus} ");
        // }
        if (pressureBaseLine != 0) {
          if (data.wearStatus == 0 || data.chargeStatus == 1) {
            isDirtyData = true;

          }

          if (previousData !== null) {
            const previousTimestamp = previousData.timeStamp;
            const timeDifference = data.timeStamp - previousTimestamp; // 计算毫秒差

            // 将毫秒差转换为分钟
            const minutesDifference = Math.floor(timeDifference / 60000);

            if (minutesDifference >= 4 && minutesDifference <= 8) {
              if (data.step - previousSteps > 500) {
                isDirtyData = true;
                // 如果需要模拟Dart中的debugPrint，可以使用console.log
                // if (date.getDate() === 16) { // 假设date是当前日期对象
                //     console.log(`步数大于500 ${formatDateTime(data.timeStamp)} data.step=${data.step} previousSteps=${previousData.step} return`);
                // }
              }
            }
          }

          if (sleepDataForDate.length > 0) {
            for (var sleep of sleepDataForDate) {
              const sleepStart = sleep.startTimeStamp;
              const sleepEnd = sleep.endTimeStamp;
              if (sleepStart <= data.timeStamp && sleepEnd >= data.timeStamp) {
                isDirtyData = true;
                // if (date.day == 16) {
                //   debugPrint(
                //       "睡眠期间 ${smartring_plugin.formatDateTime(data.timeStamp)} data.timeStamp=${data.timeStamp} sleepStart=${sleepStart} sleepEnd=${sleepEnd} return");
                // }
                break;
              }
            }
          }

          // 更新前一次数据
          previousData = data;
          previousSteps = data.step;

          if (count == 0) {
            motionSum = data.motionDetectionCount;
            hrvaSum = data.hrv;
            initialTimestamp = data.timeStamp;
          } else {
            hrvaSum += data.hrv;
            motionSum += data.motionDetectionCount;
          }
          count++;

          if (count == 3) {
            if (isDirtyData) {
              count = 0;
              hrvaSum = 0;
              motionSum = 0;
              // initialTimestamp = 0;
              isDirtyData = false;
              continue;
            }
            const lastTimestamp = data.timeStamp;
            const timeWindow = lastTimestamp - initialTimestamp;

            if (Math.floor(timeWindow / 60000) <= 15) {
              const pressure = hrvaSum / count;
              const stressLevel =
                classifyStressLevel(pressure, pressureBaseLine);
                let pressureData={
                  'timeStamp': data.timeStamp,
                  'stressLevel': stressLevel,
                  'baseLine': pressureBaseLine,
                  'pressure': pressure,
                  'motionSum': motionSum,
                  'motionType': getMotionType(motionSum),
                }
                if (!classifiedDataMap.has(dateString)) {
                  // 如果没有，则初始化一个新数组并将数据添加进去
                  classifiedDataMap.set(dateString, [pressureData]);
                } else {
                  // 如果已有，则直接向存在的数组中添加数据
                  classifiedDataMap.get(dateString).push(pressureData);
                }
              // classifiedDataMap[date] = classifiedDataMap[date] || [];
              // // console.log("storePressureZone date="+date+" classifiedDataMap[date]="+classifiedDataMap[date]);
              // classifiedDataMap[date].push({
              //   'timeStamp': data.timeStamp,
              //   'stressLevel': stressLevel,
              //   'baseLine': pressureBaseLine,
              //   'pressure': pressure,
              //   'motionSum': motionSum,
              //   'motionType': getMotionType(motionSum),
              // });
            }
            count = 0;
            hrvaSum = 0.0;
            motionSum = 0;
            initialTimestamp = 0;
            isDirtyData = false;
          }
        } else {
          continue;
        }
      }
      console.log("storePressureZone 3");
      // console.log("storePressureZone date="+date+" classifiedDataMap[date]="+classifiedDataMap[date]);
      return Promise.resolve(null);
    });
    await Promise.all(future);
    console.log("storePressureZone classifiedDataMap.size=" + classifiedDataMap.size+"  classifiedDataMap"+JSON.stringify(classifiedDataMap.keys()));
    // Array.from(classifiedDataMap.keys()).map(async (date) => {
    //   console.log("storePressureZone date="+date);
    //   console.log("storePressureZone classifiedDataMap[date]="+classifiedDataMap[date]);
    // });
    classifiedDataMap.forEach(async (dataList, dateString) => {
      console.log("进入 classifiedDataMap");
      let date = new Date(dateString);
      date.setHours(24, 0, 0, 0);
      // console.log("storePressureZone date="+date+" dataList="+JSON.stringify(dataList));
      let pressureRecord = {
        timeStamp: 0, // 我们将在最后填充正确的最新时间戳
        stressZoneList: [],
        engagementZoneList: [],
        relaxationZoneList: [],
        recoveryZoneList: [],
        pressureBaseLine: 0.0,
        extremelyLowMotionList: [],
        lowMotionList: [],
        mediumMotionList: [],
        highMotionList: [],
        allMotionList: [],
        allZoneList: "",
      };
      // debugPrint("date=$date dataList=$dataList");
      console.log("storePressureZone date="+date+" dataList.length="+dataList.length);
      if (dataList.length > 0) {
        let timeZoneCounter = 1;
        let allZoneList = {};
        const timestampInMs = date.getTime();
        pressureRecord.timeStamp = timestampInMs;
        pressureRecord.pressureBaseLine = dataList[0]['baseLine'];
        console.log("storePressureZone timestampInMs="+timestampInMs+" dataList[0]['baseLine']="+dataList[0]['baseLine']);
        for (let i = 0; i < dataList.length; i++) {
          let item = dataList[i];
          let trainingZone = item['stressLevel'];
          let motionType = item['motionType'];
          let currentTimestamp = item['timeStamp'];
          // if(!allZoneList.hasOwnProperty(timeZoneCounter)){

          // }else{

          // }
          allZoneList[timeZoneCounter] = allZoneList[timeZoneCounter] || [];
          allZoneList[timeZoneCounter].push({
            "timeStamp": item['timeStamp'],
            "stressLevel": item['stressLevel'],
            "pressure": item['pressure'],
            "timeZone": timeZoneCounter,
            "dashedLine": false,
          });

          // console.log(`allZoneList=${JSON.stringify(allZoneList)}`);

          if (i < dataList.length - 1) {
            let nextItem = dataList[i + 1];
            let nextTimestamp = nextItem['timeStamp'];
            let difference = nextTimestamp - currentTimestamp


            if (difference >= 2 * 60 * 60 * 1000) {
              timeZoneCounter++;
            } else if (difference.inMinutes > 18 * 60 * 1000) {
              allZoneList[timeZoneCounter][allZoneList[timeZoneCounter].length - 1]['dashedLine'] = true;
            }
          }
          pressureRecord.allZoneList = JSON.stringify(allZoneList);
          pressureRecord.allMotionList.push({
            "timeStamp": item['timeStamp'],
            "motionType": item['motionType'],
            "motionSum": item['motionSum'],
          });

          switch (trainingZone) {
            case TrainingZone.StressZone:
              pressureRecord.stressZoneList.push({
                "timeStamp": item['timeStamp'],
                "stressLevel": item['stressLevel'],
                "pressure": item['pressure'],
              });
              break;
            case TrainingZone.EngagementZone:
              pressureRecord.engagementZoneList.push({
                "timeStamp": item['timeStamp'],
                "stressLevel": item['stressLevel'],
                "pressure": item['pressure'],
              });
              break;
            case TrainingZone.RelaxationZone:
              pressureRecord.relaxationZoneList.push({
                "timeStamp": item['timeStamp'],
                "stressLevel": item['stressLevel'],
                "pressure": item['pressure'],
              });
              break;
            case TrainingZone.RecoveryZone:
              pressureRecord.recoveryZoneList.push({
                "timeStamp": item['timeStamp'],
                "stressLevel": item['stressLevel'],
                "pressure": item['pressure'],
              });
              break;
            default:
              // 不应该发生，但可以在此处进行错误处理或者记录日志
              break;
          }
          switch (motionType) {
            case MotionType.ExtremelyLow:
              pressureRecord.extremelyLowMotionList.push({
                "timeStamp": item['timeStamp'],
                "motionType": item['motionType'],
                "motionSum": item['motionSum'],
              });
              break;
            case MotionType.Low:
              pressureRecord.lowMotionList.push({
                "timeStamp": item['timeStamp'],
                "motionType": item['motionType'],
                "motionSum": item['motionSum'],
              });
              break;
            case MotionType.Medium:
              pressureRecord.mediumMotionList.push({
                "timeStamp": item['timeStamp'],
                "motionType": item['motionType'],
                "motionSum": item['motionSum'],
              });
              break;
            case MotionType.High:
              pressureRecord.highMotionList.push({
                "timeStamp": item['timeStamp'],
                "motionType": item['motionType'],
                "motionSum": item['motionSum'],
              });
              break;
            default:
              // 不应该发生，但可以在此处进行错误处理或者记录日志
              break;
          }
        }
        console.log("storePressureZone date="+date+" timeStamp="+pressureRecord.timeStamp+" pressureRecord="+JSON.stringify(pressureRecord));
        await this.pressureModel.addPressure(pressureRecord);
        pressureRecord = {
          timeStamp: 0, // 我们将在最后填充正确的最新时间戳
          stressZoneList: [],
          engagementZoneList: [],
          relaxationZoneList: [],
          recoveryZoneList: [],
          pressureBaseLine: 0,
          extremelyLowMotionList: [],
          lowMotionList: [],
          mediumMotionList: [],
          highMotionList: [],
          allMotionList: [],
          allZoneList: "",
        };
      }
    });
  }
  //将历史数据存入数据库
  addHistoryDataToDatabase(history) {
    return this.historyModel.addHistory(history);
  }

}