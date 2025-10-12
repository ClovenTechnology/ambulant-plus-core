import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-community/picker';

// 自定义对话框组件
const RegisterDeviceDialog = ({ visible, onClose, onConfirm }) => {
    const [sex, setSex] = useState("M");
    const [age, setAge] = useState("");

    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [familyDiabetes, setFamilyDiabetes] = useState(0);
    const [highCholesterol, setHighCholesterol] = useState(0);

    const handleConfirm = () => {
        // 调用父组件传入的回调函数，传递选项和年龄值
        onConfirm( sex,parseInt(age),parseInt(height),parseInt(weight), familyDiabetes, highCholesterol);
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
                        selectedValue={familyDiabetes}
                        onValueChange={(itemValue) => setFamilyDiabetes(itemValue)}
                        style={styles.picker}
                        prompt="family diabetes"
                    >
                        <Picker.Item label="no" value={0} />
                        <Picker.Item label="yes" value={1} />
                    </Picker>
                    <Picker
                        selectedValue={highCholesterol}
                        onValueChange={(itemValue) => setHighCholesterol(itemValue)}
                        style={styles.picker}
                        prompt="high cholesterol"
                    >
                        <Picker.Item label="no" value={0} />
                        <Picker.Item label="yes" value={1} />
                    </Picker>
                    <Picker
                        selectedValue={sex}
                        onValueChange={(itemValue) => setSex(itemValue)}
                        style={styles.picker}
                        prompt="sex"
                    >
                        <Picker.Item label="male" value={"M"} />
                        <Picker.Item label="female" value={"F"} />
                    </Picker>
                    {/* 第二行：年龄输入框 */}
                    <TextInput
                        placeholder="Please enter age"
                        keyboardType="numeric"
                        value={age}
                        onChangeText={(text) => setAge(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Please enter height (mm)"
                        keyboardType="numeric"
                        value={height}
                        onChangeText={(text) => setHeight(text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Please enter your weight (kg)"
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={(text) => setWeight(text)}
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
        width: 120,
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

export default RegisterDeviceDialog;