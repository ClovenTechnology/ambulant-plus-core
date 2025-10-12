import CryptoJS from 'crypto-js';
import queryString from 'query-string';
import {Buffer} from 'buffer';
import Config from 'react-native-config';
import {encry_RC4_str} from './arc4Util'
const API_KEY='902feebe2bd04ba69a8bb1b87fdf95cc'
const API_SECRET='972caa9127c74f8b825a23e1201f3e9c'
export function do_encoding(accInfo) {
    var api_key=Config.API_KEY;
    var api_secret = Config.API_SECRET;
    if(api_key==undefined){
        api_key=API_KEY;
    }
    if(api_secret==undefined){
        api_secret=API_SECRET;
    }
    console.log(` api_key=${api_key} api_secret=${api_secret}`);
    

    const plain = queryString.stringify(accInfo);
    const rc4Str= encry_RC4_str(plain,api_secret);
    console.log(` plain=${plain} rc4Str=${rc4Str}`);

    const hmac = CryptoJS.HmacSHA1(plain, api_secret);
   
    const sign = hmac.toString(CryptoJS.enc.Hex);
    console.log(` hmac=${hmac} sign=${sign}`);

    const dict = {};
    dict["k"] = api_key;
    dict["a"] = rc4Str;
    dict["h"] = sign;
    dict["v"] = "1";

    console.log(` api_key=${api_key} plain=${plain}  sign=${sign}`);
    return joinStringIso(dict, true);
}

function joinStringIso(dict, encode) {
    if (!dict) return null;
    let content = '';
    let i = 0;
    const size = Object.keys(dict).length;
    for (let [key, value] of Object.entries(dict)) {
        if (value == null) return null;
        if (encode) {
            key = decodeURIComponent(encodeURIComponent(key)); // 模拟ISO-8859-1编码
            value = decodeURIComponent(encodeURIComponent(value));
            content += `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        } else {
            content += `${key}=${value}`;
        }
        i++;
        if (i < size) content += '&';
    }
    return content;
}