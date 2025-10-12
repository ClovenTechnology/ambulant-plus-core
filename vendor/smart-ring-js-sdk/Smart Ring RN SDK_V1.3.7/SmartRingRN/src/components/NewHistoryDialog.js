import React, { useState, useEffect } from 'react';
import { Modal, Button, ScrollView, StyleSheet, View, Text } from 'react-native';
import { Picker } from '@react-native-community/picker';
// 自定义对话框组件
const NewHistoryDialog = ({ visible, onClose, data, title }) => {

    const [type, setType] = useState(0);
    const [loadData, setLoadData] = useState(true);

    useEffect(() => {
        if (visible) {
            setTimeout(() => {
                setLoadData(false)
            }, 0);
        } else {
            setLoadData(true)
        }

    }, [visible]);
    const handleConfirm = () => {
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleConfirm}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={{ fontSize: 20, marginBottom: 15 }}>{title}</Text>
                    <Picker
                        selectedValue={type}
                        onValueChange={(itemValue) => setType(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="newHistory" value={0} />
                        <Picker.Item label="temperature" value={1} />
                        <Picker.Item label="excludedSwimmingActivity" value={2} />
                        <Picker.Item label="dailyActivity" value={3} />
                        <Picker.Item label="exerciseActivity" value={4} />
                        <Picker.Item label="exerciseVitalSigns" value={5} />
                        <Picker.Item label="swimmingExercise" value={6} />
                        <Picker.Item label="singleLapSwimming" value={7} />
                        <Picker.Item label="sleep" value={8} />
                        <Picker.Item label="step/temperature/activityIntensity" value={9} />
                        <Picker.Item label="dailyActivitySummary2" value={10} />
                        <Picker.Item label="resultHistoryDataError" value={11} />
                    </Picker>
                    {/* 第一行：选择控件 */}
                    {
                        loadData ? <Text>Loading...wait a moment please</Text> : <ScrollView>
                            <Text>{data.length > 0 ? data[type] : 'No data'}</Text>
                        </ScrollView>
                    }


                    {/* 最后一行：确定和取消按钮 */}
                    <View style={styles.buttonContainer}>
                        <Button title="close" onPress={handleConfirm} color="#ff5c5c" />
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
    buttonContainer: {
        marginTop: 20,
        justifyContent: 'center',
        width: 200,
    },
});

export default NewHistoryDialog;