import Realm from 'realm';
export class History extends Realm.Object {

    static schema = {
        name: 'history',
        properties: {
            timeStamp: { type: 'int', indexed: true },
            heartRate: 'int',
            motionDetectionCount: 'int',
            detectionMode: 'int',
            wearStatus: 'int',
            chargeStatus: 'int',
            uuid: 'int',
            hrv: 'int',
            temperature: 'float',
            step: 'int',
            ox: 'int',
            rawHr: 'mixed' ,
            sportsMode:'string',
            respiratoryRate:'int',
        },
    };
}