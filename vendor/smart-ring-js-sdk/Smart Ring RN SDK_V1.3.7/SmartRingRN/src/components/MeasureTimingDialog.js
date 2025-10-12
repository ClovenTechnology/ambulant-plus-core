import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View, Text } from 'react-native';
import { Picker } from '@react-native-community/picker';
// 自定义对话框组件
const MeasureTimingDialog = ({ visible, onClose, onConfirm }) => {
    const [fuc, setFuc] = useState(0);
    const [type, setType] = useState(0);
    const [time1, setTime1] = useState("10");
    const [time1Interval, setTime1Interval] = useState("0");
    const [time2, setTime2] = useState("10");
    const [time2Interval, setTime2Interval] = useState("0");
    const [time3Interval, setTime3Interval] = useState("2");
    const [threshold, setThreshold] = useState("1");

    const handleConfirm = () => {
        // 调用父组件传入的回调函数，传递选项和年龄值
        onConfirm(fuc, type, parseInt(time1), parseInt(time1Interval), parseInt(time2), parseInt(time2Interval)
            , parseInt(time3Interval), parseInt(threshold)
        );
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
                    {/* 第一行：选择控件 */}
                    <Picker
                        selectedValue={fuc}
                        onValueChange={(itemValue) => setFuc(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="get" value={0} />
                        <Picker.Item label="set" value={1} />
                    </Picker>
                    <Picker
                        selectedValue={type}
                        onValueChange={(itemValue) => setType(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="heart_rate/temperature" value={0} />
                        <Picker.Item label="Blood_oxygen" value={1} />
                        <Picker.Item label="hrv/respiratory_rate" value={2} />
                    </Picker>
                    {/* 第二行：time1输入框 */}
                    <TextInput
                        placeholder="Please enter time1 (10-120)s"
                        keyboardType="numeric"
                        value={time1}
                        onChangeText={(text) => setTime1(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Please enter time1 interval (0-65535)s"
                        keyboardType="numeric"
                        value={time1Interval}
                        onChangeText={(text) => setTime1Interval(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Please enter time2 (10-120)s"
                        keyboardType="numeric"
                        value={time2}
                        onChangeText={(text) => setTime2(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Please enter time2 interval (0-65535)s"
                        keyboardType="numeric"
                        value={time2Interval}
                        onChangeText={(text) => setTime2Interval(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="step/temperature/activityIntensity interval (0-255)minute"
                        keyboardType="numeric"
                        value={time3Interval}
                        onChangeText={(text) => setTime3Interval(text)}
                        style={styles.input}
                    />
                    {/* <TextInput
                        placeholder="Please enter "
                        keyboardType="numeric"
                        value={threshold}
                        onChangeText={(text) => setThreshold(text)}
                        style={styles.input}
                    /> */}
                    <Text>
                        Automatic exercise mode switch, effective in heart rate/body temperature mode
                    </Text>
                    <Picker
                        selectedValue={threshold}
                        onValueChange={(itemValue) => setThreshold(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                    {/* 最后一行：确定和取消按钮 */}
                    <View style={styles.buttonContainer}>
                        <View style={{ width: 80 }}>
                            <Button title="OK" onPress={handleConfirm} color="#ff5c5c" />
                        </View>
                        <View style={{ width: 80 }}>
                            <Button title="Cancel" onPress={handleCancel} color="#ff5c5c" />
                        </View>

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
        width: 250,
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
        width: 250,
    },
});

export default MeasureTimingDialog;