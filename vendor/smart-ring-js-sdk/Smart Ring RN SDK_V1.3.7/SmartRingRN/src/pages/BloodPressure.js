import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { BpViewModel } from '../viewModel/bpViewModel';
import { useFocusEffect } from '@react-navigation/native';
import EasyToast from 'react-native-easy-toast';

const BloodPressure = ({ navigation }) => {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const token = useSelector((state) => state.auth.token);
  const {
    stop,
    startBp,
    bpInit,
    bpUnInit,
    requiredCalibrationTimes,
    updateToServer,
    handleUserBpCloseDialog,
    handleUserBpConfirm,
    addCalibrationBP,
    measureState,
    isMeasuring,
    bpToastRef,
    isShowAddCalibrationBP,
    bpiResult,
    isMeasure,
    userBpModalVisible,
    pttCount,
    calibrationTime,
  } = BpViewModel();

  useEffect(() => {
    console.log(` token=${token} `)
    bpInit();

    return () => {
      bpUnInit();
    }

  }, [])

  useFocusEffect(
    React.useCallback(() => {
      const onBeforeRemove = (e) => {
        // 防止默认行为
        e.preventDefault();

        // 执行数据保存逻辑
        saveData().then(() => {
          // 数据保存成功后，手动完成导航
          navigation.dispatch(e.data.action);
        }).catch((error) => {
          console.error("数据保存失败", error);
        });
      };

      // 添加事件监听器
      navigation.addListener('beforeRemove', onBeforeRemove);

      // 清理函数
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation])
  );

  const saveData = async () => {
    try {
      await updateToServer();
    } catch (error) {
      throw error;
    }
  };




  const saveMeasurement = () => {
    // 保存测量结果
    console.log('保存血压测量结果:', { systolic, diastolic });
    handleUserBpConfirm(systolic, diastolic);
    handleUserBpCloseDialog();
    setSystolic("");
    setDiastolic("");
  };

  return (
    <View style={styles.container}>
      <EasyToast ref={bpToastRef} position="center" />

      <ScrollView style={styles.dataContainer}>
        <Text>
          pwttCount:{pttCount} Calibrated times:{calibrationTime} result:{bpiResult}
        </Text>
      </ScrollView>

      {isMeasuring.current && (
        <View style={styles.animationContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.animationText}>Measuring in progress...</Text>
        </View>
      )}
      <View style={styles.buttonContainer}>
        <Button
          title={measureState}
          onPress={isMeasuring.current ? stop : startBp}
        />
      </View>

      {isShowAddCalibrationBP &&
        <View style={styles.viewHorizontal}>
          <View style={styles.button}>
            <Button onPress={() => {
              addCalibrationBP();
            }} title="Add calibrated blood pressure"></Button>
          </View>
          <Text style={styles.textStyle}>
            { }
          </Text>
        </View>
      }

      <Modal
        visible={userBpModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter blood pressure value</Text>

            <TextInput
              placeholder="systolic pressure (mmHg)"
              value={systolic}
              onChangeText={setSystolic}
              keyboardType="numeric"
              style={styles.input}
            />

            <TextInput
              placeholder="diastolic pressure (mmHg)"
              value={diastolic}
              onChangeText={setDiastolic}
              keyboardType="numeric"
              style={styles.input}
            />

            <View style={styles.buttonRow}>
              <View style={{ width: 100 }}>
                <Button title="Save" onPress={saveMeasurement} />
              </View>
              <View style={{ width: 100 }}>
                <Button title="Cancel" onPress={handleUserBpCloseDialog} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  dataContainer: {
    maxHeight: '60%',
    marginVertical: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  animationContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  animationText: {
    marginTop: 8,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});

export default BloodPressure;
