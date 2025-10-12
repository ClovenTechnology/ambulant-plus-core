import Realm from 'realm';
export class Sleep extends Realm.Object {

    static schema = {
        name: 'sleep',
        properties: {
            startTimeStamp: 'int',
            endTimeStamp: 'int',
            ftcAvg: 'float',
            avgHrv: 'float',
            duration: 'int',
            startTime: 'string',
            endTime: 'string',
            deepSleep: 'string',
            deepSleepTime: 'int',
            lightSleep: 'string',
            lightSleepTime: 'int',
            remSleep: 'string' ,
            remSleepTime: 'int' ,
            wakeSleep: 'string' ,
            wakeSleepTime: 'int' ,
            napSleep: 'string' ,
            napSleepTime: 'int' ,
            ftcBase:'float',
            nap: 'bool' ,
            isFtcOutlier: 'bool' ,
            pressureBaseLine: 'BaseLine' ,

        },
    };
}

