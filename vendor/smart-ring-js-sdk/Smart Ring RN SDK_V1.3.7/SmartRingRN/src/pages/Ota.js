import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, ScrollView,Button } from "react-native";
import TabBar from '../components/TabBar'
import OtaUtil from '../utils/OtaUtil';
import SDK from '../lib/ringSDK';
import { useSelector } from 'react-redux';
import { registerErrorListener, unRegisterErrorListener } from '../utils/ListenerUtils'
import {bleModule} from '../module/BleModule'
const Ota = ({ navigation, route }) => {

    const [disabled, setDisabled] = useState(true)
    const memoryType = useSelector((state) => state.variables.memoryType);
    const i2cAddr = useSelector((state) => state.variables.i2cAddr);
    const blockSize = useSelector((state) => state.variables.blockSize);
    const { bytes } = route.params;

    const showDialog = (content) => {
        Alert.alert(
            'Warning',
            content,
            [
                { text: 'Cancel', style: 'cancel' },
            ],
            {
                cancelable: false
            }
        );
    }



    const startToUpdata = () => {
        startUpdate();
        navigation.navigate('upgradeProcess', {
            bleModule
        });
    }

    const startUpdate = () => {
        console.log(`startUpdate= memoryType=${memoryType} `)
        SDK.SuotaManager.setMemoryType(memoryType);
        SDK.SuotaManager.setType(SDK.SuotaManager.TYPE);
        if (memoryType === OtaUtil.MEMORY_TYPE_I2C) {
            try {
                if (i2cAddr == 0) {
                    i2cAddr = parseInt(OtaUtil.DEFAULT_I2C_DEVICE_ADDRESS, 10);
                }
                SDK.SuotaManager.setI2CDeviceAddress(i2cAddr);
            } catch (nfe) {
                showDialog("I2C Parameter Error,Invalid I2C device address.");
                return;
            }
        }
        let fileBlockSize = 1;
        if (SDK.SuotaManager.getType() === OtaUtil.TYPE) {
            try {
                fileBlockSize = Math.abs(parseInt(blockSize.toString(), 10));
            } catch (nfe) {
                fileBlockSize = 0;
            }
            if (fileBlockSize === 0) {
                showDialog("Invalid block size,The block size cannot be zero.");
                return;
            }
        }
        console.log(` fileBlockSize=${fileBlockSize} OtaUtil.getFileChunkSize()=${OtaUtil.getFileChunkSize()}`)
        SDK.SuotaManager.fileSetType(SDK.SuotaManager.TYPE, bytes);
        SDK.SuotaManager.setFileBlockSize(fileBlockSize, OtaUtil.getFileChunkSize());
        var intent = {
            action: OtaUtil.ACTION_BLUETOOTH_GATT_UPDATE,
            step: 1
        }
        OtaUtil.otaStep(intent)
    }

    var errorListener = {
        onResult: (data) => {
            Alert.alert(
                'Tip',
                `${data}`,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            bleModule.disconnected()
                            navigation.popToTop()
                        },
                    },
                ],
                {
                    cancelable: false,
                }
            );
        }
    }

    useEffect(() => {
        OtaUtil.init();
        registerErrorListener(errorListener)
        OtaUtil.setNavigation(navigation);
        var intent = {
            action: OtaUtil.ACTION_BLUETOOTH_GATT_UPDATE,
            step: 0
        }
        OtaUtil.otaStep(intent)
        OtaUtil.initMtuCallback(()=>{
            setTimeout(()=>{
                setDisabled(false);
            },2000)
        })
        return () => {
            unRegisterErrorListener(errorListener)
        }
    }, []);


    return (
        <ScrollView horizontal={true}>
            <ScrollView>
                <TabBar></TabBar>
                <View style={styles.container}>
                    <Button title="SEND TO DEVICE" disabled={disabled} onPress={() => startToUpdata()} style={styles.button}></Button>
                </View>
            </ScrollView>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
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

export default Ota;