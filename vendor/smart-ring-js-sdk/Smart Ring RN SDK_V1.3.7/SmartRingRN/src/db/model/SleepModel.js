import Realm from 'realm';
import realmConfig from '../config/realmConfig';
import { Sleep } from '../sleep';
import {formatDateTime} from '../../utils/TimeFormat';

export default class SleepModel {
    static instance = null;

    constructor() {
        if (SleepModel.instance) {
            return SleepModel.instance;
        }
        SleepModel.instance = this;
    }

    init() {
        this.openRealm();
    }

    queryInTimeStamp(startTimeStamp, endTimeStamp) {
        return new Promise((resolve, reject) => {
            try {
                let result = this.realm.objects(Sleep).filtered('startTimeStamp >= $0 && endTimeStamp <= $1 || startTimeStamp <= $0 && endTimeStamp >= $0', startTimeStamp, endTimeStamp)
                resolve(Array.from(result));
            } catch (error) {
                reject(error);
                console.log("queryInTimeStamp=" + error)
            }
        })
    }

    getSleepDataByDate(dateTime) {
        return new Promise((resolve, reject) => {
            try {
                //通过dateTime获取当天0点的时间戳作为开始时间戳
                let startTimeStamp = dateTime.setHours(0, 0, 0, 0);
                //获取当天24点的时间戳作为结束时间戳
                let endTimeStamp = dateTime.setHours(23, 59, 59, 999);
                let result = this.realm.objects(Sleep).filtered('startTimeStamp >= $0 && endTimeStamp <= $1 || startTimeStamp <= $0 && endTimeStamp >= $0', startTimeStamp, endTimeStamp)
                if(result.isEmpty()){
                    resolve(null);
                }else{
                    resolve(Array.from(result));
                }
                
            } catch (error) {
                reject(error);
                console.log("getSleepDataByDate=" + error)
            }
        })
    }

    findFtcAvgGreaterThanZeroFor7Days(startDate) {
        return new Promise(async (resolve, reject) => {
            try {
                let oneDay = 24 * 60 * 60 * 1000;
                let yesterday = new Date(startDate.getTime() - oneDay);
                let yesterdayStart = yesterday.setHours(0, 0, 0, 0);
                let yesterdayEnd = yesterday.setHours(23, 59, 59, 999);
                const firstData = await this.getFirstData();
                
                if (firstData == null) {
                    resolve(null);
                    return;
                }
                let result = [];
                while (result.length < 7) {
                    if (firstData.startTimeStamp > yesterdayEnd) {
                        break;
                    }
                    const dayRecords = await this.queryInTimeStamp(
                        yesterdayStart,
                        yesterdayEnd,
                    );
                    var maxDuration = 0;
                    var maxFtcAvg = 0;
                    for (let i = 0; i < dayRecords.length; i++) {
                        const record = dayRecords[i];
                        if (record.duration > maxDuration && record.ftcAvg > 0 && !record.isFtcOutlier) {
                            maxDuration = record.duration;
                            maxFtcAvg = record.ftcAvg;
                        }
                        if (i == dayRecords.length - 1 && maxFtcAvg != 0) {
                            result.push(maxFtcAvg);
                        }
                    }
                    yesterday = new Date(yesterday.getTime() - oneDay);
                    yesterdayStart = yesterday.setHours(0, 0, 0, 0);
                    yesterdayEnd = yesterday.setHours(23, 59, 59, 999);
                }
                if (result.length == 0) {
                    resolve(null);
                    return;
                }
                const avg = result.reduce((acc, cur) => acc + cur, 0) / result.length;
                //avg保留一位小数
                resolve(parseFloat(avg.toFixed(1)));
            } catch (error) {
                reject(error);
                console.log("findFtcAvgGreaterThanZeroFor7Days=" + error)
            }
        })
    }

    //获取第一条数据
    getFirstData() {
        return new Promise((resolve, reject) => {
            try {
                let result = this.realm.objects(Sleep).sorted('startTimeStamp', false)[0];
                resolve(result);
            } catch (error) {
                reject(error);
                console.log("getFirstData=" + error)
            }
        })
    }
    queryAllSleep() {
        return new Promise((resolve, reject) => {
            try {
                let sleep = this.realm.objects(Sleep)
                resolve(Array.from(sleep));
            }
            catch (error) {
                reject(error);
                console.log("queryAllSleep=" + error)
            }
        })
    }

    addSleep = (sleep) => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    let oldSleep = this.realm.objects(Sleep).filtered(`startTimeStamp = ${sleep.startTimeStamp}`);
                    let count = oldSleep.length;
                    // console.log(`insertHistory count=${count} oldHistory=${JSON.stringify(oldHistory)}`)
                    if (count == 0) {
                        this.realm.create(Sleep, sleep, Realm.UpdateMode.Never)
                        resolve("add sleep success")
                    } else {
                        // console.log(`Record skipped due to duplicate timestamp  `);
                        resolve("this sleep is exist");
                    }
                })
            }
            catch (error) {
                reject(error);
                console.log("addPressure=" + error)
            }
        })
    }

    deleteSleep = (sleep) => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    this.realm.delete(sleep);
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteSleep=" + error)
            }
        })
    }

    deleteAllSleep = () => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    this.realm.delete(this.realm.objects(Sleep));
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteAllSleep=" + error)
            }
        })

    }

    //删除最后一条睡眠数据
    deleteLastSleepData = () => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    let sleep = this.realm.objects(Sleep).sorted('startTimeStamp', true)[0];
                    if (sleep) {
                        this.realm.delete(sleep);
                    }
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteLastSleep=" + error)
            }
        })
    }

    //获取最后一条睡眠时间
    getLastSleepTime = () => {
        return new Promise((resolve, reject) => {
            try {
                let sleep = this.realm.objects(Sleep).sorted('startTimeStamp', true)[0];
                if (sleep) {
                    resolve(sleep.endTimeStamp);
                } else {
                    resolve(null);
                }

            }
            catch (error) {
                reject(error);
                console.log("getLastSleepTime=" + error)
            }
        })
    }

    //计算压力的基线值
    findPressureBaseLine = (startDate) => {
        return new Promise(async (resolve, reject) => {
            try {
                let oneDay = 24 * 60 * 60 * 1000;
                let ThreeHourMilliseconds = 3 * 60 * 60 * 1000;
                let yesterday = new Date(startDate.getTime() - oneDay);
                let yesterdayStart = yesterday.setHours(0, 0, 0, 0);
                let yesterdayEnd = yesterday.setHours(23, 59, 59, 999);
                let fourteenday = new Date(startDate.getTime() - 13 * oneDay);
                let fourteendayStart = fourteenday.setHours(0, 0, 0, 0);
                
                const firstData = await this.getFirstData();
                if (firstData == null) {
                    resolve({ 'baseLine': 0, 'downCount': 5 });
                    return;
                }
                let result = [];
                while (result.length <= 14) {
                    if (firstData.startTimeStamp > yesterdayEnd || fourteendayStart >
                        yesterdayEnd) {
                        break;
                    }
                    const dayRecords = await this.queryInTimeStamp(
                        yesterdayStart,
                        yesterdayEnd,
                    );
                    let hrvList = [];
                    for (const record of dayRecords) {
                        if (record.avgHrv > 0 &&
                            record.duration >= ThreeHourMilliseconds) {
                            hrvList.push(record.avgHrv);
                            break;
                        }
                    }
                    if (hrvList.length > 0) {
                        const avgHrv = hrvList.reduce((value, element) => value + element) / hrvList.length;
                        result.push(avgHrv);
                    }
                    yesterday = new Date(yesterday.getTime() - oneDay);
                    yesterdayStart = yesterday.setHours(0, 0, 0, 0);
                    yesterdayEnd = yesterday.setHours(23, 59, 59, 999);
                }
                if (result.length < 5) {
                    resolve({ 'baseLine': 0, 'downCount': 5 - result.length });
                    return;
                }
                const avg = result.reduce((acc, cur) => acc + cur, 0) / result.length;
                //avg保留一位小数
                resolve({
                    'baseLine': parseFloat(avg.toFixed(1)),
                    'downCount': 0
                });
            } catch (error) {
                reject(error);
                console.log("findPressureBaseLine=" + error)
            }
        })
    }

    isFtcOutlier(ftcAvg, ftcBase) {
        return Math.abs(ftcAvg - ftcBase) > 1;
    }

    //将数据库中所有数据导出为json文件
    exportAllSleep = () => {
        return new Promise((resolve, reject) => {
            try {
                let allSleep = this.realm.objects(Sleep);
                let json = JSON.stringify(Array.from(allSleep), null, 2);
                // let fileName = `sleep_${new Date().toLocaleDateString()}.json`;
                // let file = new File([json], fileName, { type: "text/plain;charset=utf-8" });
                resolve(json);
            }
            catch (error) {
                reject(error);
                console.log("exportAllSleep=" + error)
            }
        })
    }

    closeRealm() {
        this.realm.close();
    }

    openRealm() {
        if (!this.realm) {
            this.realm = new Realm(realmConfig);
        }
    }


}