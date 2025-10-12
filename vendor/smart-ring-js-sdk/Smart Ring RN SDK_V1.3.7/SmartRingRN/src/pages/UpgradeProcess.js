import React, { useEffect, useState,useRef } from "react";
import { Text, View, StyleSheet, Alert } from "react-native";
import * as Progress from 'react-native-progress';
import SDK from '../lib/ringSDK'
import OtaUtil from "../utils/OtaUtil";
import { BleEventType } from '../common/Type';
import { useDispatch } from 'react-redux';
import { setCanListener } from '../redux/variablesSlice';
import Util from '../utils/util'
import {bleModule} from '../module/BleModule'
const UpgradeProcess = ({ navigation, route }) => {
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState("");
    const [currentBlock, setCurrentBlock] = useState(0);
    const [totalBlock, setTotalBlock] = useState(100);
    const [deviceInfo, setDeviceInfo] = useState("");
    const sendBlock = useRef(false)
    const dispatch = useDispatch();
    const setcanListener = (value) => dispatch(setCanListener(value));

    const showDialog = (content, Press) => {
        Alert.alert(
            'Tip',
            content,
            [
                {
                    text: 'OK',
                    onPress: Press,
                },
            ],
            {
                cancelable: false,
            }
        );
    }
    /** 蓝牙状态改变 */
    function handleUpdateState(event) {
        console.log('BleManagerDidUpdateState:', JSON.stringify(event));
        bleModule.bleState = event.state;

    }

    /** 接收到新数据 */
    async function handleUpdateValue(data) {
        let value = data.value;
        console.log(` handleUpdateValue=${JSON.stringify(data)} `)
        var step = -1;
        var error = -1;
        var status = -1;
        var isSuota = SDK.SuotaManager.getType() == SDK.SuotaManager.TYPE;

        // SUOTA image started
        if (value == 0x10) {
            step = 3;
        }
        // Successfully sent a block, send the next one
        else if (value == 0x02) {
            step = isSuota ? 5 : 8;
        }
        // SPOTA service status
        else if (!isSuota && (value == 0x01 || value == 0x03)) {
            status = value;
        } else {
            error = value;
        }
        if (step >= 0 || error >= 0 || status >= 0) {
            await Util.delay(300)
            // setTimeout(() => {
            if(step==5&&sendBlock.current){
                return
            }    
            OtaUtil.otaStep({
                action: OtaUtil.ACTION_BLUETOOTH_GATT_UPDATE,
                step,
                error,
                status
            })
            if(step==5){
                sendBlock.current=true
            }
            // }, 300)
            console.log(` onCharacteristicChanged, step: ${step} error:${error}  status:${status}`)
        }
    }


    useEffect(() => {
        OtaUtil.canListener = false
        setcanListener(false);
        console.log(`useEffect UpgradeProcess`)
        const updateValueListener = bleModule.addListener(
            BleEventType.BleManagerDidUpdateValueForCharacteristic,
            handleUpdateValue,
        );
        const updateStateListener = bleModule.addListener(
            BleEventType.BleManagerDidUpdateState,
            handleUpdateState,
        );

        OtaUtil.setInitMemoryType((fileName) => {
            setFileName(fileName)
            console.log(`fileName=${fileName}`);
        })

        OtaUtil.setProgressCallBack((progress, chunkNumber, totalChunkCount) => {
            setProgress(progress);
            setCurrentBlock(chunkNumber);
            setTotalBlock(totalChunkCount);
            console.log(`progress=${progress} chunkNumber=${chunkNumber} totalChunkCount=${totalChunkCount} `);
        })

        OtaUtil.setSuccessCallBack(() => {
            showDialog('Firmware upgrade successful', () => {
                OtaUtil.sendRebootSignal()
                navigation.popToTop();
            })
            console.log(`[Success]`);
        })

        OtaUtil.setWriteOTAFail((error) => {
            console.log(` setWriteOTAFail error=${error}`)
            if(error?.includes("disconnect")){
                return 
            }
            if (!error?.includes("133")) {
                showDialog(error, () => {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    }
                })
            }
        })

        OtaUtil.setDeviceInfoCallBack(deviceInfo => {
            console.log(` ${JSON.stringify(deviceInfo)} `)
            var info = ""
            // if(deviceInfo.version){
            //     info+=" Version:"+deviceInfo.version
            // }
            if (deviceInfo.suotaPatchDataSize) {
                info += " suotaPatchDataSize:" + deviceInfo.suotaPatchDataSize
            }
            if (deviceInfo.suotaMtu) {
                info += " suotaMtu:" + deviceInfo.suotaMtu
            }
            if (deviceInfo.suotaL2capPsm) {
                info += " suotaL2capPsm:" + deviceInfo.suotaL2capPsm
            }
            setDeviceInfo(info)
        })

        return () => {
            updateStateListener.remove();
            updateValueListener.remove();
        }
    }, []);


    return (
        <View style={styles.container}>
            <Text>File:{fileName}</Text>
            <Text>{deviceInfo}</Text>
            <Text>CurrentBlock:{currentBlock}/TotalBlock:{totalBlock}</Text>
            <Progress.Bar progress={progress} width={500} />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // justifyContent: 'center',
        alignItems: 'center',

    },
    button: {
        width: 200,
        backgroundColor: 'red'
    },
    textStyle: {
        paddingLeft: 10
    }
})

export default UpgradeProcess;