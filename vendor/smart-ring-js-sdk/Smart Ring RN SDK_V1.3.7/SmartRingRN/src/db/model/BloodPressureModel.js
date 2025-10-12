import Realm from 'realm';
import realmConfig from '../config/realmConfig';
import BloodPressureRecord from '../realmObj/bloodPressureRecord';

export default class BloodPressureModel {
    static instance = null;

    constructor() {
        if (BloodPressureModel.instance) {
            return BloodPressureModel.instance;
        }
        BloodPressureModel.instance = this;
    }

    init() {
        this.openRealm();
    }

    queryAllBpCalibrationInfo() {
        return new Promise((resolve, reject) => {
            try {
                let result = this.realm.objects(BloodPressureRecord)
                resolve(Array.from(result));
            } catch (error) {
                reject(error);
                console.log("queryInTimeStamp=" + error)
            }
        })
    }

    queryBpInTimeStamp(startTimeStamp) {
        return new Promise((resolve, reject) => {
            try {
                console.log(` startTimeStamp=${startTimeStamp} `);
                let result = this.realm.objects(BloodPressureRecord).filtered('ts > $0 ', startTimeStamp);
                console.log(` result=${JSON.stringify(result)} `);
                resolve(Array.from(result));
            } catch (error) {
                reject(error);
                console.log("queryInTimeStamp=" + error)
            }
        })
    }

    queryLastBp() {
        return new Promise((resolve, reject) => {
            try {
                // 获取所有记录
                let allRecords = Array.from(this.realm.objects(BloodPressureRecord));
                console.log(`==== allRecords=${allRecords.length} `);
                if (allRecords.length > 0) {
                    // 使用 JavaScript 的数组方法找到最后一条记录
                    const lastRecord = allRecords[allRecords.length - 1];
                    resolve(lastRecord);
                } else {
                    resolve(null); // 如果没有找到任何记录
                }
            } catch (error) {
                reject(error);
                console.log("queryInTimeStamp=" + error)
            }
        })
    }



    setBpCalibrationInfo(data) {
        console.log("setBpCalibrationInfo 111=" + JSON.stringify(data))
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    let oldBp = this.realm.objects(BloodPressureRecord).filtered(`ts = ${data.ts}`);
                    let count = oldBp.length;
                    console.log(` setBpCalibrationInfo data=${JSON.stringify(data)}  count=${count}`);
                    if (count == 0) {
                        this.realm.create(BloodPressureRecord, data, Realm.UpdateMode.Never)
                        console.log("add bp success")
                        resolve("add bp success")
                    } else {
                        console.log("Record skipped due to duplicate timestamp");
                        resolve("Record skipped due to duplicate timestamp");
                    }
                });
            } catch (error) {
                reject(error);
                console.log("setBpCalibrationInfo error= " + error)
            }
        })
    }

    deleteAllBp = () => {
        return new Promise((resolve, reject) => {
            try {
                this.realm.write(() => {
                    this.realm.delete(this.realm.objects(BloodPressureRecord));
                })
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteAllBp=" + error)
            }
        })
    }

    deleteBpByTs = (ts) => {
        return new Promise((resolve, reject) => {
            try {
                const recordsToDelete = this.realm.write(() => {
                    this.realm.delete(this.realm.objects(BloodPressureRecord)).filtered('ts == $0', ts);;
                })
                if (recordsToDelete.length > 0) {
                    // 删除符合条件的记录
                    this.realm.delete(recordsToDelete);
                }
                resolve()
            }
            catch (error) {
                reject(error);
                console.log("deleteBpByTs=" + error)
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
