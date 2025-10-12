import {Buffer} from 'buffer';
export function encry_RC4_str(data, key) {
    if (!data || !key) {
        return null;
    }
    const buf = encry_RC4_byte(data, key);
    const s = Buffer.from(buf).toString('binary');
    return toHexString(s);
}

function toHexString(str) {
    return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

function encry_RC4_byte(data, key) {
    if (!data || !key) {
        return null;
    }
    const bytes = Buffer.from(data, 'latin1'); // ISO_8859_1在Node.js中对应'latin1'
    return RC4Base(bytes, key);
}

function RC4Base(data, key) {
    let s = [], j = 0, x, res = [];
    // Key-scheduling algorithm (KSA)
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
    }
    // Pseudo-random generation algorithm (PRGA)
    let i = 0;
    j = 0;
    for (let y = 0; y < data.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
        const k = s[(s[i] + s[j]) % 256];
        res.push(data[y] ^ k);
    }
    return Buffer.from(res);
}
