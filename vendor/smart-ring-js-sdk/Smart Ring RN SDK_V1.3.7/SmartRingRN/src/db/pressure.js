import Realm from 'realm';
import StressRecord from './realmObj/stressRecord';
export class Pressure extends Realm.Object {

    static schema = {
        name: 'pressure',
        properties: {
            timeStamp: { type: 'int', indexed: true },
            stressZoneList: { type: 'list', objectType: 'StressRecord' },
            engagementZoneList: { type: 'list', objectType: 'StressRecord' },
            relaxationZoneList: { type: 'list', objectType: 'StressRecord' },
            recoveryZoneList: { type: 'list', objectType: 'StressRecord' },
            pressureBaseLine: 'double',
            extremelyLowMotionList: { type: 'list', objectType: 'MotionRecord' },
            lowMotionList: { type: 'list', objectType: 'MotionRecord' },
            mediumMotionList: { type: 'list', objectType: 'MotionRecord' },
            highMotionList: { type: 'list', objectType: 'MotionRecord' },
            allZoneList: 'string',
            allMotionList: { type: 'list', objectType: 'MotionRecord' },
        },
    };
}