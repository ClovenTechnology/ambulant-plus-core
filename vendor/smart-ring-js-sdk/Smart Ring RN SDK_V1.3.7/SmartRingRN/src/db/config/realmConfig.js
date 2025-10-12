import { History } from "../history";
import { Pressure } from "../pressure";
import AllStressRecord from "../realmObj/allStressRecord";
import BaseLine from "../realmObj/baseLine";
import MotionRecord from "../realmObj/motionRecord";
import StressRecord from "../realmObj/stressRecord";
import BloodPressureRecord from "../realmObj/bloodPressureRecord";
import { Sleep } from "../sleep";
const realmConfig={
    schema: [
        History,Pressure,Sleep,AllStressRecord,BaseLine,MotionRecord,StressRecord,BloodPressureRecord
    ],
    deleteRealmIfMigrationNeeded: true,
    inMemory: false,
    schemaVersion:1
}

export default realmConfig;