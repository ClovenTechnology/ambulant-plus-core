import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View,Text } from 'react-native';
// import { Text } from 'react-native-svg';
// 自定义对话框组件
const UserBpDialog = ({ visible, onClose, onConfirm }) => {
    const [sys, setSys] = useState("");
    const [dias, setDias] = useState("");

    const handleConfirm = () => {
        // 调用父组件传入的回调函数，传递选项和年龄值
        onConfirm(sys, dias);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible()}
            onRequestClose={handleCancel}
        >
            
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.title}>Please use a blood pressure monitor to measure your blood pressure data</Text>
                    <TextInput
                        placeholder="Please enter Systolic pressure (high pressure)(mmHg)"
                        keyboardType="numeric"
                        value={sys}
                        onChangeText={(text) => setSys(text)}
                        style={styles.input}
                        placeholderTextColor={'white'}
                    />
                    <TextInput
                        placeholder="Please enter Diastolic pressure (low pressure)(mmHg)"
                        keyboardType="numeric"
                        value={dias}
                        onChangeText={(text) => setDias(text)}
                        style={styles.input}
                        placeholderTextColor={'white'}
                    />
                    {/* 最后一行：确定和取消按钮 */}
                    <View style={styles.buttonContainer}>
                        <Button title="Ok " onPress={handleConfirm} color="#ff5c5c" />
                        <Button title="Cancel" onPress={handleCancel} color="#ff5c5c" />
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
    title:{
        fontSize: 20,
        marginBottom: 20,
        color: 'white',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'black',
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
        color: 'white',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: 150,
    },
});

export default UserBpDialog;