import Realm from 'realm';
import realmConfig from '../config/realmConfig';
import { History } from '../history';


export default class HistoryModel {
    static instance = null;

    constructor() {
        if (HistoryModel.instance) {
            return HistoryModel.instance;
        }
        HistoryModel.instance = this;
    }

    init(){
        this.openRealm();
    }

    queryInTimeStamp(startTimeStamp, endTimeStamp) {
        return new Promise((resolve, reject) => {
            let result;
            try {
                // console.log(` startTimeStamp=${startTimeStamp} endTimeStamp=${endTimeStamp}`);
                if (!endTimeStamp) {
                    result = this.realm.objects(History).filtered('timeStamp >= $0 ', startTimeStamp)
                } else {
                    result = this.realm.objects(History).filtered('timeStamp >= $0 && timeStamp <= $1', startTimeStamp, endTimeStamp)
                }
                resolve(Array.from(result));
            } catch (error) {
                reject(error);
                console.log("queryInTimeStamp=" + error)
            }
        })
    }

    queryAllHistory() {
        return new Promise((resolve, reject) => {
            try {
                let history = this.realm.objects(History)
                resolve(Array.from(history));
            }
            catch (error) {
                reject(error);
                console.log("queryAllHistory=" + error)
            }
        })

    }

    deleteHistory = () => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    this.realm.delete(this.realm.objects(History));
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteHistory=" + error)
            }
        })

    }

    addHistory = (history) => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    let oldHistory = this.realm.objects(History).filtered(`timeStamp = ${history.timeStamp}`);
                    let count = oldHistory.length;
                    // console.log(`insertHistory count=${count} oldHistory=${JSON.stringify(oldHistory)}`)
                    if (count == 0) {
                        this.realm.create(History, history, Realm.UpdateMode.Never)
                        console.log("add history success")
                        resolve("add history success")
                    } else {
                        // console.log(`Record skipped due to duplicate timestamp  `);
                        console.log("Record skipped due to duplicate timestamp");
                        resolve("Record skipped due to duplicate timestamp");
                    }

                })
            }
            catch (error) {
                reject(error);
                console.log("addHistory=" + error)
            }
        })

    }

    async addAllHistory(historyList) {
        for (var history of historyList) {
            await this.addHistory(history);
        }
    }

    //计算睡眠期间的平均温度
    /**
     * 
     * @param {*} startTimeStamp 睡眠开始时间
     * @param {*} endTimeStamp 睡眠结束时间
     * @param {*} wakeArr 苏醒的数据
     * @returns 
     */
    calFtcAvg = (
        startTimeStamp, endTimeStamp, wakeArr) => {
        return new Promise(async (resolve, reject) => {
            try {
                let history = await this.queryInTimeStamp(startTimeStamp, endTimeStamp);
                let count = history.length;
                let temperatureSum = 0;
                let temperatureLen=0;
                for (let i = 0; i < count; i++) {
                    let historyItem = history[i];
                    if (wakeArr.findIndex((item) => {
                        return item.startTime <= historyItem.timeStamp && item.endTime >= historyItem.timeStamp
                    }) == -1) {
                        temperatureSum += historyItem.temperature;
                        temperatureLen++;
                    }
                }
                let ftcAvg = 0;
                if (temperatureLen > 0) {
                    ftcAvg = temperatureSum / temperatureLen;
                }
                resolve(ftcAvg);
            }
            catch (error) {
                reject(error);
                console.log("calFtcAvg=" + error)
            }
        })
    }

    // 计算HRV平均值
    /**
     * 
     * @param {*} startTimeStamp 开始时间戳（毫秒）
     * @param {*} endTimeStamp 结束时间戳（毫秒）
     */
    calHrvAvg = (startTimeStamp, endTimeStamp) => {
        return new Promise(async (resolve, reject) => {
            try {
                let historyArray = await this.queryInTimeStamp(startTimeStamp, endTimeStamp);
                let filterHistoryArray = historyArray.filter(history => {
                    // 第一个条件过滤
                    if (history.wearStatus !== 1 || history.chargeStatus !== 0) {
                        return false;
                    }
                    // 检查rawHr条件
                    if (history.rawHr !== null &&
                        history.rawHr.length === 3 &&
                        history.rawHr[0] === 200 &&
                        history.rawHr[1] === 200 &&
                        history.rawHr[2] === 200) {
                        return false;
                    }
                    // 检查hrv条件
                    if (history.hrv === 0) {
                        return false;
                    }
                    // 如果以上条件都不满足，则保留此元素
                    return true;
                });
                let count = filterHistoryArray.length;
                let hrvSum = 0;
                let hrvLen=0;
                for (let i = 0; i < count; i++) {
                    let historyItem = filterHistoryArray[i];
                    if (historyItem.hrv != 0) {
                        hrvSum += historyItem.hrv;
                        hrvLen++;
                    }
                    let hrvAvg = 0;
                    if (hrvLen > 0) {
                        hrvAvg = hrvSum / hrvLen;
                    }
                    resolve(hrvAvg);
                }
            } catch (error) {
                reject(error);
            }
        });
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