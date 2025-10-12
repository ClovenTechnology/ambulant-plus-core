import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, TextInput } from 'react-native';
import {  Picker } from '@react-native-community/picker';
import OtaUtil from '../utils/OtaUtil';
import { useDispatch } from 'react-redux';
import { setI2CAddr, setBlockSize, setMemoryType } from '../redux/variablesSlice';
import SDK from '../lib/ringSDK';

const { width } = Dimensions.get('window');
let options = [];
const TabBar = () => {

    const [activeTab, setActiveTab] = useState('SPI');
    const [i2c_addr, setI2C_Addr] = useState(OtaUtil.DEFAULT_I2C_DEVICE_ADDRESS);
    const [blockSize, setBlocksize] = useState(OtaUtil.DEFAULT_BLOCK_SIZE_VALUE);
    const [selectedSCL, setSelectedSCL] = useState(OtaUtil.DEFAULT_SCL_GPIO_VALUE);
    const [selectedSDA, setSelectedSDA] = useState(OtaUtil.DEFAULT_SDA_GPIO_VALUE);
    const [selectedBank, setSelectedBank] = useState(OtaUtil.DEFAULT_MEMORY_BANK);
    const [selectedMISO, setSelectedMISO] = useState(OtaUtil.DEFAULT_MISO_VALUE);
    const [selectedMOSI, setSelectedMISI] = useState(OtaUtil.DEFAULT_MOSI_VALUE);
    const [selectedCS, setSelectedCS] = useState(OtaUtil.DEFAULT_CS_VALUE);
    const [selectedSCK, setSelectedSCK] = useState(OtaUtil.DEFAULT_SCK_VALUE);
    const viewWidth = width / 2 - 10;

    const dispatch = useDispatch();
    const setmemoryType = (value) => dispatch(setMemoryType(value));
    const setblockSize = (value) => dispatch(setBlockSize(value));
    const setI2cAddr = (value) => dispatch(setI2CAddr(value));

    const handleTabPress = (tabName) => {
        setActiveTab(tabName);
        let type = tabName == "I2C" ? OtaUtil.MEMORY_TYPE_I2C : OtaUtil.MEMORY_TYPE_SPI;
        // console.log(` tabName=${tabName} type=${type}`)
        setmemoryType(type);
    };

    //I2C
    const handleI2CChange = (inputText) => {
        setI2C_Addr(inputText);
        const I2CDeviceAddressValue = parseInt(inputText);
        // console.log(` setI2C_Addr ${inputText}  I2CDeviceAddressValue=${I2CDeviceAddressValue}  `)
        setI2cAddr(I2CDeviceAddressValue);
    };

    //blocksize
    const handleBlockSizeChange = (inputText) => {
        setBlocksize(inputText);
        setblockSize(inputText);
    };

    //SCL
    const handleSclChange = (itemValue) => {
        let intToLabel = OtaUtil.gpioStringToInt(options[itemValue].label)
        // console.log(`handleSclChange  itemValue=${itemValue} label=${options[itemValue].label}  intToLabel=${intToLabel}`)
        setSelectedSCL(itemValue);
        SDK.SuotaManager.setSCL_GPIO(intToLabel);
    }

    //SDA
    const handleSdaChange = (itemValue) => {
        setSelectedSDA(itemValue);
        let intToLabel = OtaUtil.gpioStringToInt(options[itemValue].label)
        SDK.SuotaManager.setSDA_GPIO(intToLabel);
        // console.log(`  SDA =${itemValue} `)
    }

    //Bank
    const handleBankChange = (itemValue) => {
        setSelectedBank(itemValue);
        SDK.SuotaManager.setImageBank(itemValue)
        console.log(`  Bank =${itemValue} `)
    }

    //MISO
    const handleMisoChange = (itemValue) => {
        setSelectedMISO(itemValue);
        let intToLabel = OtaUtil.gpioStringToInt(options[itemValue].label)
        SDK.SuotaManager.setMISO_GPIO(intToLabel)
        console.log(`  MISO =${itemValue} intToLabel=${intToLabel}`)
    }

    //MISI
    const handleMisiChange = (itemValue) => {
        setSelectedMISI(itemValue);
        let intToLabel = OtaUtil.gpioStringToInt(options[itemValue].label)
        SDK.SuotaManager.setMISI_GPIO(intToLabel)
        console.log(`  MISI =${itemValue} intToLabel=${intToLabel}`)
    }

    //CS
    const handleCsChange = (itemValue) => {
        setSelectedCS(itemValue);
        let intToLabel = OtaUtil.gpioStringToInt(options[itemValue].label)
        SDK.SuotaManager.setCS_GPIO(intToLabel)
        console.log(`  CS =${itemValue} intToLabel=${intToLabel}`)
    }

    //SCK
    const handleSckChange = (itemValue) => {
        setSelectedSCK(itemValue);
        let intToLabel = OtaUtil.gpioStringToInt(options[itemValue].label)
        SDK.SuotaManager.setSCK_GPIO(intToLabel)
        console.log(`  sck =${itemValue} intToLabel=${intToLabel}`)
        // setsck(itemValue)
    }

    const initData = () => {
        console.log(` i2c_addr=${parseInt(i2c_addr)} `)
        setI2cAddr(parseInt(i2c_addr));
        setmemoryType(OtaUtil.DEFAULT_MEMORY_TYPE)
        SDK.SuotaManager.setMemoryType(OtaUtil.DEFAULT_MEMORY_TYPE)
        //scl
        let sclValue = OtaUtil.gpioStringToInt(options[selectedSCL].label);
        SDK.SuotaManager.setSCL_GPIO(sclValue);
        //sda
        let sdaValue = OtaUtil.gpioStringToInt(options[selectedSDA].label);
        SDK.SuotaManager.setSDA_GPIO(sdaValue);
        //miso
        let misoValue = OtaUtil.gpioStringToInt(options[selectedMISO].label);
        SDK.SuotaManager.setMISO_GPIO(misoValue);
        //misi
        let mosiValue = OtaUtil.gpioStringToInt(options[selectedMOSI].label);
        SDK.SuotaManager.setMISI_GPIO(mosiValue);
        //cs
        let csValue = OtaUtil.gpioStringToInt(options[selectedCS].label);
        SDK.SuotaManager.setCS_GPIO(csValue);
        //sck
        let sckValue = OtaUtil.gpioStringToInt(options[selectedSCK].label);
        SDK.SuotaManager.setSCK_GPIO(sckValue);
        //bank
        SDK.SuotaManager.setImageBank(selectedBank)
        console.log(` i2c_addr=${i2c_addr} blockSize=${blockSize} sclValue=${sclValue} sdaValue=${sdaValue} misoValue=${misoValue} 
        mosiValue=${mosiValue} csValue=${csValue} sckValue=${sckValue} selectedBank=${selectedBank}  `)
    }

    useEffect(() => {
        initData()
        console.log(`==== selectedSCL=${selectedSCL} selectedSDA=${selectedSDA}  selectedBank=${selectedBank}  selectedSDA=${selectedSDA}`)
    }, [])

    const initItem = () => {
        const numRows = 4;
        let matrix = [];
        let size = [12, 4, 10, 8];
        options = [];
        for (let index = 0; index < numRows; index++) {
            matrix[index] = new Array(size[index])
        }
        let valueIndex = 0
        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                options.push({
                    label: `P${i}_${j}`,
                    value: valueIndex
                })
                valueIndex++;
            }
        }
        return options.map((option, index) => (
            <Picker.Item key={index} label={option.label} value={option.value} />
        ))

    }

    return (
        <View style={{ padding: 10 }}>
            <View style={styles.spacing}>
                <Text>Select memory type</Text>
            </View>
            <View style={styles.container}>
                <TouchableOpacity
                    style={{ flex: 1, width: viewWidth, alignItems: 'center', padding: 10, backgroundColor: activeTab === 'I2C' ? 'blue' : 'gray' }}
                    onPress={() => handleTabPress('I2C')}
                >
                    <Text style={styles.halfWidthView}>I2C</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={{ flex: 1, width: viewWidth, alignItems: 'center', padding: 10, backgroundColor: activeTab === 'SPI' ? 'blue' : 'gray' }}
                    onPress={() => handleTabPress('SPI')}
                >
                    <Text style={styles.halfWidthView}>SPI</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'I2C' && (
                <View>
                    <Text>I2C device address</Text>
                    <TextInput
                        style={styles.input}
                        value={i2c_addr}
                        onChangeText={handleI2CChange}
                    />
                    <Text>SCL GPIO</Text>
                    <Picker
                        selectedValue={selectedSCL}
                        onValueChange={handleSclChange}
                    >
                        {initItem()}
                    </Picker>
                    <Text>SDA GPIO</Text>
                    <Picker
                        selectedValue={selectedSDA}
                        onValueChange={handleSdaChange}
                    >
                        {initItem()}
                    </Picker>
                    <Text>Image bank</Text>
                    <Picker
                        selectedValue={selectedBank}
                        onValueChange={handleBankChange}
                    >
                        <Picker.Item label="0" value="0" />
                        <Picker.Item label="1" value="1" />
                        <Picker.Item label="2" value="2" />
                    </Picker>
                    <Text>Block size</Text>
                    <TextInput
                        style={styles.input}
                        value={blockSize}
                        onChangeText={handleBlockSizeChange}
                    />
                </View>
            )}

            {activeTab === 'SPI' && (
                <View>
                    <Text>MISO GPIO</Text>
                    <Picker
                        selectedValue={selectedMISO}
                        onValueChange={handleMisoChange}
                    >
                        {initItem()}
                    </Picker>
                    <Text>MOSI GPIO</Text>
                    <Picker
                        selectedValue={selectedMOSI}
                        onValueChange={handleMisiChange}
                    >
                        {initItem()}
                    </Picker>
                    <Text>CS GPIO</Text>
                    <Picker
                        selectedValue={selectedCS}
                        onValueChange={handleCsChange}
                    >
                        {initItem()}
                    </Picker>
                    <Text>SCK GPIO</Text>
                    <Picker
                        selectedValue={selectedSCK}
                        onValueChange={handleSckChange}
                    >
                        {initItem()}
                    </Picker>
                    <Text>Image bank</Text>
                    <Picker
                        selectedValue={selectedBank}
                        onValueChange={handleBankChange}
                    >
                        <Picker.Item label="0" value="0" />
                        <Picker.Item label="1" value="1" />
                        <Picker.Item label="2" value="2" />
                    </Picker>
                    <Text>Block size</Text>
                    <TextInput
                        style={styles.input}
                        value={blockSize}
                        onChangeText={handleBlockSizeChange}
                    />
                </View>
            )}
        </View>
    );

};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        marginBottom: 10
    },
    spacing: {
        marginBottom: 10
    },
    halfWidthView: {
        flex: 1,
        color: 'white',
    },
    input: {
        height: 40,
        width: '80%',
        borderColor: 'blue',
        borderWidth: 0,
        borderBottomWidth: 1,
        paddingHorizontal: 10,
        marginBottom: 10
    },
})


export default TabBar;