import Realm from 'realm';
export default class MotionRecord extends Realm.Object {
  
  // 定义集合类型
    static schema = {
    name: 'MotionRecord',
    properties: {
      timeStamp: {type: 'int'},
      motionType: {type: 'int'},
      motionSum: {type: 'int'},
    },
  };

}