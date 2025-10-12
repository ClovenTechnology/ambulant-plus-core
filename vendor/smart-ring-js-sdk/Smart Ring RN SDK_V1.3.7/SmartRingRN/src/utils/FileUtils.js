import RNFS from 'react-native-fs';
import { decode } from 'base-64';
import testJson from '../assets/wm_dump_06-11-2024-08-43.json';
const readFile = async (filePath) => {
    try {
        console.log('file path=', filePath);
        const exists = await RNFS.existsAssets(filePath);

        if (exists) {
            const fileName = filePath.match(/[^/]+$/)[0];
            // 读取文件内容
            const content = await RNFS.readFileAssets(filePath, 'base64');
            const binaryData = decode(content);
            const byteArray = Array.from(binaryData, char => {
                const unsignedValue = char.charCodeAt(0);
                const signedValue = unsignedValue > 127 ? unsignedValue - 256 : unsignedValue;
                return signedValue;
            });
            return byteArray;

        } else {
            console.log('file not exist');
        }
    } catch (error) {
        console.log('file error', error);
    }
};

const readFilePath = async (filePath) => {
    try {
        const exists = await RNFS.exists(filePath);
        console.log(`========readFilePath======exists==${exists}====`)
        if (exists) {
            const fileName = filePath.match(/[^/]+$/)[0];
            const content = await RNFS.readFile(filePath, 'base64');

            const binaryData = decode(content);
            const byteArray = Array.from(binaryData, char => {
                const unsignedValue = char.charCodeAt(0);
                const signedValue = unsignedValue > 127 ? unsignedValue - 256 : unsignedValue;
                return signedValue;
            });
            return {
                data: byteArray,
                fileName
            };
        } else {
            console.log('file not exist');
        }
    } catch (error) {
        console.log('读取文件时出现错误：', error);
    }
};


const isExistFile = async (path) => {
    var isExist = false
    await RNFS.exists(filePath)
        .then((exists) => {
            if (exists) {
                console.log('File exists');
                isExist = true
            } else {
                console.log('File does not exist');
            }
        })
        .catch((error) => {
            console.log('Error checking file existence:', error);
        });
    return isExist
}

function readFileAssets() {
    let historyArray = [];
    for (let index = 0; index < testJson.length; index++) {
        const data = testJson[index];
        historyArray.push({
            timeStamp: data.timeStamp,
            heartRate: data.heartRate,
            motionDetectionCount: data.motionDetectionCount,
            detectionMode: data.detectionMode,
            wearStatus: data.wearStatus,
            chargeStatus: data.chargeStatus,
            uuid: data.uuid,
            hrv: data.hrv,
            temperature: parseFloat(data.temperature),
            step: data.step,
            ox: data.ox,
            rawHr: data.rawHr,
            sportsMode: data.sportsMode,
            respiratoryRate: data.respiratoryRate,
        });
    }
    // console.log('==historyArray',JSON.stringify(historyArray)); 
    console.log('==historyArray', historyArray.length);
    return historyArray;
};

async function writeFile(string,isRaw=false,isNsk=false) {
    try {
        // const localPath = `${RNFS.DocumentDirectoryPath}/ecg.json`;
        let publicFilePath='';
        if(isRaw){
            publicFilePath = `${RNFS.ExternalStorageDirectoryPath}/rawEcg.txt`;
        }else if(isNsk){
            publicFilePath = `${RNFS.ExternalStorageDirectoryPath}/nskEcg.txt`;
        }else{
            publicFilePath = `${RNFS.ExternalStorageDirectoryPath}/ecg.txt`;
        }
        console.log('writeFile file to localPath:', publicFilePath);
        await RNFS.writeFile(publicFilePath, string, 'utf8');
        console.log('writeFile success');
        return {
            status: 'success',
            path: publicFilePath,
        }
    } catch (error) {
        console.error('Download failed:', error);
        return {
            status: `Download failed:${error}`,
            path: "",
        }
    }
}

async function writeHistoryFile(string) {
    try {
        let publicFilePath=`${RNFS.ExternalStorageDirectoryPath}/history.txt`;
        console.log('writeFile file to localPath:', publicFilePath);
        await RNFS.writeFile(publicFilePath, string, 'utf8');
        console.log('writeFile success');
        return {
            status: 'success',
            path: publicFilePath,
        }
    } catch (error) {
        console.error('Download failed:', error);
        return {
            status: `Download failed:${error}`,
            path: "",
        }
    }
}

export default {
    readFile,
    isExistFile,
    readFilePath,
    readFileAssets,
    writeFile,
    writeHistoryFile
}