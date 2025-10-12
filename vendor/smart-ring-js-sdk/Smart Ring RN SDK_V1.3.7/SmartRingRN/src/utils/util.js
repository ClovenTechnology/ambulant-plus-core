
import CryptoJS from 'crypto-js';
import SDK from '../lib/ringSDK';
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateHmacMd5(sn, mac, secret) {
    // Join the serial number and MAC address with a comma
    // const data = [sn, mac].join(',');
    // console.log('generateHmacMd5 data:', data);
    // // Create HMAC-MD5 hash
    // const sign = CryptoJS.HmacMD5(data, secret).toString(CryptoJS.enc.Hex);
    const message = `${sn},${mac}`;
    const hmac = CryptoJS.HmacMD5(message, secret);
    const hexDigest = hmac.toString(CryptoJS.enc.Hex);
    return hexDigest;
}


export default {
    delay,
    generateHmacMd5,
}