import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-community/picker';
// 自定义对话框组件
const SportModeDialog = ({ visible, onClose, onConfirm }) => {
    const [sportModeSwitch, setSportModeSwitch] = useState(0);
    const [sportType, setSportType] = useState(0);
    //运动强度
    const [strengthGrade, setStrengthGrade] = useState(0.05)
    const [personalHeight, setPersonalHeight] = useState("");
    
    const [sportModeTimeInterval, setSportModeTimeInterval] = useState("");
    const [sportModeTimeDuration, setSportModeTimeDuration] = useState("");

    const handleConfirm = () => {
        // 调用父组件传入的回调函数，传递选项和年龄值
        onConfirm(sportModeSwitch,sportType,strengthGrade,personalHeight, sportModeTimeInterval,sportModeTimeDuration);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleCancel}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>

                    <Picker
                        selectedValue={sportModeSwitch}
                        onValueChange={(itemValue) => setSportModeSwitch(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Sport mode off" value={0} />
                        <Picker.Item label="Sport mode on" value={1} />
                    </Picker>
                    <Picker
                        selectedValue={sportType}
                        onValueChange={(itemValue) => setSportType(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Other sports" value={0} />
                        <Picker.Item label="Run" value={1} />
                    </Picker>
                    <Picker
                        selectedValue={strengthGrade}
                        onValueChange={(itemValue) => setStrengthGrade(itemValue)}
                        style={styles.picker1}
                    >
                        <Picker.Item label="Low intensity exercise" value={0.05} />
                        <Picker.Item label="Moderate intensity exercise" value={0.08} />
                        <Picker.Item label="High intensity exercise" value={0.1} />
                    </Picker>
                    <TextInput
                        placeholder="Please enter your height unit (cm)"
                        keyboardType="numeric"
                        value={personalHeight}
                        onChangeText={(text) => setPersonalHeight(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Record data time interval between 10 and 180 seconds"
                        keyboardType="numeric"
                        value={sportModeTimeInterval}
                        onChangeText={(text) => setSportModeTimeInterval(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Duration 5-180 minutes"
                        keyboardType="numeric"
                        value={sportModeTimeDuration}
                        onChangeText={(text) => setSportModeTimeDuration(text)}
                        style={styles.input}
                    />
                    {/* 最后一行：确定和取消按钮 */}
                    <View style={styles.buttonContainer}>
                        <Button title="确定" onPress={handleConfirm} color="#ff5c5c" />
                        <Button title="取消" onPress={handleCancel} color="#ff5c5c" />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明背景
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        // shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    picker: {
        width: 190,
        marginBottom: 15,
        
    },
    picker1: {
        width: 280,
        marginBottom: 15,
    },
    input: {
        width: '100%',
        borderColor: '#ccc',
        borderWidth: 1,
        padding: 8,
        marginBottom: 15,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: 150,
    },
});

export default SportModeDialog;