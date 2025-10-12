import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { BleState } from "../common/Type"
import { UUID_SERVICE, FILTER_UUID, UUID_SERVICE_IOS } from '../common/Constant'
import * as Constant from '../common/Constant'
import Util from '../utils/util'

const bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager);

export default class BleModule {

    constructor() {
        this.peripheralId = '';
        this.bleState = BleState.Off;
        this.initUUID();
    }

    initUUID() {
        this.readServiceUUID = [];
        this.readCharacteristicUUID = [];
        this.writeWithResponseServiceUUID = [];
        this.writeWithResponseCharacteristicUUID = [];
        this.writeWithoutResponseServiceUUID = [];
        this.writeWithoutResponseCharacteristicUUID = [];
        this.nofityServiceUUID = [];
        this.nofityCharacteristicUUID = [];
    }


    /** 添加监听器 */
    addListener(
        eventType,
        listener,
        context,
    ) {
        return bleManagerEmitter.addListener(eventType, listener, context);
    }

    removeListener(eventType){
        bleManagerEmitter.removeAllListeners(eventType);
    }

    /** 初始化蓝牙模块 */
    start() {
        BleManager.start({ showAlert: false })
            .then(() => {
                // 初始化成功后检查蓝牙状态
                this.checkState();
                console.log('Init the module success');
            })
            .catch(error => {
                console.log('Init the module fail', error);
            });
    }

    /** 强制检查蓝牙状态 并触发 BleManagerDidUpdateState 事件 */
    checkState() {
        BleManager.checkState();
    }

    /** 扫描可用设备，5秒后结束 *///FILTER_UUID,"406e","0100"
    scan() {
        return new Promise((resolve, reject) => {
            BleManager.scan([], 30, true)
                .then(() => {
                    console.log('Scan started');
                    resolve();
                })
                .catch(error => {
                    console.log('Scan started fail', error);
                    reject(error);
                });
        });
    }

    /** 停止扫描 */
    stopScan() {
        return new Promise((resolve, reject) => {
            BleManager.stopScan()
                .then(() => {
                    console.log('Scan stopped');
                    resolve();
                })
                .catch(error => {
                    console.log('Scan stopped fail', error);
                    reject();
                });
        });
    }

    /** 返回扫描到的蓝牙设备 */
    getDiscoveredPeripherals() {
        return new Promise((resolve, reject) => {
            BleManager.getDiscoveredPeripherals()
                .then(peripheralsArray => {
                    // console.log('Discovered peripherals: ', peripheralsArray);
                    resolve(peripheralsArray);
                })
                .catch(error => {
                    console.log('Discovered peripherals fail', error);
                    reject(error);
                });
        });
    }

    /** 将16、32、128位 UUID 转换为128位大写的 UUID */
    fullUUID(uuid) {
        if (uuid.length === 4) {
            return '0000' + uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB';
        }
        if (uuid.length === 8) {
            return uuid.toUpperCase() + '-0000-bleModule1000-8000-00805F9B34FB';
        }
        return uuid.toUpperCase();
    }

    /** 获取Notify、Read、Write、WriteWithoutResponse的serviceUUID和characteristicUUID */
    getUUID(peripheralInfo) {
        this.readServiceUUID = [];
        this.readCharacteristicUUID = [];
        this.writeWithResponseServiceUUID = [];
        this.writeWithResponseCharacteristicUUID = [];
        this.writeWithoutResponseServiceUUID = [];
        this.writeWithoutResponseCharacteristicUUID = [];
        this.nofityServiceUUID = [];
        this.nofityCharacteristicUUID = [];
        for (let item of peripheralInfo.characteristics) {

            if (Platform.OS == 'android') {
                item.service = this.fullUUID(item.service);
                item.characteristic = this.fullUUID(item.characteristic);
                // console.log(`-----------------item.properties=${JSON.stringify(item.properties)}`)
                if (item.properties.Notify == 'Notify') {
                    if (item.service.includes(UUID_SERVICE)) {
                        // console.log(`Notify  item.service=${item.service}  item.characteristic=${item.characteristic}`)
                        this.nofityServiceUUID.push(item.service);
                        this.nofityCharacteristicUUID.push(item.characteristic);
                    }
                }
                if (item.properties.Read == 'Read') {
                    // console.log(`------111-----------item.properties=${JSON.stringify(item.properties)}  item.characteristic=${item.characteristic}`)
                    this.readServiceUUID.push(item.service);
                    this.readCharacteristicUUID.push(item.characteristic);
                }
                if (item.properties.Write == 'Write') {

                    if (item.service.includes(UUID_SERVICE)) {
                        // console.log(`Write  item.service=${item.service}  item.characteristic=${item.characteristic}`)
                        this.writeWithResponseServiceUUID.push(item.service);
                        this.writeWithResponseCharacteristicUUID.push(item.characteristic);
                    }

                }
                if (item.properties.WriteWithoutResponse == 'WriteWithoutResponse') {
                    this.writeWithoutResponseServiceUUID.push(item.service);
                    this.writeWithoutResponseCharacteristicUUID.push(item.characteristic);
                }
            } else {
                // ios
                for (let property of item.properties) {
                    if (property == 'Notify') {
                        if (item.service.includes(UUID_SERVICE_IOS)) {
                            console.log(`Notify  item.service=${item.service}  item.characteristic=${item.characteristic}`)
                            this.nofityServiceUUID.push(item.service);
                            this.nofityCharacteristicUUID.push(item.characteristic);
                        }
                        // this.nofityServiceUUID.push(item.service);
                        // this.nofityCharacteristicUUID.push(item.characteristic);
                    }
                    if (property == 'Read') {
                        this.readServiceUUID.push(item.service);
                        this.readCharacteristicUUID.push(item.characteristic);
                    }
                    if (property == 'Write') {
                        if (item.service.includes(UUID_SERVICE_IOS)) {
                            console.log(`Write  item.service=${item.service}  item.characteristic=${item.characteristic}`)
                            this.writeWithResponseServiceUUID.push(item.service);
                            this.writeWithResponseCharacteristicUUID.push(item.characteristic);
                        }
                        // this.writeWithResponseServiceUUID.push(item.service);
                        // this.writeWithResponseCharacteristicUUID.push(item.characteristic);
                    }
                    if (property == 'WriteWithoutResponse') {
                        this.writeWithoutResponseServiceUUID.push(item.service);
                        this.writeWithoutResponseCharacteristicUUID.push(
                            item.characteristic,
                        );
                    }
                }
            }
        }
    }

    getOtaUUID() {
        console.log(`getOtaUUID this.peripheralInfo=${JSON.stringify(this.peripheralInfo.characteristics.length)}`)
        for (let item of this.peripheralInfo.characteristics) {
            if (Platform.OS == 'android') {
                item.service = this.fullUUID(item.service);
                item.characteristic = this.fullUUID(item.characteristic);
                console.log(`getOtaUUID item.service=${item.service} item.characteristic=${item.characteristic} item.properties=${JSON.stringify(item.properties)}  item.properties.Notify=${item.properties.Notify}`)
                if (item.properties.Read == 'Read') {
                    // console.log(` Read  item.service=${item.service}   item.characteristic=${item.characteristic}`)
                    if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_MANUFACTURER_NAME_STRING == item.characteristic) {
                        this.readOTAServiceUUID.push(item.service);
                        this.readOTACharacteristicUUID.push(item.characteristic);
                    } else if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_MODEL_NUMBER_STRING == item.characteristic) {
                        this.readOTAServiceUUID.push(item.service);
                        this.readOTACharacteristicUUID.push(item.characteristic);
                    } else if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_FIRMWARE_REVISION_STRING == item.characteristic) {
                        this.readOTAServiceUUID.push(item.service);
                        this.readOTACharacteristicUUID.push(item.characteristic);
                    } else if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_SOFTWARE_REVISION_STRING == item.characteristic) {
                        this.readOTAServiceUUID.push(item.service);
                        this.readOTACharacteristicUUID.push(item.characteristic);
                    } else if (Constant.SPOTA_MEM_INFO_UUID == item.characteristic) {
                        this.readSpotaServiceUUID = item.service;
                        this.readSpotaUUID = item.characteristic;
                    }else if(Constant.READ_AND_WRITE_RESPONSE_UUID == item.characteristic){
                        this.chargeReadUUID = item.characteristic;
                        this.chargeReadServiceUUID = item.service;
                    }

                    if (item.properties.Notify == 'Notify') {
                        console.log(` Notify  item.service=${item.service}   item.characteristic=${item.characteristic}`)
                        this.notifyOTAServiceUUID.push(item.service);
                        this.notifyOTACharacteristicUUID.push(item.characteristic);
                    }
                   
                }
                if (item.properties.Write == 'Write') {
                    this.writeOTAServiceUUID.push(item.service);
                    this.writeOTACharacteristicUUID.push(item.characteristic);
                }
                if(item.properties.WriteWithoutResponse == 'WriteWithoutResponse'){
                    this.writeNoResponseChargeCharacteristicUUID.push(item.characteristic);
                    this.writeNoResponseChargeServiceUUID.push(item.service);
                }
                if(item.properties.Indicate == 'Indicate'){
                    this.IndicateOTAServiceUUID.push(item.service);
                    this.IndicateOTACharacteristicUUID.push(item.characteristic);
                }
            } else {
                // ios
                for (let property of item.properties) {
                    if (property == 'Read') {
                        if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_MANUFACTURER_NAME_STRING == item.characteristic) {
                            this.readOTAServiceUUID.push(item.service);
                            this.readOTACharacteristicUUID.push(item.characteristic);
                        } else if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_MODEL_NUMBER_STRING == item.characteristic) {
                            this.readOTAServiceUUID.push(item.service);
                            this.readOTACharacteristicUUID.push(item.characteristic);
                        } else if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_FIRMWARE_REVISION_STRING == item.characteristic) {
                            this.readOTAServiceUUID.push(item.service);
                            this.readOTACharacteristicUUID.push(item.characteristic);
                        } else if (Constant.ORG_BLUETOOTH_CHARACTERISTIC_SOFTWARE_REVISION_STRING == item.characteristic) {
                            this.readOTAServiceUUID.push(item.service);
                            this.readOTACharacteristicUUID.push(item.characteristic);
                        } else if (Constant.SPOTA_MEM_INFO_UUID == item.characteristic) {
                            this.readSpotaServiceUUID = item.service;
                            this.readSpotaUUID = item.characteristic;
                        }else if(Constant.READ_AND_WRITE_RESPONSE_UUID == item.characteristic){
                            this.chargeReadUUID = item.characteristic;
                            this.chargeReadServiceUUID = item.service;
                        }
                    }
                    if (property == 'Notify') {
                        this.notifyOTAServiceUUID.push(item.service);
                        this.notifyOTACharacteristicUUID.push(item.characteristic);
                    }
                    if(item.properties.Indicate == 'Indicate'){
                        this.IndicateOTAServiceUUID.push(item.service);
                        this.IndicateOTACharacteristicUUID.push(item.characteristic);
                    }
                    if(item.properties.WriteWithoutResponse == 'WriteWithoutResponse'){
                        this.writeNoResponseChargeCharacteristicUUID.push(item.characteristic);
                        this.writeNoResponseChargeServiceUUID.push(item.service);
                    }
                    if (property == 'Write') {
                        this.writeOTAServiceUUID.push(item.service);
                        this.writeOTACharacteristicUUID.push(item.characteristic);
                    }
                }
            }
        }

    }

    addOTAcharacteristics(serviceUUID, characteristicUUID) {
        var isExist = this.readCharacteristicUUID.includes(characteristicUUID)
        if (isExist) {
            var index_uuid = this.findUUIDIndex(this.readCharacteristicUUID, characteristicUUID)
            if (!this.readOTACharacteristicUUID.includes(characteristicUUID)) {
                // console.log(` ==============添加MCU============================addOTAcharacteristics  characteristicUUID=${characteristicUUID}   `)
                this.readOTAServiceUUID.push(this.readServiceUUID[index_uuid]);
                this.readOTACharacteristicUUID.push(this.readCharacteristicUUID[index_uuid]);
            }
        }

    }

    queueReadSuotaInfo() {
        const SUOTA_VERSION_UUID = Constant.SUOTA_VERSION_UUID;
        var versionUUIDExist = this.readCharacteristicUUID.includes(SUOTA_VERSION_UUID)
        var index_uuid = this.findUUIDIndex(this.readCharacteristicUUID, SUOTA_VERSION_UUID)
        if (versionUUIDExist) {
            this.readOTAServiceUUID.push(this.readServiceUUID[index_uuid]);
            this.readOTACharacteristicUUID.push(this.readCharacteristicUUID[index_uuid]);
        }

        const SUOTA_PATCH_DATA_CHAR_SIZE_UUID = Constant.SUOTA_PATCH_DATA_CHAR_SIZE_UUID;
        var patchDataExist = this.readCharacteristicUUID.includes(SUOTA_PATCH_DATA_CHAR_SIZE_UUID)
        var index_uuid = this.findUUIDIndex(this.readCharacteristicUUID, SUOTA_PATCH_DATA_CHAR_SIZE_UUID)
        if (patchDataExist) {
            this.readOTAServiceUUID.push(this.readServiceUUID[index_uuid]);
            this.readOTACharacteristicUUID.push(this.readCharacteristicUUID[index_uuid]);
        }

        const SUOTA_MTU_UUID = Constant.SUOTA_MTU_UUID;
        var mtuExist = this.readCharacteristicUUID.includes(SUOTA_MTU_UUID);
        var index_uuid = this.findUUIDIndex(this.readCharacteristicUUID, SUOTA_MTU_UUID)
        if (mtuExist) {
            this.readOTAServiceUUID.push(this.readServiceUUID[index_uuid]);
            this.readOTACharacteristicUUID.push(this.readCharacteristicUUID[index_uuid]);
        }

        const SUOTA_L2CAP_PSM_UUID = Constant.SUOTA_L2CAP_PSM_UUID;
        var l2capExist = this.readCharacteristicUUID.includes(SUOTA_L2CAP_PSM_UUID);
        var index_uuid = this.findUUIDIndex(this.readCharacteristicUUID, SUOTA_L2CAP_PSM_UUID)
        if (l2capExist) {
            this.readOTAServiceUUID.push(this.readServiceUUID[index_uuid]);
            this.readOTACharacteristicUUID.push(this.readCharacteristicUUID[index_uuid]);
        }
    }


    readNextCharacteristic() {
        try {
            // console.log(` this.readOTACharacteristicUUID.length=${this.readOTACharacteristicUUID.length} `)
            if (this.readOTACharacteristicUUID.length >= 1) {
                var characteristic = this.readOTACharacteristicUUID.shift();
                var service = this.readOTAServiceUUID.shift();
                // console.log(` characteristic=${characteristic} service=${service}  readOTACharacteristicUUID.length=${this.readOTACharacteristicUUID.length}  readOTAServiceUUID.length=${this.readOTAServiceUUID.length}`)
                var isLast = false
                if (this.readOTACharacteristicUUID.length == 0) {
                    isLast = true
                }
                return this.readC(service, characteristic, isLast);
            }
        } catch (error) {
            console.log(`readNextCharacteristic error=${error} `)
        }
        return null
    }

    /**
     * 尝试连接蓝牙。如果无法连接，可能需要先扫描设备。
     * 在 iOS 中，尝试连接到蓝牙设备不会超时，因此如果您不希望出现这种情况，则可能需要明确设置计时器。
     */
    connect(id) {
        return new Promise((resolve, reject) => {
            BleManager.connect(id)
                .then(async() => {
                    console.log('Connected success');
                    // 获取已连接蓝牙设备的服务和特征

                    await new Promise(resolve => setTimeout(resolve, 100));
                    return BleManager.retrieveServices(id);
                })
                .then(peripheralInfo => {
                    this.readOTAServiceUUID = [];
                    this.readOTACharacteristicUUID = [];
                    this.writeOTAServiceUUID = [];
                    this.writeOTACharacteristicUUID = [];
                    this.notifyOTAServiceUUID = [];
                    this.notifyOTACharacteristicUUID = [];
                    this.IndicateOTAServiceUUID = [];
                    this.IndicateOTACharacteristicUUID = [];
                    this.writeNoResponseChargeCharacteristicUUID = [];
                    this.writeNoResponseChargeServiceUUID = [];
                    this.peripheralId = peripheralInfo.id;
                    this.peripheralInfo = peripheralInfo;
                    this.getUUID(peripheralInfo);
                    resolve(peripheralInfo);
                })
                .catch(error => {
                    console.log('Connected fail', error);
                    reject(error);
                });
        });
    }

    /** 断开蓝牙连接 */
    disconnect() {
        if(this.peripheralId){
            BleManager.disconnect(this.peripheralId)
            .then(() => {
                console.log('Disconnected');
            })
            .catch(error => {
                console.log('Disconnected fail', error);
            });
        }
    }

    startOTANotification(serviceUUID, characteristicUUID) {
        var index_uuid = this.findUUIDIndex(this.notifyOTACharacteristicUUID, characteristicUUID)
        return new Promise((resolve, reject) => {
            BleManager.startNotification(
                this.peripheralId,
                // serviceUUID,
                this.notifyOTAServiceUUID[index_uuid],
                // characteristicUUID,
                this.notifyOTACharacteristicUUID[index_uuid]
            )
                .then(() => {
                    console.log(`startOTANotification sucess`);
                    resolve();
                })
                .catch(error => {
                    console.log('startOTANotification fail', error);
                    reject(error);
                });
        });
    }

    stopOTANotification(serviceUUID, characteristicUUID) {
        var index_uuid = this.findUUIDIndex(this.notifyOTACharacteristicUUID, characteristicUUID)
        return new Promise((resolve, reject) => {
            BleManager.stopNotification(
                this.peripheralId,
                // serviceUUID,
                this.notifyOTAServiceUUID[index_uuid],
                // characteristicUUID,
                this.notifyOTACharacteristicUUID[index_uuid]
            )
                .then(() => {
                    console.log('stopOTANotification success!');
                    resolve();
                })
                .catch(error => {
                    console.log('stopOTANotification fail', error);
                    reject(error);
                });
        });
    }

    startChargeOTANotification(serviceUUID) {
        var index_uuid = this.findUUIDIndex(this.IndicateOTACharacteristicUUID, serviceUUID)
        console.log(`startChargeOTANotification index_uuid=${index_uuid} IndicateOTAServiceUUID=${this.IndicateOTAServiceUUID[index_uuid]} IndicateOTACharacteristicUUID=${this.IndicateOTACharacteristicUUID[index_uuid]} `);
        return new Promise((resolve, reject) => {
            BleManager.startNotification(
                this.peripheralId,
                // serviceUUID,
                this.IndicateOTAServiceUUID[index_uuid],
                // characteristicUUID,
                this.IndicateOTACharacteristicUUID[index_uuid]
            )
                .then(() => {
                    console.log(`startOTANotification sucess`);
                    resolve();
                })
                .catch(error => {
                    console.log('startOTANotification fail', error);
                    reject(error);
                });
        });
    }

    stopChargeOTANotification(serviceUUID) {
        var index_uuid = this.findUUIDIndex(this.IndicateOTACharacteristicUUID, serviceUUID)
        return new Promise((resolve, reject) => {
            BleManager.stopNotification(
                this.peripheralId,
                // serviceUUID,
                this.IndicateOTAServiceUUID[index_uuid],
                // characteristicUUID,
                this.IndicateOTACharacteristicUUID[index_uuid]
            )
                .then(() => {
                    console.log('stopOTANotification success!');
                    resolve();
                })
                .catch(error => {
                    console.log('stopOTANotification fail', error);
                    reject(error);
                });
        });
    }

    readChargeOTA() {
        return new Promise((resolve, reject) => {
            console.log(`readChargeOTA this.chargeReadUUID=${this.chargeReadUUID} this.chargeReadServiceUUID=${this.chargeReadServiceUUID}`)
            BleManager.read(
                this.peripheralId,
                this.chargeReadServiceUUID,
                this.chargeReadUUID,
            )
                .then(data => {
                    console.log('Read', data);
                    resolve(data);
                })
                .catch(error => {
                    console.log('Read fail', error);
                    reject(error);
                });
        });
    }

    /** 打开通知 */
    startNotification(index = 0) {
        var index_uuid = this.findUUIDIndex(this.nofityCharacteristicUUID, Constant.NOTIFY_UUID)
        return new Promise((resolve, reject) => {
            BleManager.startNotification(
                this.peripheralId,
                this.nofityServiceUUID[index_uuid],
                this.nofityCharacteristicUUID[index_uuid],
            )
                .then(() => {
                    // console.log(`Notification started this.nofityCharacteristicUUID=${this.nofityCharacteristicUUID}`);
                    resolve();
                })
                .catch(error => {
                    console.log('Start notification fail', error);
                    reject(error);
                });
        });
    }

    /** 关闭通知 */
    stopNotification(index = 0) {
        var index_uuid = this.findUUIDIndex(this.nofityCharacteristicUUID, Constant.NOTIFY_UUID)
        return new Promise((resolve, reject) => {
            BleManager.stopNotification(
                this.peripheralId,
                this.nofityServiceUUID[index_uuid],
                this.nofityCharacteristicUUID[index_uuid],
            )
                .then(() => {
                    console.log('Stop notification success!');
                    resolve();
                })
                .catch(error => {
                    console.log('Stop notification fail', error);
                    reject(error);
                });
        });
    }

    /** 写数据到蓝牙 */
    writeOTA(data, serviceUUID, characteristicUUID) {
        var index_uuid = this.findUUIDIndex(this.writeOTACharacteristicUUID, characteristicUUID)
        console.log(`writeOTA  index_uuid=${index_uuid}  writeOTAServiceUUID.len=${this.writeOTAServiceUUID[index_uuid]} writeOTACharacteristicUUID=${this.writeOTACharacteristicUUID[index_uuid]} `);
        return new Promise((resolve, reject) => {
            BleManager.write(
                this.peripheralId,
                this.writeOTAServiceUUID[index_uuid],
                this.writeOTACharacteristicUUID[index_uuid],
                data,
            )
                .then(async () => {
                    console.log('writeOTA Write success', data.toString());
                    await Util.delay(200)
                    resolve();
                })
                .catch(error => {
                    console.log('writeOTA Write failed', data,"error",error);
                    reject(error);
                });
        });
    }

     /** 写数据到蓝牙，没有响应 */
     writeChargeOTAWithoutResponse(data, characteristicUUID) {
        var index_uuid = this.findUUIDIndex(this.writeNoResponseChargeCharacteristicUUID, characteristicUUID)
        console.log(`writeOTAWithoutResponse  index_uuid=${index_uuid}  writeOTAServiceUUID.len=${this.writeNoResponseChargeServiceUUID[index_uuid]} writeOTACharacteristicUUID=${this.writeNoResponseChargeCharacteristicUUID[index_uuid]} `);
        return new Promise((resolve, reject) => {
            BleManager.writeWithoutResponse(
                this.peripheralId,
                this.writeNoResponseChargeServiceUUID[index_uuid],
                this.writeNoResponseChargeCharacteristicUUID[index_uuid],
                data,
                512,
                50
            )
                .then(() => {
                    console.log('writeOTAWithoutResponse success');
                    resolve();
                })
                .catch(error => {
                    console.log('writeOTAWithoutResponse failed', error);
                    reject(error);
                });
        });
    }

    /** 写数据到蓝牙，没有响应 */
    writeOTAWithoutResponse(data, serviceUUID, characteristicUUID) {
        var index_uuid = this.findUUIDIndex(this.writeOTACharacteristicUUID, characteristicUUID)
        console.log(`writeOTAWithoutResponse  index_uuid=${index_uuid}  writeOTAServiceUUID.len=${this.writeOTAServiceUUID[index_uuid]} writeOTACharacteristicUUID=${this.writeOTACharacteristicUUID[index_uuid]} `);
        return new Promise((resolve, reject) => {
            BleManager.writeWithoutResponse(
                this.peripheralId,
                this.writeOTAServiceUUID[index_uuid],
                this.writeOTACharacteristicUUID[index_uuid],
                data,
            )
                .then(() => {
                    console.log('writeOTAWithoutResponse success');
                    resolve();
                })
                .catch(error => {
                    console.log('writeOTAWithoutResponse failed', error);
                    reject(error);
                });
        });
    }

    /** 写数据到蓝牙 */
    write(data, index = 0) {
        var index_uuid = this.findUUIDIndex(this.writeWithResponseCharacteristicUUID, Constant.WRITE_UUID)
        // console.log(`write   index_uuid=${index_uuid}  writeWithResponseServiceUUID.len=${this.writeWithResponseServiceUUID.length} writeWithResponseCharacteristicUUID=${this.writeWithResponseCharacteristicUUID.length} `);
        return new Promise((resolve, reject) => {
            BleManager.write(
                this.peripheralId,
                this.writeWithResponseServiceUUID[index_uuid],
                this.writeWithResponseCharacteristicUUID[index_uuid],
                data,
            )
                .then(() => {
                    console.log('Write success', data.toString());
                    resolve();
                })
                .catch(error => {
                    console.log('Write failed', data);
                    reject(error);
                });
        });
    }

    findUUIDIndex(arr, targetUUID) {
        var index_uuid = 0;
        arr.findIndex((uuid, index) => {
            if (uuid == targetUUID) {
                // console.log(` write uuid index_uuid`)
                index_uuid = index
            }
        })
        return index_uuid
    }

    /** 写数据到蓝牙，没有响应 */
    writeWithoutResponse(data, index = 0) {
        return new Promise((resolve, reject) => {
            BleManager.writeWithoutResponse(
                this.peripheralId,
                this.writeWithoutResponseServiceUUID[index],
                this.writeWithoutResponseCharacteristicUUID[index],
                data,
            )
                .then(() => {
                    // console.log('writeWithoutResponse Write success', data);
                    resolve();
                })
                .catch(error => {
                    console.log('writeWithoutResponse Write failed', data);
                    reject(error);
                });
        });
    }

    /** 读取指定特征的数据 */
    read(index = 0) {
        return new Promise((resolve, reject) => {
            BleManager.read(
                this.peripheralId,
                this.readServiceUUID[index],
                this.readCharacteristicUUID[index],
            )
                .then(data => {
                    const str = this.byteToString(data);
                    // console.log('Read', data, str);
                    resolve(str);
                })
                .catch(error => {
                    console.log('Read fail', error);
                    reject(error);
                });
        });
    }

    /** 读取指定特征的数据 */
    readC(serviceUUID, characteristicUUID, isLast) {
        return new Promise((resolve, reject) => {
            BleManager.read(
                this.peripheralId,
                serviceUUID,
                characteristicUUID,
            )
                .then(data => {
                    const byteArray = new Uint8Array(data);
                    // console.log(`readC  byteArray=${byteArray}  ${data}`);
                    const dataView = new DataView(byteArray.buffer);
                    const uint8Value = dataView.getUint8(0);
                    const str = this.decodeUtf8(byteArray);
                    // console.log(`读取数据 将byte数组转换成int 读取第一个数 uint8Value=${uint8Value} length=${dataView.byteLength} characteristicUUID=${characteristicUUID} `);
                    resolve({
                        dataView,
                        str,
                        characteristicUUID,
                        isLast
                    });
                })
                .catch(error => {
                    console.log('[readC] fail', error);
                    reject(error);
                });
        });
    }

    decodeUtf8(uint8Array) {
        let decodedString = "";
        let i = 0;

        while (i < uint8Array.length) {
            const byte = uint8Array[i++];
            if (byte >= 0xc0) {
                const byte2 = uint8Array[i++] & 0x3f;
                if (byte < 0xe0) {
                    decodedString += String.fromCharCode(((byte & 0x1f) << 6) | byte2);
                } else {
                    const byte3 = uint8Array[i++] & 0x3f;
                    decodedString += String.fromCharCode(
                        ((byte & 0x0f) << 12) | (byte2 << 6) | byte3
                    );
                }
            } else {
                decodedString += String.fromCharCode(byte);
            }
        }

        return decodedString;
    }

    /** byte 数组转换成字符串 */
    byteToString(arr) {
        if (typeof arr === 'string') {
            return arr;
        }
        var str = '',
            _arr = arr;
        for (var i = 0; i < _arr.length; i++) {
            var one = _arr[i].toString(2),
                v = one.match(/^1+?(?=0)/);
            if (v && one.length == 8) {
                var bytesLength = v[0].length;
                var store = _arr[i].toString(2).slice(7 - bytesLength);
                for (var st = 1; st < bytesLength; st++) {
                    store += _arr[st + i].toString(2).slice(2);
                }
                str += String.fromCharCode(parseInt(store, 2));
                i += bytesLength - 1;
            } else {
                str += String.fromCharCode(_arr[i]);
            }
        }
        return str;
    }

    /** 返回已连接的蓝牙设备 */
    getConnectedPeripherals() {
        return new Promise((resolve, reject) => {
            BleManager.getConnectedPeripherals([])
                .then(peripheralsArray => {
                    // console.log('Get connected peripherals', peripheralsArray);
                    resolve(peripheralsArray);
                })
                .catch(error => {
                    console.log('Get connected peripherals fail', error);
                    reject(error);
                });
        });
    }

    /** 判断指定设备是否已连接 */
    isPeripheralConnected() {
        return new Promise((resolve, reject) => {
            BleManager.isPeripheralConnected(this.peripheralId, [])
                .then(isConnected => {
                    resolve(isConnected);
                })
                .catch(error => {
                    console.log('Get peripheral is connected fail', error);
                    reject(error);
                });
        });
    }

    /** (Android only) 获取已绑定的设备 */
    getBondedPeripherals() {
        return new Promise((resolve, reject) => {
            BleManager.getBondedPeripherals()
                .then(bondedPeripheralsArray => {
                    console.log('Bonded peripherals', bondedPeripheralsArray);
                    resolve(bondedPeripheralsArray);
                })
                .catch(error => {
                    console.log('Bonded peripherals fail', error);
                    reject(error);
                });
        });
    }

    /** (Android only) 打开蓝牙 */
    enableBluetooth() {
        BleManager.enableBluetooth()
            .then(() => {
                console.log('The bluetooh is already enabled or the user confirm');
            })
            .catch(error => {
                console.log('The user refuse to enable bluetooth', error);
            });
    }

    /** (Android only) 从缓存列表中删除断开连接的外围设备。它在设备关闭时很有用，因为它会在再次打开时被重新发现 */
    removePeripheral() {
        BleManager.removePeripheral(this.peripheralId)
            .then(() => {
                console.log('Remove peripheral success');
            })
            .catch(error => {
                console.log('Remove peripheral fail', error);
            });
    }

    requestMtu(mtu) {
        return new Promise((resolve, reject) => {
            BleManager.requestMTU(this.peripheralId, mtu)
                .then((mtu) => {
                    console.log(`requestMtu success===============mtu=${mtu}`)
                    resolve()
                })
                .catch(error => {
                    console.log('requestMtu fail==================', error)
                    reject(error)
                })
        });
    }

    requestConnectionPriority(priority) {
        return new Promise((resolve, reject) => {
            BleManager.requestConnectionPriority(this.peripheralId, priority)
                .then(() => {
                    console.log('requestConnectionPriority success')
                    resolve()
                })
                .catch(error => {
                    console.log('requestConnectionPriority fail', error)
                    reject(error)
                })
        });
    }

    disconnected() {
        BleManager.disconnect(this.peripheralId)
            .then(() => {
                console.log(`disconnected success`)
            })
            .catch(error => {
                console.log(`disconnected error=${error}`)
            })
    }

    refreshCache() {
        return BleManager.refreshCache(this.peripheralId)
    }

}

export const bleModule = new BleModule()