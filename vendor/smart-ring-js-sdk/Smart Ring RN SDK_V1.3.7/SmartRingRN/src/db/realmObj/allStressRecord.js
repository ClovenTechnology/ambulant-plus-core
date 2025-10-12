import Realm from 'realm';
export default class AllStressRecord extends Realm.Object {
  
  // 定义集合类型
    static schema = {
    name: 'AllStressRecord',
    properties: {
      timeStamp: {type: 'int'},
      stressLevel: {type: 'int'},
      pressure: {type: 'double'},
      timeZone: {type:'int'},
      dashedLine: {type: 'bool'},
    },
  };

}