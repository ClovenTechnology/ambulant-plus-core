import React, { useState, useEffect } from 'react';
import { Modal, Button, ScrollView, StyleSheet, View, Text } from 'react-native';
// 自定义对话框组件
const OldHistoryDialog = ({ visible, onClose, data }) => {
    const [loadData, setLoadData] = useState(true);
    const handleConfirm = () => {
        onClose();
    };

    useEffect(() => {
        if(visible){
            setTimeout(() => {
                setLoadData(false)
            }, 0);
        }else{
            setLoadData(true)
        }
        
    }, [visible]);
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleConfirm}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={{ fontSize: 20, marginBottom: 15 }}>History Data</Text>

                    {/* 第一行：选择控件 */}
                    {
                        loadData ? <Text>Loading...wait a moment please</Text> : <ScrollView>
                        <Text>{data}</Text>
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
    buttonContainer: {
        marginTop: 20,
        justifyContent: 'center',
        width: 200,
    },
});

export default OldHistoryDialog;