import SDK from "../lib/ringSDK";
import DeviceInfo from 'react-native-device-info';
import FileUtils from "./FileUtils";
import { Platform } from 'react-native';
import * as Constant from '../common/Constant'
import { dispatchErrorData } from '../utils/ListenerUtils'
import Util from '../utils/util'
import { bleModule } from '../module/BleModule'
const TYPE = 1

const ACTION_BLUETOOTH_GATT_UPDATE = "BluetoothGattUpdate";
const ACTION_PROGRESS_UPDATE = "ProgressUpdate";
const ACTION_CONNECTION_STATE_UPDATE = "ConnectionState";
const DEFAULT_MTU = 23;
const DEFAULT_FILE_CHUNK_SIZE = 20;
const MEMORY_TYPE_SYSTEM_RAM = 1;
const MEMORY_TYPE_RETENTION_RAM = 2;
const MEMORY_TYPE_SPI = 3;
const MEMORY_TYPE_I2C = 4;
const DEFAULT_MEMORY_TYPE = MEMORY_TYPE_SPI;

const DEFAULT_MISO_VALUE = 3;
const DEFAULT_MOSI_VALUE = 0;
const DEFAULT_CS_VALUE = 1;
const DEFAULT_SCK_VALUE = 4;
const DEFAULT_BLOCK_SIZE_VALUE = "240";
const DEFAULT_MEMORY_BANK = 0;
const DEFAULT_I2C_DEVICE_ADDRESS = "0x50";
const DEFAULT_SCL_GPIO_VALUE = 2;
const DEFAULT_SDA_GPIO_VALUE = 3;
const MEMORY_TYPE_SUOTA_INDEX = 100;
const MEMORY_TYPE_SPOTA_INDEX = 101;

const STATE_DISCONNECTED = 0;

const gpioStringPattern = /P(\d+)_(\d+)/;

var disconnected = false;

var fileName = "";
var errors = null;
var step = -1;
var deviceInfo = {};


var mtu = DEFAULT_MTU;
var patchDataSize = DEFAULT_FILE_CHUNK_SIZE;
var fileChunkSize = DEFAULT_FILE_CHUNK_SIZE;
var mtuRequestSent = false;
var mtuReadAfterRequest = false;
var l2capPsm = 0;
var characteristicsQueue = [];

var hasError = false;
var processCallBack = null;
var successCallBack = null;
var writeFailCallBack = null;
var initMTUCallback = null;
var initMemoryTypeCallBack = null;
var canListener = true
var navigation = null

function init() {
    errors = SDK.SuotaManager.initErrorMap();
    console.log(` errors=${errors} errors=${JSON.stringify(errors)}`)
}


function gpioStringToInt(gpioValue) {
    const match = gpioValue.match(gpioStringPattern);
    if (match) {
        const group1 = match[1];
        const group2 = match[2];
        if (group1 !== null && group1 !== "" && group2 !== null && group2 !== "") {
            try {
                return ((parseInt(group1, 10) & 0x0f) << 4) | (parseInt(group2, 10) & 0x0f);
            } catch (ignored) { }
        }
    }
    throw new Error("Invalid GPIO string");
}

function otaStep(intent) {
    switch (intent.action) {
        case ACTION_CONNECTION_STATE_UPDATE:
            connectionStateChanged(intent.state)
            break;
        case ACTION_BLUETOOTH_GATT_UPDATE:
            processStep(intent)
            break;
        case ACTION_PROGRESS_UPDATE:

            break;
    }
}

function connectionStateChanged(connectionState) {
    if (connectionState === STATE_DISCONNECTED) {
        disconnected = true;
        if (bleModule) {
            bleModule.disconnected()
        }
    }
}

function onError(errorCode) {
    const error = errors.get(parseInt(errorCode));
    console.log("Error: " + errorCode +" errorCode?.includes"+`${errorCode==242}`);
    if (hasError || errorCode?.includes("133")||errorCode==242) {
        return;
    }
    hasError = true;

    bleModule.disconnected();
    dispatchErrorData(error)

}



async function processStep(intent) {
    const newStep = intent.step == undefined ? -1 : intent.step;
    const error = intent.error == undefined ? -1 : intent.error;
    console.log(`processStep intent(newStep=${newStep}, error: ${error})`);

    if (error !== -1) {
        onError(error);
        return;
    }

    if (newStep >= 0) {
        step = newStep;
    } else {
        const index = intent.characteristic == undefined ? -1 : intent.characteristic;
        if (index !== -1) {
            const value = intent.value;
        } else {
            if (intent.hasSuotaVersion) {
                var version = intent.suotaVersion;
                console.log("SUOTA version: " + version);
                deviceInfo.version = version
            } else if (intent.hasSuotaPatchDataSize) {
                patchDataSize = intent.suotaPatchDataSize;
                deviceInfo.suotaPatchDataSize = patchDataSize
                console.log("SUOTA patch data size: " + patchDataSize);
                updateFileChunkSize();
            } else if (intent.hasSuotaMtu) {
                const oldMtu = mtu;
                mtu = intent.suotaMtu;
                deviceInfo.suotaMtu = mtu
                console.log("SUOTA MTU: " + mtu);
                updateFileChunkSize();
                if (mtuRequestSent && !mtuReadAfterRequest && mtu !== oldMtu) {
                    mtuReadAfterRequest = true;
                    const manufacturer = DeviceInfo.getManufacturer();
                    console.log(` manufacturer=${manufacturer}`)
                    if (manufacturer === "Xiaomi" && FileUtils.isExistFile("/system/lib/libbtsession.so")) {
                        console.log("Workaround for Xiaomi MTU issue. Read MTU again.");
                        bleModule.addOTAcharacteristics(Constant.SPOTA_SERVICE_UUID, Constant.SUOTA_MTU_UUID)
                    }
                }
            } else if (intent.hasSuotaL2capPsm) {
                l2capPsm = intent.suotaL2capPsm;
                deviceInfo.suotaL2capPsm = l2capPsm
                console.log("SUOTA L2CAP PSM: " + l2capPsm);
            }
        }
        // console.log(` Platform.Version=${Platform.Version} mtuRequestSent=${mtuRequestSent} characteristicsQueue.length=${characteristicsQueue.length} mtu=${mtu} patchDataSize=${patchDataSize}`)
        if (Platform.OS === 'android' && Platform.Version >= 21 && !mtuRequestSent && characteristicsQueue.length == 0 && mtu === DEFAULT_MTU && mtu < patchDataSize + 3) {
            // console.log("Sending MTU request  patchDataSize" + patchDataSize);
            mtuRequestSent = true;
            await bleModule.requestMtu(patchDataSize + 3)
                .then(() => {
                    var intent = {
                        hasSuotaMtu: true,
                        suotaMtu: patchDataSize + 3
                    }
                    processStep(intent)
                })
                .catch(error => {
                    console.log(`requestMtu error`)
                });
        }
        // console.log(`====================== readNextCharacteristic`)
        setTimeout(() => { readNextCharacteristic() }, 500)

    }

    console.log("step " + step);

    switch (step) {
        case 0:
            if (Platform.OS === 'android') {
                bleModule.refreshCache()
            }
            mtu = DEFAULT_MTU;
            patchDataSize = DEFAULT_FILE_CHUNK_SIZE;
            fileChunkSize = DEFAULT_FILE_CHUNK_SIZE;
            hasError = false;
            mtuRequestSent = false;
            bleModule.queueReadSuotaInfo();
            readNextCharacteristic();
            step = -1;
            break;

        case 1:
            if (Platform.OS === 'android' && Platform.Version >= 21) {
                // console.log("Connection parameters update request (high)");
                bleModule.requestConnectionPriority(1)
                    .then(async () => {
                        SDK.SuotaManager.reset();
                        await enableNotifications();
                        SDK.SuotaManager.setType(SDK.SuotaManager.TYPE);
                    })
                    .catch(error => {
                        console.log(`requestConnectionPriority   error =${error}`)
                    })
            } else {
                SDK.SuotaManager.reset();
                await enableNotifications();
                SDK.SuotaManager.setType(SDK.SuotaManager.TYPE);
            }


            break;

        case 2:
            initMemoryTypeCallBack(fileName);
            // console.log(`Firmware CRC: ${SDK.SuotaManager.getCrc() & 0xff}`);
            const fwSizeMsg = "Upload size: " + SDK.SuotaManager.getNumberOfBytes() + " bytes";
            // console.log(fwSizeMsg);
            const chunkSizeMsg = "Chunk size: " + fileChunkSize + " bytes";
            // console.log(chunkSizeMsg);
            uploadStart = new Date().getTime();
            setSpotaMemDev();
            break;

        case 3:
            // console.log(`type=3 gpioMapPrereq=${SDK.SuotaManager.getGpioMapPrereq()} `)
            if (SDK.SuotaManager.addGpioMapPrereq() === 2) {
                // console.log(`type=3 进入 SDK.SuotaManager.getGpioMapPrereq()=${SDK.SuotaManager.getGpioMapPrereq()} `)
                SDK.SuotaManager.setSpotaGpioMap((memInfoData) => {
                    var buffer = new ArrayBuffer(4);
                    var dataView = new DataView(buffer);
                    dataView.setUint32(0, memInfoData, true);
                    bleModule.writeOTA(Array.from(new Uint8Array(buffer)), Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_GPIO_MAP_UUID)
                        .then(() => {
                            var intent = {
                                step: 4
                            }
                            processStep(intent)
                        }).catch((error) => {
                            console.log(`write SPOTA_GPIO_MAP_UUID error=${error} `)
                        })
                });
            }
            break;

        case 4:
            setPatchLength()
            break;

        case 5:
            // console.log(` SDK.SuotaManager.lastBlockSent=${SDK.SuotaManager.getLastBlockSent()} SDK.SuotaManager.endSignalSent=${SDK.SuotaManager.getEndSignalSent()}`)
            if (!SDK.SuotaManager.getLastBlock()) {
                sendBlock()
            } else {

                if (!SDK.SuotaManager.getPreparedForLastBlock() && SDK.SuotaManager.getNumberOfBytes() % SDK.SuotaManager.getFileBlockSize() !== 0) {
                    setPatchLength()
                } else if (!SDK.SuotaManager.getLastBlockSent()) {
                    sendBlock()
                } else if (!SDK.SuotaManager.getEndSignalSent()) {
                    // console.log(` ===========sendEndSignal `)
                    SDK.SuotaManager.sendEndSignal((end_signal) => {
                        var buffer = new ArrayBuffer(4);
                        var dataView = new DataView(buffer);
                        dataView.setUint32(0, end_signal, true);
                        bleModule.writeOTA(Array.from(new Uint8Array(buffer)), Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_MEM_DEV_UUID)
                            .then(() => {
                                var intent = {
                                    step: 5
                                }
                                processStep(intent)

                            })


                    });
                } else {
                    console.log(` ===========onSuccess================ `)
                    SDK.SuotaManager.onSuccess(() => {
                        setTimeout(() => {
                            successCallBack();
                        }, 1000)
                        // if (Platform.OS === 'android' && Platform.Version >= 21) {
                        //     console.log("Connection parameters update request (high)");
                        //     bleModule.requestConnectionPriority(1)
                        //         .then(() => {

                        //             successCallBack();
                        //         })
                        // } else {
                        //     setTimeout(() => {
                        //         successCallBack();
                        //     }, 1000)
                        // }


                    });
                }
            }
            break;
    }
}


async function sendBlock() {
    await Util.delay(300)
    SDK.SuotaManager.sendBlock(async (chunkNumber, totalChunkCount, chunk, progress) => {
        if (processCallBack) {
            processCallBack(progress, chunkNumber, totalChunkCount)
        }
        var bytes = Array.from(chunk)
        console.log(`    sendBlock ============= bytes  =${bytes.length}       `)
        await bleModule.writeOTAWithoutResponse(bytes, Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_PATCH_DATA_UUID)
            .then(() => {
                var intent = {
                    step: 5
                }
                processStep(intent)

                console.log("==========sendBlock end==============")
            })
            .catch(error => {
                if (writeFailCallBack) {
                    writeFailCallBack(error);
                }
            })

    });
}


function setPatchLength() {
    SDK.SuotaManager.setPatchLength((blocksize) => {
        var buffer = new ArrayBuffer(2);
        var dataView = new DataView(buffer);
        dataView.setUint16(0, blocksize, true);
        bleModule.writeOTA(Array.from(new Uint8Array(buffer)), Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_PATCH_LEN_UUID)
            .then(() => {
                var step = SDK.SuotaManager.getType() == SDK.SuotaManager.TYPE ? 5 : 7;
                console.log(` SDK.SuotaManager.getType()=${SDK.SuotaManager.getType()} SDK.SuotaManager.TYPE=${SDK.SuotaManager.TYPE}`)
                var intent = {
                    step
                }
                processStep(intent)
            })
            .catch((error) => {
                if (writeFailCallBack) {
                    writeFailCallBack(error);
                }
            })
    });
}

async function enableNotifications() {
    await Util.delay(500)
    var intent = {
        step: 2
    }
    processStep(intent)
}

async function readNextCharacteristic() {
    try {
        bleModule.readNextCharacteristic()
            ?.then(({ dataView, str, characteristicUUID, isLast }) => {
                console.log(` readNextCharacteristic characteristicUUID=${characteristicUUID} Constant.SUOTA_VERSION_UUID=${Constant.SUOTA_VERSION_UUID}  `)
                var sendUpdate = true;
                var index = -1;
                var step = -1;
                var intent = {};
                var suotaInfo = null;

                if (characteristicUUID == Constant.ORG_BLUETOOTH_CHARACTERISTIC_MANUFACTURER_NAME_STRING) {
                    index = 0;
                } else if (characteristicUUID == Constant.ORG_BLUETOOTH_CHARACTERISTIC_MODEL_NUMBER_STRING) {
                    index = 1;
                } else if (characteristicUUID == Constant.ORG_BLUETOOTH_CHARACTERISTIC_FIRMWARE_REVISION_STRING) {
                    index = 2;
                } else if (characteristicUUID == Constant.ORG_BLUETOOTH_CHARACTERISTIC_SOFTWARE_REVISION_STRING) {
                    index = 3;
                } else if (characteristicUUID == Constant.SUOTA_VERSION_UUID) {
                    intent.hasSuotaVersion = true
                    intent.suotaVersion = dataView.getUint8(0);
                    suotaInfo = true
                } else if (characteristicUUID == Constant.SUOTA_PATCH_DATA_CHAR_SIZE_UUID) {
                    intent.hasSuotaPatchDataSize = true
                    intent.suotaPatchDataSize = dataView.getUint16(0, true)
                    suotaInfo = true
                } else if (characteristicUUID == Constant.SUOTA_MTU_UUID) {
                    intent.hasSuotaMtu = true
                    intent.suotaMtu = dataView.getUint16(0, true)
                    suotaInfo = true
                } else if (characteristicUUID == Constant.SUOTA_L2CAP_PSM_UUID) {
                    intent.hasSuotaL2capPsm = true
                    intent.suotaL2capPsm = dataView.getUint16(0, true)
                    suotaInfo = true
                }
                // SPOTA
                else if (characteristicUUID == Constant.SPOTA_MEM_INFO_UUID) {

                    step = 5;
                } else {
                    sendUpdate = false;
                }

                if (sendUpdate) {
                    // Log.d(TAG, "onCharacteristicRead: " + index);

                    if (index >= 0) {
                        intent.characteristic = index;
                        intent.value = str;
                    } else if (suotaInfo) {

                    } else {
                        //TODO step -1 5
                        intent.step = step;
                        console.log(` dataView=${dataView.length} `)
                        intent.value = dataView.getUint32(0, true)
                    }
                    console.log(`=============================== onCharacteristicRead index=${index}  intent=${JSON.stringify(intent)}`)
                    processStep(intent)
                }
                if (isLast) {
                    initMTUCallback()
                }
                console.log(`readNextCharacteristic isLast=${isLast}  characteristicUUID=${characteristicUUID}  index=${index} step=${step} sendUpdate=${sendUpdate}`)

            })
            .catch(error => {
                bleModule.disconnected();
                if (navigation) {
                    navigation.popToTop()
                }
                console.log(`readNextCharacteristic error=${error}`)
            });
    } catch (error) {
        console.log(`readNextCharacteristic error=${error}  `)
    }

}

function setNavigation(nav) {
    navigation = nav
}

function setFileName(fn) {
    fileName = fn;
}

function sendRebootSignal() {
    SDK.SuotaManager.sendRebootSignal((reboot_signal) => {
        var buffer = new ArrayBuffer(4);
        var dataView = new DataView(buffer);
        dataView.setUint32(0, reboot_signal, true);
        bleModule.writeOTA(Array.from(new Uint8Array(buffer)), Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_MEM_DEV_UUID)
            .then(() => { 
            })
            .catch(error => {
                if (writeFailCallBack) {
                    writeFailCallBack(error);
                }
            })
    })
}

function setProgressCallBack(callback) {
    processCallBack = callback
}

function setSuccessCallBack(callback) {
    successCallBack = callback
}

function setWriteOTAFail(callback) {
    writeFailCallBack = callback
}

function setDeviceInfoCallBack(callback) {
    callback(deviceInfo)
}

function setInitMemoryType(callback) {
    initMemoryTypeCallBack = callback
}

function initMtuCallback(callback) {
    initMTUCallback = callback
}


function setSpotaMemDev() {
    const memType = SDK.SuotaManager.getSpotaMemDev();
    var buffer = new ArrayBuffer(4);
    var dataView = new DataView(buffer);
    dataView.setUint32(0, memType, true);
    // console.log(`getSpotaMemDev memType=${memType}  Array.from(new Uint8Array(buffer)=${Array.from(new Uint8Array(buffer))}`);
    bleModule.writeOTA(Array.from(new Uint8Array(buffer)), Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_MEM_DEV_UUID)
        .then(() => {
            if (step == 2 || step == 3)
                step = 3;
            processStep({ step })
        })
        .catch((error) => {
            writeFailCallBack(error)
            console.log(`setSpotaMemDev error=${error}`);
        })
    console.log('setSpotaMemDev: ' + memType.toString(16).padStart(10, '0'));
}


function updateFileChunkSize() {
    fileChunkSize = Math.min(patchDataSize, mtu - 3);
    console.log(`File chunk size set to fileChunkSize=${fileChunkSize}`)
}

function getFileChunkSize() {
    return fileChunkSize
}

function isDisconnected() {
    return disconnected;
}

export default {
    TYPE,
    ACTION_BLUETOOTH_GATT_UPDATE,
    ACTION_PROGRESS_UPDATE,
    ACTION_CONNECTION_STATE_UPDATE,
    DEFAULT_MTU,
    DEFAULT_FILE_CHUNK_SIZE,
    MEMORY_TYPE_SYSTEM_RAM,
    MEMORY_TYPE_RETENTION_RAM,
    MEMORY_TYPE_SPI,
    MEMORY_TYPE_I2C,
    DEFAULT_MEMORY_TYPE,
    DEFAULT_MISO_VALUE,
    DEFAULT_MOSI_VALUE,
    DEFAULT_CS_VALUE,
    DEFAULT_SCK_VALUE,
    DEFAULT_BLOCK_SIZE_VALUE,
    DEFAULT_MEMORY_BANK,
    DEFAULT_I2C_DEVICE_ADDRESS,
    DEFAULT_SCL_GPIO_VALUE,
    DEFAULT_SDA_GPIO_VALUE,
    MEMORY_TYPE_SUOTA_INDEX,
    MEMORY_TYPE_SPOTA_INDEX,
    canListener,
    setNavigation,
    getFileChunkSize,
    gpioStringToInt,
    otaStep,
    isDisconnected,
    init,
    setProgressCallBack,
    setSuccessCallBack,
    setWriteOTAFail,
    sendRebootSignal,
    setInitMemoryType,
    setFileName,
    enableNotifications,
    setDeviceInfoCallBack,
    initMtuCallback
}