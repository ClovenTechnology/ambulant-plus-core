import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, NativeModules, Text } from "react-native";
import * as Progress from 'react-native-progress';
import CustomButton from "../components/CustomButton";
import DocumentPicker from 'react-native-document-picker';
import FileUtils from "../utils/FileUtils";
import * as Constant from '../common/Constant';
import { bleModule } from '../module/BleModule';
import EasyToast from 'react-native-easy-toast';
import { chargeOtaUtil } from '../utils/chargeOtaUtil'
import { BleEventType } from '../common/Type';
const { FileUtilModule } = NativeModules;
const otaUtil = chargeOtaUtil();
const ChargeOta = () => {

    const toastRef = useRef(null);
    const [fileName, setFileName] = useState("");
    const [otaData, setOtaData] = useState(null);
    const [progress, setProgress] = useState(0);
    const [updateResult,setUpdateResult] = useState("")
    const manager = useRef(null);
    const MTU = 512;

    useEffect(() => {
        bleModule.getOtaUUID();
        bleModule.startChargeOTANotification(Constant.OTA_NOTIFY_RESPONSE)         
        bleModule.requestMtu(MTU)
        const updateValueListener = bleModule.addListener(
            BleEventType.BleManagerDidUpdateValueForCharacteristic,
            handleUpdateValue,
        );

        return () => {
            updateValueListener.remove();
        }
    }, []);

    async function handleUpdateValue(data) {
        if (manager.current) {
            manager.current.receiveData(data.value)
        }
    }

    const showToast = (message) => {
        toastRef.current.show(message, 2000); 
    };



    async function startToSelectFile() {
        try {
            const res = await DocumentPicker.pickSingle({
                type: [DocumentPicker.types.allFiles],
            });
            let path = ""
            if (Platform.OS == 'android') {
                await FileUtilModule.getFilePath(res.uri, (result) => {
                    path = result.path
                    dealFile(path)
                })
            } else {
                dealFile(res.uri)
            }
        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                console.log('The user has cancelled the selection of files');
            } else {
                console.log('error: ' + err);
            }
        }
    }



    async function startUpgrade() {
        if(!otaData){
            showToast("Please select the upgrade file")
            return
        }
        setUpdateResult("upgrade ...")
        manager.current = otaUtil.init(otaData)
        manager.current.on('progress', (data) => {
            setProgress(data)

        })
        manager.current.on('finish', (result) => {
            setUpdateResult(result?"upgrade success":"upgrade fail")
        });

        manager.current.on('error', (error) => {
            console.error('error:', error);
        });
        manager.current.requestMtu(MTU);
        manager.current.handleDigestData();
    }

    async function dealFile(path) {
        var result = await FileUtils.readFilePath(path)
        var bytes = result.data
        setFileName(result.fileName)
        setOtaData(bytes)
        console.log(`fileName: ${result.fileName} `)
    }

    return (
        <View style={styles.container}>
            <View style={styles.titleContainer}>
                <Text>File:{fileName}</Text>
                <Progress.Bar  progress={progress} width={400} />
                <Text>{updateResult}</Text>
            </View>
            <Text style={styles.textStyle}>OTA Download From Local</Text>
            <CustomButton onPress={() => startToSelectFile()}>
                {"Select File"}
            </CustomButton>
            <CustomButton onPress={() => startUpgrade()}>
                Start Upgrade
            </CustomButton>
            <EasyToast ref={toastRef} position="center" />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 10,
    },
    titleContainer: {
        paddingBottom:20,
        alignItems: 'center',
    },
    button: {
        width: 400,
        backgroundColor: 'red'
    },
    textStyle: {
        paddingLeft: 10
    },
    picker: {
        width: 280,
        marginBottom: 15,
    },
})

export default ChargeOta;