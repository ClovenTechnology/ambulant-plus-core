import type { Bridge, PushAPI, LoginAPI, MapsAPI, PushMessage } from '../index';

const push: PushAPI = { async init(){}, async subscribe(){}, async notify(_m: PushMessage){} };
const login: LoginAPI = { async login(){ return { uid: 'mock-hms' }; }, async logout(){} };
const maps: MapsAPI = { open(lat, lng, label){ window.open(`https://petalmaps.huawei.com/?q=${lat},${lng}(${encodeURIComponent(label||'')})`, '_blank'); } };

const hms: Bridge = { push, login, maps };
export default hms;
