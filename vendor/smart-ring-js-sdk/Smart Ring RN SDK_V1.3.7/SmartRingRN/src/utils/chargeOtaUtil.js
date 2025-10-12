import SDK from '../lib/ringSDK';
import { bleModule } from '../module/BleModule';
import { OTA_WRITE_UUID,READ_AND_WRITE_RESPONSE_UUID } from '../common/Constant';

class ChargeOtaUtil {
    static instance = null;
    manager = null;
    delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    constructor() {
        if (ChargeOtaUtil.instance) {
            return ChargeOtaUtil.instance;
        }
        this.chargeOtaManger = SDK.ChargingOta;
        ChargeOtaUtil.instance = this;
    }

    static getInstance() {
        if (!ChargeOtaUtil.instance) {
            ChargeOtaUtil.instance = new ChargeOtaUtil();
        }
        return ChargeOtaUtil.instance;
    }

    callbacks = {
        write: async (data) => {
            await this.delay(1000)
            bleModule.writeOTA(Array.from(data),"",OTA_WRITE_UUID);
        },
        write_no_response: async (data) => {
            bleModule.writeChargeOTAWithoutResponse(Array.from(data),READ_AND_WRITE_RESPONSE_UUID);
        },
        read:async function() {
            return bleModule.readChargeOTA();
        }
    };

    init(data) {
        this.manager =new this.chargeOtaManger(this.callbacks, data);
        return this.manager;
    }


}

export const chargeOtaUtil = () => ChargeOtaUtil.getInstance();
