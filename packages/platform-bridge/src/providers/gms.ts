import type { Bridge, PushAPI, LoginAPI, MapsAPI, PushMessage } from '../index';

const push: PushAPI = {
  async init(){}, async subscribe(_t){}, async notify(_m: PushMessage){},
};
const login: LoginAPI = {
  async login(){ return { uid: 'mock-gms' }; }, async logout(){},
};
const maps: MapsAPI = {
  open(lat, lng, label){ window.open(`https://maps.google.com/?q=${lat},${lng}(${encodeURIComponent(label||'')})`, '_blank'); },
};
const gms: Bridge = { push, login, maps };
export default gms;
