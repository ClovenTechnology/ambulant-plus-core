import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View, ScrollView,Text } from 'react-native';
import { Picker } from '@react-native-community/picker';

// 自定义对话框组件
const TestModeDialog = ({ visible, onClose, onConfirm }) => {

    const [testModeSwitch, setTestModeSwitch] = useState(0);
    const [ledTestModeSwitch, setLedTestModeSwitch] = useState(0);
    const [redLight, setLedLight] = useState(0);
    const [greenLight, setGreenLight] = useState(0);
    const [accSwitch, setAccSwitch] = useState(0);
    const [oxSwitch, setOxSwitch] = useState(0);
    const [pdLedSpo2, setPdLedSpo2] = useState(0);
    const [hrSwitch, setHrSwitch] = useState(0);
    const [pdLedHr, setPdLedHr] = useState(0);
    const handleConfirm = () => {
        // 调用父组件传入的回调函数，传递选项和年龄值
        onConfirm( testModeSwitch,ledTestModeSwitch,redLight,greenLight,accSwitch,oxSwitch,pdLedSpo2,hrSwitch,pdLedHr);
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
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Test Mode</Text>
                            <Picker
                        selectedValue={testModeSwitch}
                        onValueChange={(itemValue) => setTestModeSwitch(itemValue)}
                        style={styles.picker}
                        prompt="Test Mode"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>LED Test Mode</Text>
                            <Picker
                        selectedValue={ledTestModeSwitch}
                        onValueChange={(itemValue) => setLedTestModeSwitch(itemValue)}
                        style={styles.picker}
                        prompt="LED Test Mode"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Red Light</Text>
                            <Picker
                        selectedValue={redLight}
                        onValueChange={(itemValue) => setLedLight(itemValue)}
                        style={styles.picker}
                        prompt="Red Light"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Green Light</Text>
                            <Picker
                        selectedValue={greenLight}
                        onValueChange={(itemValue) => setGreenLight(itemValue)}
                        style={styles.picker}
                        prompt="Green Light"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>ACC Switch</Text>
                            <Picker
                        selectedValue={accSwitch}
                        onValueChange={(itemValue) => setAccSwitch(itemValue)}
                        style={styles.picker}
                        prompt="ACC Switch"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Blood Oxygen Switch</Text>
                            <Picker
                        selectedValue={oxSwitch}
                        onValueChange={(itemValue) => setOxSwitch(itemValue)}
                        style={styles.picker}
                        prompt="Blood Oxygen Switch"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>PD LED SPO2</Text>
                            <Picker
                        selectedValue={pdLedSpo2}
                        onValueChange={(itemValue) => setPdLedSpo2(itemValue)}
                        style={styles.picker}
                        prompt="PD LED SPO2"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>Heart Rate Switch</Text>
                            <Picker
                        selectedValue={hrSwitch}
                        onValueChange={(itemValue) => setHrSwitch(itemValue)}
                        style={styles.picker}
                        prompt="Heart Rate Switch"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>

                        <View style={styles.pickerRow}>
                            <Text style={styles.label}>PD LED HR</Text>
                            <Picker
                        selectedValue={pdLedHr}
                        onValueChange={(itemValue) => setPdLedHr(itemValue)}
                        style={styles.picker}
                        prompt="PD LED HR"
                    >
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                    </Picker>
                        </View>
                    </ScrollView>

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
        maxHeight: '80%',
        // shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    scrollContent: {
        alignItems: 'center',
        width: '100%',
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 15,
    },
    label: {
        flex: 1,
        textAlign: 'left',
        marginRight: 10,
        fontWeight: 'bold',
    },
    picker: {
        width: 120,
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
        marginTop: 15,
    },
});

export default TestModeDialog;