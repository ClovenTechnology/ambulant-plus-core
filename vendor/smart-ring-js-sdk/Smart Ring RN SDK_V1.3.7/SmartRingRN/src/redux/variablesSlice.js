import { createSlice } from '@reduxjs/toolkit';
import OtaUtil from '../utils/OtaUtil';

const initialState = {
    i2cAddr: OtaUtil.DEFAULT_I2C_DEVICE_ADDRESS,
    scl: OtaUtil.DEFAULT_SCL_GPIO_VALUE,
    sda: OtaUtil.DEFAULT_SDA_GPIO_VALUE,
    bank: OtaUtil.DEFAULT_MEMORY_BANK,
    blockSize: OtaUtil.DEFAULT_BLOCK_SIZE_VALUE,
    miso: OtaUtil.DEFAULT_MISO_VALUE,
    misi: OtaUtil.DEFAULT_MOSI_VALUE,
    cs: OtaUtil.DEFAULT_CS_VALUE,
    sck: OtaUtil.DEFAULT_SCK_VALUE,
    memoryType: OtaUtil.DEFAULT_MEMORY_TYPE,
    canListener:true,
};

const variablesSlice = createSlice({
    name: 'variables',
    initialState,
    reducers: {
        setI2CAddr: (state, action) => {
            state.i2cAddr = action.payload
        },
        setSCL: (state, action) => {
            state.scl = action.payload
        },
        setSDA: (state, action) => {
            state.sda = action.payload
        },
        setBank: (state, action) => {
            state.bank = action.payload
        },
        setBlockSize: (state, action) => {
            state.blockSize = action.payload
        },
        setMiso: (state, action) => {
            state.miso = action.payload
        },
        setMisi: (state, action) => {
            state.misi = action.payload
        },
        setCs: (state, action) => {
            state.cs = action.payload
        },
        setSck: (state, action) => {
            state.sck = action.payload
        },
        setMemoryType: (state, action) => {
            state.memoryType = action.payload
        },
    setCanListener:(state, action) => {
        state.canListener = action.payload
    },
   
    },
});

export const { 
    setI2CAddr, setSCL, setSDA, setBank, setBlockSize, 
    setMiso, setMisi, setCs, setSck, setMemoryType,
    setCanListener 
} = variablesSlice.actions;
export default variablesSlice.reducer;
