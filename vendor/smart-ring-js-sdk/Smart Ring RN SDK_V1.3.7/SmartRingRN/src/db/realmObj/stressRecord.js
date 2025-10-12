import Realm from 'realm';
export default class StressRecord extends Realm.Object {
  
  // 定义集合类型
    static schema = {
    name: 'StressRecord',
    properties: {
      timeStamp: {type: 'int'},
      stressLevel: {type: 'int'},
      pressure: {type: 'double'},
    },
  };

}