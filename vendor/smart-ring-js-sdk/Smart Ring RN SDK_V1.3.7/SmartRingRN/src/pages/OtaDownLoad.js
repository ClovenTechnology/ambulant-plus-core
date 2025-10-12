import React, { useEffect, useRef,useState } from "react";
import { View, StyleSheet, NativeModules, Text } from "react-native";
import CustomButton from "../components/CustomButton";
import DocumentPicker from 'react-native-document-picker';
import { DownloadFactory } from '../http/httpManager';
import { RingModel } from '../http/otaModel';
import FileUtils from "../utils/FileUtils";
import OtaUtil from '../utils/OtaUtil';
import * as Constant from '../common/Constant';
import { bleModule } from '../module/BleModule';
import { useNavigation } from '@react-navigation/native';
import EasyToast from 'react-native-easy-toast';
import { Picker } from '@react-native-community/picker';
const { FileUtilModule } = NativeModules;
const OtaDownLoad = () => {

    const toastRef = useRef(null);
    const [model, setModel] = useState(RingModel.sr28);
    const navigation = useNavigation();
    useEffect(() => {

    }, []);

    const showToast = (message) => {
        // 显示一个简单的Toast消息
        toastRef.current.show(message, 2000); // 2000毫秒后自动消失
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

            console.log(
                '选择的文件URI: ' + res.uri,
                '选择的文件类型: ' + res.type, // mime类型
                '选择的文件名称: ' + res.name,
                '选择的文件大小: ' + res.size,
                `${JSON.stringify(res)}`
            );

        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                console.log('用户取消了选择文件');
            } else {
                console.log('选择文件时出现错误: ' + err);
            }
        }
    }

    async function startToDownload() {
        var otaFileDownload = DownloadFactory.createStrategy("otaFileDownload");
        console.log(`model=${model}`)
        const { status, path } = await otaFileDownload.download(model);
        if (status == 'success') {
            dealFile(path);
        } else {
            showToast(status);
        }
    }

    async function dealFile(path) {
        var result = await FileUtils.readFilePath(path)
        var bytes = result.data
        OtaUtil.setFileName(result.fileName)
        console.log(`fileName: ${result.fileName} `)
        bleModule.getOtaUUID();
        bleModule.startOTANotification(Constant.SPOTA_SERVICE_UUID, Constant.SPOTA_SERV_STATUS_UUID)
            .then(() => {
                if (bytes) {
                    console.log(` navigation=${JSON.stringify(JSON.stringify(navigation))} `)
                    navigation.navigate('ota', {
                        bleModule, bytes
                    });
                }
            })
    }

    return (
        <View style={styles.container}>
            <Text style={styles.textStyle}>1.OTA Download From Local</Text>
            <CustomButton onPress={() => startToSelectFile()}>
                {"Select File"}
            </CustomButton>
            <Text style={styles.textStyle}>2.OTA Download From Web</Text>
            <Picker
                selectedValue={model}
                onValueChange={(itemValue) => setModel(itemValue)}
                style={styles.picker}
            >
                <Picker.Item label="sr28" value={RingModel.sr28} />
                <Picker.Item label="sr09" value={RingModel.sr09} />
                <Picker.Item label="sr09n" value={RingModel.sr09n} />
                <Picker.Item label="sr23" value={RingModel.sr23} />
                <Picker.Item label="sr26" value={RingModel.sr26} />
            </Picker>
            <CustomButton onPress={() => startToDownload()}>
                Start Download
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

export default OtaDownLoad;