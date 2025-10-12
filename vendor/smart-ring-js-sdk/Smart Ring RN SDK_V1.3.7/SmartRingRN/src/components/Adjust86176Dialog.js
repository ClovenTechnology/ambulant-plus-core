import React, { useState } from 'react';
import { Modal, Button, TextInput, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-community/picker';
// 自定义对话框组件
const Adjust86176Dialog = ({ visible, onClose, onConfirm }) => {
    const [fuc, setFuc] = useState(1);
    const [current, setCurrent] = useState("");
    const [threshold, setThreshold] = useState("");

    const handleConfirm = () => {
        onConfirm(fuc, current, threshold);
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
                        selectedValue={fuc}
                        onValueChange={(itemValue) => setFuc(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="start calibration" value={1} />
                        <Picker.Item label="stop calibration" value={2} />
                        <Picker.Item label="read calibration" value={3} />
                        <Picker.Item label="write calibration" value={4} />
                    </Picker>
                    
                    {fuc === 4 && (
                        <>
                            <TextInput
                                placeholder="Please enter current (0-255)"
                                keyboardType="numeric"
                                value={current}
                                onChangeText={setCurrent}
                                style={styles.input}
                            />
                            <TextInput
                                placeholder="Please enter threshold (0-255)"
                                keyboardType="numeric"
                                value={threshold}
                                onChangeText={setThreshold}
                                style={styles.input}
                            />
                        </>
                    )
                   }
                    
                    <View style={styles.buttonContainer}>
                        <Button title="Confirm" onPress={handleConfirm} color="#ff5c5c" />
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowOffset: {
            width: 0,
            threshold: 2,
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
        width: 200,
    },
});

export default Adjust86176Dialog;
