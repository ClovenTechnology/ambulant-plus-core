import Realm from 'realm';
export default class BaseLine extends Realm.Object {
  
  // 定义集合类型
    static schema = {
    name: 'BaseLine',
    properties: {
      baseLine: 'float',
      downCount: 'int'
    },
  };

}