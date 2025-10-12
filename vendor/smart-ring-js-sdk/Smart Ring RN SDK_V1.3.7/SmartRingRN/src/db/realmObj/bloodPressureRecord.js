import Realm from 'realm';
export default class BloodPressureRecord extends Realm.Object {

  // 定义集合类型
  static schema = {
    name: 'BloodPressureRecord',
    // primaryKey: 'id', // 主键
    properties: {
      // id: 'int', // 固定值，例如1
      ts:'double',//时间戳
      account:'string',//帐号
      sys_d:'int',//血压计
      dias_d:'int',//血压计
      hr:'int',//心率
      pwtt:'int',
      sys_r1:'int',//戒指获取
      dias_r1:'int',//戒指获取
      sys_r2:'int',
      dias_r2:'int',
      // bpCalibrationInfo: 'string',
    },
  };


}