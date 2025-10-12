import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View,Text } from 'react-native';
import { Picker } from '@react-native-community/picker';
// 自定义对话框组件
const ExerciseDialog = ({ visible, onClose, onConfirm }) => {
    const [fuc, setFuc] = useState(0);
    const [type, setType] = useState(0);
    const [trainingTime, setTrainingTime] = useState("1");
    const [poolSize, setPoolSize] = useState(0);


    const handleConfirm = () => {
        // 调用父组件传入的回调函数，传递选项和年龄值
        onConfirm(fuc,type,poolSize,parseInt(trainingTime));
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
                        <Picker.Item label="off" value={0} />
                        <Picker.Item label="on" value={1} />
                        <Picker.Item label="pause" value={2} />
                        <Picker.Item label="continue" value={3} />
                    </Picker>
                    <Picker
                        selectedValue={type}
                        onValueChange={(itemValue) => setType(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="other" value={0} />
                        <Picker.Item label="run" value={1} />
                        <Picker.Item label="walk" value={2} />
                        <Picker.Item label="SwimmingPoolSwimming" value={3} />
                        <Picker.Item label="OpenWaterSwimming" value={4} />
                        <Picker.Item label="IndoorCycling" value={5} />
                        <Picker.Item label="OutdoorCycling" value={6} />
                        <Picker.Item label="yoga" value={7} />
                        <Picker.Item label="mindful" value={8} />
  
                    </Picker>
                    <Text>Pool size setting</Text>
                    <Picker
                        selectedValue={poolSize}
                        onValueChange={(itemValue) => setPoolSize(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="unknown" value={0} />
                        <Picker.Item label="25m" value={1} />
                        <Picker.Item label="50m" value={2} />
                        <Picker.Item label="other" value={255} />
                    </Picker>
                    {/* 第二行：time1输入框 */}
                    <TextInput
                        placeholder="Please enter training time (1-65535)m"
                        keyboardType="numeric"
                        value={trainingTime}
                        onChangeText={(text) => setTrainingTime(text)}
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
        width: 200,
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

export default ExerciseDialog;