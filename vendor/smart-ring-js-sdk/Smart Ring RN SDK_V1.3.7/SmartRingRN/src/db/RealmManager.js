import HistoryModel from './model/HistoryModel';
import PressureModel  from './model/PressureModel';
import SleepModel  from './model/SleepModel';
import BloodPressureModel  from './model/BloodPressureModel';

export default class RealmManager {
    static instance = null;
    constructor() {
        if (RealmManager.instance) {
            return RealmManager.instance;
        }
        RealmManager.instance = this;
    }

    init() {
        this.historyModel = new HistoryModel();
        this.historyModel.init();
        this.pressureModel = new PressureModel();
        this.pressureModel.init();
        this.sleepModel = new SleepModel();
        this.sleepModel.init();
        this.bloodPressureModel = new BloodPressureModel();
        this.bloodPressureModel.init();
    }

    getHistoryModel() {
        return this.historyModel;
    }

    getPressureModel() {
        return this.pressureModel;
    }

    getSleepModel() {
        return this.sleepModel;
    }

    getBloodPressureModel() {
        return this.bloodPressureModel;
    }
}