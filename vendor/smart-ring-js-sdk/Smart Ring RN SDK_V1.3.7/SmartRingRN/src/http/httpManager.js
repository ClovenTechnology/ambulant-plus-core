import RNFS from 'react-native-fs';
import axiosInstance, { downloadOtaFile } from './axiosConfig';
import { otaUrl, o2m_ecgUrl, phone_loginUrl, email_loginUrl, TABLE_NAME_BPDATA, bp_dbUrl, bp_to_serverUrl } from './urlCommon';
import { Buffer } from 'buffer';
import Util from '../utils/util';
import { do_encoding } from '../utils/loginUtil';
import utf8 from 'utf8';

function getByteLength(str) {
  return utf8.encode(str).length;
}

var ltk = "";
var lease = -1;
var mid = '';
class DownloadStrategy {
    constructor() {
        if (new.target === DownloadStrategy) {
            throw new TypeError("Cannot construct Abstract instances directly");
        }
        if (this.download !== undefined && typeof this.download !== 'function') {
            throw new TypeError('Must override download method');
        }
    }

    download(url, destination) {
        throw new TypeError('Method download must be implemented.');
    }
}

class OtaFileDownload extends DownloadStrategy {
    async download(type) {
        try {
            var params = this.base64UrlEncode(type);
            console.log(` params=${params} `)
            var url = otaUrl + params;
            const otaMsg = await axiosInstance({
                url,
                method: 'GET',
            });
            const localPath = `${RNFS.DocumentDirectoryPath}/${otaMsg.data.ver}.img`;
            console.log('Downloading file to localPath:', localPath);
            var uri = otaMsg.data.uri;
            const response = await downloadOtaFile(uri);
            const base64String = Buffer.from(new Uint8Array(response.data)).toString('base64');
            await RNFS.writeFile(localPath, base64String, 'base64');
            return {
                status: 'success',
                path: localPath,
            }
        } catch (error) {
            console.error('Download failed:', error);
            return {
                status: `Download failed:${error}`,
                path: "",
            }

        }
    }

    base64UrlEncode(str) {
        const data = Buffer.from(str).toString('base64');
        const uri = encodeURIComponent(data);
        return uri;
    }

}
//使用邮箱进行登录
export const emailLogin = async ({ username, pwd }) => {
    const accInfo = {
        'username': username,
        'pwd': pwd,
    }
    const params = do_encoding(accInfo);
    const url = email_loginUrl + "?" + params;
    // console.log(` url=${url} `);
    try {
        const response = await axiosInstance({
            url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        console.log(`emailLogin response=${JSON.stringify(response)} `);
        return response;
    } catch (error) {
        console.error('emailLogin failed:', error.response?.status);
        if (error.response?.status) {
            return {
                data: {
                    state: 1
                }
            }
        }
        return null;
    }
}
//使用手机号登录
export const phoneLogin = async ({ icode, phone, pwd }) => {
    console.log(`icode:${icode} phone:${phone} pwd:${pwd} `);
    const accInfo = {
        'no': phone,
        'pwd': pwd,
        'icode': icode
    }
    const params = do_encoding(accInfo);
    console.log(` params=${params}`);
    const url = phone_loginUrl + "?" + params;
    console.log(` url=${url} `);
    try {
        const response = await axiosInstance({
            url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        // console.log(`phoneLogin response=${JSON.stringify(response)} `);
        return response;
    } catch (error) {
        console.error('phoneLogin failed:', error);
        return null;
    }
}

///查询服务器数据库的最后一条数据的时间戳
export const queryLastTsBpDataFromServer = async ({ token: token, account: account }) => {
    try {
        console.log("czq", "token=" + token + "account=" + account);
        const url = bp_dbUrl + "?" + `tn=${encodeURIComponent(TABLE_NAME_BPDATA)}&account=${encodeURIComponent(account)}&t=${encodeURIComponent(token)}`;
        const response = await axiosInstance({
            url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        if (response.status == 200) {
            if (response.data.fv == null) {
                return 0;
            }
            return Number(response.data.fv);
        }

        console.log(`queryLastTsBpDataFromServer response=${JSON.stringify(response)} `);
        return null;
    } catch (error) {
        console.error('queryLastTsBpDataFromServer failed:', error);
        return null;
    }
}
//将bp数据上传服务端
export const sendJsonArrayToServer = async ({ account: account, t: token, data: data }) => {
    try {
        let url = bp_to_serverUrl + "?" + `account=${encodeURIComponent(account)}&tn=${encodeURIComponent(TABLE_NAME_BPDATA)}&lf=ts&t=${encodeURIComponent(token)}`;

        const jsonData = JSON.stringify(data);
        
        const dataLength = getByteLength(jsonData);
        console.log(`==url=${url} jsonData=${jsonData}  dataLength=${dataLength}`);
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
        };

        if (dataLength > 0) {
            headers['Content-Length'] = dataLength;
        }
        const response = await axiosInstance({
            url,
            method: 'POST',
            headers: headers,
            data: data,
        });
        return response.data;
    } catch (error) {
        console.error('sendJsonArrayToServer failed:', error);
        return null;
    }
}

export const requestWebEcgData = async ({
    key: key,
    sn: sn,
    mac: mac,
    secret: secret,
    isSpe: isSpe,
}, data) => {
    const sign = Util.generateHmacMd5(sn, mac, secret);
    const type = isSpe ? 'spe' : 'arrhythmia'
    const url = o2m_ecgUrl + `${type}?_key=${key}&sn=${sn}&mac=${mac}&_sign=${sign}`;
    try {
        const response = await axiosInstance({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Accept-Encoding': 'gzip, deflate',
            },
            data: data,
        });
        return response.data;
    } catch (error) {
        console.error('requestEcgData failed:', error);
        return null;
    }
}

export const registerDevice = async ({
    sn: sn,
    age: age,
    gender: gender,
    height: height,
    weight: weight,
    familyHistory: familyHistory,
    highCholesterol: highCholesterol,
}) => {
    console.log(`registerDevice sn=${sn} age=${age} gender=${gender} height=${height} weight=${weight} familyHistory=${familyHistory} highCholesterol=${highCholesterol}`);
    const url = '/ppg/reg_psn';
    try {
        const params = new URLSearchParams({
            sn: sn,
            age: age,
            gender: gender,
            height: height,
            weight: weight,
            family_history: familyHistory,
            high_cholesterol: highCholesterol,
        });
        const response = await axiosInstance({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept-Encoding': 'gzip, deflate',
            },
            data: params.toString(),
        });
        if(response.status==200){
            if(response.data.state==0){
                ltk=response.data.ltk;
                lease=response.data.lease;
                return "Registration successful";
            }else if(response.data.state==1){
                return "Upstream error" 
            }else if(response.data.state==2){
                return "Invalid SN"
            }

        }
        return "Registration failed";
    } catch (error) {
        console.error('registerDevice failed:', error);
        return null;
    }
}

export const uploadPpgRecord = async ({
    fasting,
    within2HrsMeal,
    startTime,
    endTime,
    ppgData,
}) => {
    const ltkData = encodeURIComponent(ltk);
    const url = `/ppg/new_smp?ltk=${ltkData}`;
    try {
        const response = await axiosInstance({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            data: {
                'fasting': fasting,
                'within2HrsMeal': within2HrsMeal,
                'start': startTime,
                'end': endTime,
                'ppgData': ppgData,
            },
        });
        if(response.status==200){
            if(response.data.state==0){
                mid=response.data.mid;
                return "Upload successful";
            }else if(response.data.state==1){
                return "Invalid lease"
            }
        }
        return "Upload failed";
    } catch (error) {
        console.error('uploadPpgRecord failed:', error);
        return null;
    }
}

export const getPpgResult = async () => {
    const midData = encodeURIComponent(mid);
    const url = `/ppg/anr_smp?mid=${midData}`;
    try {
        const response = await axiosInstance({
            url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept-Encoding': 'gzip, deflate',
            },
        });
        if(response.status==200){
            if(response.data.state==0){
                return response.data;
            }else if(response.data.state==1){
                return "SN not registered"
            }
        }
        return "Get result failed";
    } catch (error) {
        console.error('getPpgResult failed:', error);
        return null;
    }
}



export const DownloadFactory = {
    createStrategy(strategyName) {
        switch (strategyName) {
            case 'otaFileDownload':
                return new OtaFileDownload();
            // 可以扩展更多策略，如 'resume' 断点续传下载
            default:
                throw new Error('Invalid download strategy');
        }
    },
};