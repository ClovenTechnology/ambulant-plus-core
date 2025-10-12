

import axios from 'axios';

const axiosInstance = axios.create({ 
  baseURL: 'https://linktop.ltd/',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
});

//axios get请求
export const downloadOtaFile = (url) => {
  return axios.get(url, {
    responseType: 'arraybuffer'
  });
};

export default axiosInstance;