import Realm from 'realm';
import realmConfig from '../config/realmConfig';
import { Pressure } from '../pressure';


export default class PressureModel {
    static instance = null;

    constructor() {
        if (PressureModel.instance) {
            return PressureModel.instance;
        }
        PressureModel.instance = this;
    }
    init() {
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

    queryAllPressure() {
        return new Promise((resolve, reject) => {
            try {
                let pressure = this.realm.objects(Pressure)
                resolve(Array.from(pressure));
            }
            catch (error) {
                reject(error);
                console.log("queryAllPressure=" + error)
            }
        })

    }



    addPressure = (pressure) => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    let oldPressure = this.realm.objects(Pressure).filtered(`timeStamp = ${pressure.timeStamp}`);
                    let count = oldPressure.length;
                    if (count == 0) {
                        this.realm.create(Pressure, pressure, Realm.UpdateMode.Never)
                        resolve("add pressure success")
                    } else {
                        // console.log(`Record skipped due to duplicate timestamp  `);
                        resolve("this pressure is exist");
                    }

                })
            }
            catch (error) {
                reject(error);
                console.log("addPressure=" + error)
            }
        })

    }

    deletePressure = () => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    this.realm.delete(this.realm.objects(Pressure));
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deletePressure=" + error)
            }
        })
    }

    //删除最后一条压力数据
    deleteLastPressure = () => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    let pressure = this.realm.objects(Pressure).sorted('timeStamp', true)[0];
                    if (pressure) {
                        this.realm.delete(pressure);
                    }
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteLastPressure=" + error)
            }
        })
    }

    //获取最后一条压力数据
    getLastPressure = () => {
        return new Promise((resolve, reject) => {
            try {
                let pressure = this.realm.objects(Pressure).sorted('timeStamp', true)[0];
                resolve(pressure)
            }
            catch (error) {
                reject(error);
                console.log("getLastPressure=" + error)
            }
        })
    }

    getLastPressureTimeStamp = () => {
        return new Promise((resolve, reject) => {
            try {
                let pressure = this.realm.objects(Pressure).sorted('timeStamp', true)[0];
                if (pressure) {
                    resolve(pressure.timeStamp)
                } else {
                    resolve(null)
                }
            }
            catch (error) {
                reject(error);
                console.log("getLastPressureTimeStamp=" + error)
            }
        })
    }

    //通过传入的DateTime获取当天0点到24点的压力数据
    getPressureByDateTime = (dateTime) => {
        return new Promise((resolve, reject) => {
            try {
                //通过dateTime获取当天0点的时间戳作为开始时间戳
                let startTimeStamp = dateTime.setHours(0, 0, 0, 0);
                //获取当天24点的时间戳作为结束时间戳
                let endTimeStamp = dateTime.setHours(23, 59, 59, 999);
                let result = this.realm.objects(Pressure).filtered(`timeStamp >= ${startTimeStamp} && timeStamp < ${endTimeStamp}`);
                resolve(Array.from(result));
            }
            catch (error) {
                reject(error);
                console.log("getPressureByDateTime=" + error)
            }
        })
    }

    //将数据库中所有数据导出为json文件
    exportAllPressure = () => {
        return new Promise((resolve, reject) => {
            try {
                let allPressure = this.realm.objects(Pressure);
                let json = JSON.stringify(Array.from(allPressure), null, 2);
                // let fileName = `pressure_${new Date().toLocaleDateString()}.json`;
                // let file = new File([json], fileName, { type: "text/plain;charset=utf-8" });
                resolve(json);
            }
            catch (error) {
                reject(error);
                console.log("exportAllPressure=" + error)
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