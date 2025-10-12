import React, { useEffect, useRef } from "react";
import {
    Text, View, StyleSheet, Switch, ScrollView, TextInput, Platform, Button, LogBox,
} from "react-native";
import SDK from '../lib/ringSDK';
// import { formatDateTime, formatToHm } from '../utils/TimeFormat';
// import { bleModule } from '../module/BleModule'
import { Picker } from '@react-native-community/picker';
import { Svg, Path } from 'react-native-svg';
import EcgWave from '../components/ecgWave';
import EcgWave1 from '../components/ecgWave1';
import EcgAndPpgWave from '../components/ecgAndPpgWave';
import EasyToast from 'react-native-easy-toast';
import TempLineChart from '../components/TempLineChart';
import StressLineChart from '../components/StressLineChart';
import MotionBarChart from '../components/MotionBarChart';
import { HealthViewModel } from '../viewModel/HealthViewModel';
import { sleepViewModel } from '../viewModel/sleepViewModel';
import { mainViewModel } from "../viewModel/mainViewModel";
import DateTimePicker from '@react-native-community/datetimepicker';
import UserInfoDialog from '../components/UserInfoDialog';
import Adjust86176Dialog from '../components/Adjust86176Dialog';
import TestModeDialog  from '../components/TestModeDialog';
import RegisterDeviceDialog from '../components/RegisterDeviceDialog';
import MeasureTimingDialog from '../components/MeasureTimingDialog';
import NewHistoryDialog from '../components/NewHistoryDialog';
import ExerciseDialog from '../components/ExerciseDialog';
import OldHistoryDialog from '../components/OldHistoryDialog';
import SportModeDialog from '../components/SportModeDialog';
import UserBpDialog from '../components/UserBpDialog';
import FileUtils from '../utils/FileUtils';


const Main = ({ navigation, route }) => {
    LogBox.ignoreLogs(['new NativeEventEmitter']); // Ignore log notification by message
    LogBox.ignoreAllLogs();
    const healthViewModel = HealthViewModel();
    const { device1Value, battery, currentEcgMode, ecgResult, device2Value,
        device5Value, getHistoryStart, progress, history, temperatureValue,
        updateEcg, ecgWave, healthData, heartData, rePackage, oemResult, step,
        deviceBindStatus, shutDownStatus, loadingStatus,
        restartStatus, currentCmd, startOem, toastRef, userInfo,
        restoreFactorySettingsStatus, activeData,activeData2, newAlgorithmHistory,
        cleanHistoricalDataStatus, reportExercise, swing,
        timeSyncStatus, isOemEnabled, cleanHistoricalNewDataStatus,
        stepThresholdResult,
        deviceUnBindStatus,
        modalVisible,
        measureTimingModalVisible,
        measurementTiming,
        exerciseModalVisible,
        isEnabled,
        oxMeasurementTimeInterval,
        oxMeasurementSwitch,
        heartRateTime,
        stepThreshold,
        calorie,
        isDateShow,
        currentDate,
        historyModalVisible,
        oldHistoryModalVisible,
        mArray,
        mHrArray,
        historyDatas,
        newAlgorithmHistoryData,
        sportModeModalVisible,
        ppgMeasureMode,
        ppgMeasure,
        rdModelVisible,
        ppgSwitch,
        uploadResult,
        ppgMeasureResult,
        handleBloodGlucoseData,
        handleUploadPpgRecord,
        togglePpgSwitch,
        handleRegisterDeviceOpenDialog,
        handleRegisterDeviceCloseDialog,
        handleRegisterDeviceConfirm,
        setPpgMeasureMode,
        requestSpeEcg,
        requestEcgArrhythmiaEcg,
        requestMtu,
        handSportModeCloseDialog,
        handSportModeOpenDialog,
        handleSportModeConfirm,
        getOldHistoryData,
        handleOpenOldHistoryDialog,
        handleOldHistoryCloseDialog,
        handleHistoryOpenDialog,
        handleHistoryCloseDialog,
        showCalendar,
        dateChange,
        handleHeartRateTimeChange,
        handleOxMeasurementSwitchChange,
        handleOxMeasurementTimeIntervalChange,
        handleStepThresholdChange,
        adjust86176modalVisible,
        handle86176OpenDialog,
        handle86176CloseDialog,
        handleRegister86176Confirm,
        adjust86176Value,
        setOxMeasurementSettings,
        showEcgPrint,
        startRawEcg,
        stopRawEcg,
        startRawEcgWithBSECURAlgorithm,
        stopRawEcgWithBSECURAlgorithm,
        startEcgAlgorithm,
        stopEcgAlgorithm,
        toggleSwitch,
        handleTestModeOpenDialog,
        testModeModalVisible,
        handleTestModeCloseDialog,
        handleTestModeConfirm,
        toggleOemSwitch,
        handExerciseOpenDialog,
        handExerciseCloseDialog,
        handleExerciseConfirm,
        handleUserInfoOpenDialog, handMeasureTimingOpenDialog,
        handMeasureTimingCloseDialog,
        handleMeasurementTimingConfirm,
        handleUserInfoCloseDialog,
        handleUserInfoConfirm
        , sendData, registerListener, unRegisterListener, initWave, getPath, stopDraw,
        getIrPath, getRedPath } = mainViewModel();
    const { restingHeartRate, respiratoryRate, heartRateImmersion, getNewAlgorithmSleepData, showNewSleepTime, showSleepTime, getSleepData, calcRestingHeartRate, calcRespiratoryRate, getOxygenSaturation, showOxygenSaturation, getHeartRateImmersion } = sleepViewModel();

    const { bleName } = route.params;

    useEffect(() => {
        if (Platform.OS === 'android'){
            requestMtu();
        }
        
        // healthViewModel.loadJsonToDB();
        //After connecting to Bluetooth, perform time synchronization to ensure the correct reporting time of historical data
        setTimeout(() => sendData(SDK.SendCmd.timeSyn), 1000);
        //start OEM certification
        startOem.current = true
        sendData(SDK.SendCmd.deviceInfo1)
        //Obtain heart rate and blood oxygen
        registerListener(bleName);
        return () => {
            unRegisterListener()
        }
    }, []);
    
    return (
        <>
            <EasyToast ref={toastRef} position="center" />
            <ScrollView horizontal={true}>
                <ScrollView>
                    <View >
                    <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handleTestModeOpenDialog} style={styles.button} title="test mode"></Button>
                            </View>
                            <Text style={styles.textStyle}> </Text>
                        </View>
                        <TestModeDialog
                            visible={testModeModalVisible}
                            onClose={handleTestModeCloseDialog}
                            onConfirm={handleTestModeConfirm}
                        />
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handle86176OpenDialog} style={styles.button} title="adjust 86176"></Button>
                            </View>
                            <Text style={styles.textStyle}>state:{adjust86176Value.state} current:{adjust86176Value.current} threshold:{adjust86176Value.threshold} </Text>
                        </View>
                        <Adjust86176Dialog
                            visible={adjust86176modalVisible}
                            onClose={handle86176CloseDialog}
                            onConfirm={handleRegister86176Confirm}
                        />
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handleRegisterDeviceOpenDialog} style={styles.button} title="register the device(BG 1)"></Button>
                            </View>
                            <Text style={styles.textStyle}></Text>
                        </View>
                        <RegisterDeviceDialog
                            visible={rdModelVisible}
                            onClose={handleRegisterDeviceCloseDialog}
                            onConfirm={handleRegisterDeviceConfirm}
                        />
                        <View style={styles.viewHorizontal}>
                            <View style={[styles.button, { backgroundColor: "#81b0ff", height: 30 }]} >
                                <Text style={styles.textStyle}>PPG switch(BG 2)</Text>
                            </View>
                            <Switch
                                trackColor={{ false: "#767577", true: "#81b0ff" }}
                                thumbColor={ppgSwitch ? "#81b0ff" : "#f4f3f4"}
                                onValueChange={togglePpgSwitch}
                                value={ppgSwitch}
                            />
                        </View>
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handleUploadPpgRecord} style={styles.button} title="PPG Upload server(BG 3)"></Button>
                            </View>
                            <Text style={styles.textStyle}>{uploadResult}</Text>
                        </View>
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handleBloodGlucoseData} style={styles.button} title="BloodGlucose(BG 4)"></Button>
                            </View>
                            <Text style={styles.textStyle}>{ppgMeasureResult}</Text>
                        </View>
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handleUserInfoOpenDialog} style={styles.button} title="Set User Info"></Button>
                            </View>
                            <Text style={styles.textStyle}>sex:{userInfo.sex == 1 ? "female" : "male"} age:{userInfo.age} height:{userInfo.height}mm weight:{userInfo.weight}kg </Text>
                        </View>
                        <UserInfoDialog
                            visible={modalVisible}
                            onClose={handleUserInfoCloseDialog}
                            onConfirm={handleUserInfoConfirm}
                        />
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={() => sendData(SDK.SendCmd.ACTIVE_DATA)} style={styles.button} title="Active Data"></Button>
                            </View>
                            <Text style={styles.textStyle}>{JSON.stringify(activeData, null, 2)} </Text>
                        </View>
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={() => sendData(SDK.SendCmd.ACTIVE_DATA_2)} style={styles.button} title="Active Data 2"></Button>
                            </View>
                            <Text style={styles.textStyle}>{JSON.stringify(activeData2, null, 2)} </Text>
                        </View>
                      

                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handMeasureTimingOpenDialog} style={styles.button} title="set measurement timing"></Button>
                            </View>
                            <Text style={styles.textStyle}>{JSON.stringify(measurementTiming, null, 2)} </Text>
                        </View>
                        <MeasureTimingDialog
                            visible={measureTimingModalVisible}
                            onClose={handMeasureTimingCloseDialog}
                            onConfirm={handleMeasurementTimingConfirm}
                        />
                        <View style={styles.viewHorizontal}>
                            <View style={[styles.button, { backgroundColor: "#81b0ff", height: 30 }]} >
                                <Text style={styles.textStyle}>oem switch is:  {isOemEnabled ? 'ON' : 'OFF'}</Text>
                            </View>
                            <Switch
                                trackColor={{ false: "#767577", true: "#81b0ff" }}
                                thumbColor={isOemEnabled ? "#81b0ff" : "#f4f3f4"}
                                onValueChange={toggleOemSwitch}
                                value={isOemEnabled}
                            />
                        </View>
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={handExerciseOpenDialog} style={styles.button} title="set exercise"></Button>
                            </View>
                            <Text style={styles.textStyle}>{ } </Text>
                        </View>
                        <ExerciseDialog
                            visible={exerciseModalVisible}
                            onClose={handExerciseCloseDialog}
                            onConfirm={handleExerciseConfirm}
                        />
                        <View style={styles.viewHorizontal}>
                            <View style={[styles.button, { backgroundColor: "#81b0ff" }]} >
                                <Text style={styles.textStyle}>reporting exercise is: {isEnabled ? 'ON' : 'OFF'}</Text>
                            </View>
                            <Switch
                                trackColor={{ false: "#767577", true: "#81b0ff" }}
                                thumbColor={isEnabled ? "#81b0ff" : "#f4f3f4"}
                                onValueChange={toggleSwitch}
                                value={isEnabled}
                            />
                            <Text style={styles.textStyle}>{reportExercise}</Text>
                        </View>
                        <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={() => {
                                    sendData(SDK.SendCmd.CLEAN_HISTORY_NEW);
                                }} style={styles.button} title="clean new history"></Button>
                            </View>
                            <Text style={styles.textStyle}>{cleanHistoricalNewDataStatus}</Text>
                        </View>
                    </View>

                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={handSportModeOpenDialog} style={styles.button} title="Set SportMode"></Button>
                        </View>
                    </View>
                    <SportModeDialog
                        visible={sportModeModalVisible}
                        onClose={handSportModeCloseDialog}
                        onConfirm={handleSportModeConfirm}
                    />
                    <View style={[styles.viewHorizontal, { display: calorie ? '' : 'none' }]}>
                        <Text style={styles.textStyle}>Calories burned: {calorie} Cal</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.setHrTime, heartRateTime < 10 ? 10 : heartRateTime > 60 ? 60 : heartRateTime)} style={styles.button} title="Set Hr measure time"></Button>
                        </View>
                        <TextInput
                            placeholder="Please enter a number between 10 and 60"
                            keyboardType="numeric"
                            style={styles.input}
                            value={heartRateTime}
                            onChangeText={handleHeartRateTimeChange}
                        />
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => setOxMeasurementSettings()} style={styles.button} title="Set Ox measure"></Button>
                        </View>
                        <TextInput
                            placeholder="Please enter a number 1(open) or 0(close)"
                            keyboardType="numeric"
                            style={styles.input}
                            value={oxMeasurementSwitch}
                            onChangeText={handleOxMeasurementSwitchChange}
                        />
                        <TextInput
                            placeholder="Please enter a number between 5 and 360 minute"
                            keyboardType="numeric"
                            style={styles.input}
                            value={oxMeasurementTimeInterval}
                            onChangeText={handleOxMeasurementTimeIntervalChange}
                        />
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                sendData(SDK.SendCmd.stepThreshold, { threshold: stepThreshold })
                            }} style={styles.button} title="Step Threshold"></Button>
                        </View>
                        <TextInput
                            placeholder="Please enter a number between 0 and 63"
                            keyboardType="numeric"
                            style={styles.input}
                            value={stepThreshold}
                            onChangeText={handleStepThresholdChange}
                        />
                        <Text style={styles.textStyle}>{stepThresholdResult}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() =>
                                sendData(SDK.SendCmd.setHealthPara, {
                                    samplingRate: device2Value.samplingRate, switch: 1
                                })}
                                style={styles.button} title="Turn on waveform"></Button>
                        </View>
                        <Text style={styles.textStyle}> </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.setHealthPara, {
                                samplingRate: device2Value.samplingRate,
                                switch: 0
                            })} style={styles.button} title="Turn off waveform"></Button>
                        </View>
                        <Text style={styles.textStyle}> </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                sendData(SDK.SendCmd.step);
                            }} style={styles.button} title="Step"></Button>
                        </View>
                        <Text style={styles.textStyle}> step：{step} </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                sendData(SDK.SendCmd.openSingleHealth);
                                initWave();
                                setPpgMeasureMode(false);
                            }} style={styles.button} title="Turn on hr"></Button>
                        </View>
                        {ppgMeasureMode ? <Text>{ppgMeasure}</Text> : <Text style={styles.textStyle}> heart rate：{heartData.heartValue} hrv:{heartData.hrvValue}</Text>}
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                sendData(SDK.SendCmd.closeSingleHealth)
                                stopDraw();
                            }} style={styles.button} title="Turn off hr"></Button>
                        </View>
                        <Text style={styles.textStyle}></Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                sendData(SDK.SendCmd.openHealth)
                                setPpgMeasureMode(false);
                                initWave();
                            }} style={styles.button} title="Turn on hr&ox"></Button>
                        </View>
                        {ppgMeasureMode ? <Text>{ppgMeasure}</Text> : <Text style={styles.textStyle}>Blood oxygen：{healthData.oxValue} heart rate：{healthData.heartValue} </Text>
                        }
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                sendData(SDK.SendCmd.closeHealth)
                                stopDraw();
                            }} style={styles.button} title="Turn off hr&ox"></Button>
                        </View>
                        <Text style={styles.textStyle}></Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.shutDown)} style={styles.button} title="Shutdown"></Button>
                        </View>
                        <Text style={styles.textStyle}>{shutDownStatus}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.restart)} style={styles.button} title="Restart"></Button>
                        </View>
                        <Text style={styles.textStyle}>{restartStatus}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.restoreFactorySettings)} style={styles.button} title="Factory reset"></Button>
                        </View>
                        <Text style={styles.textStyle}>{restoreFactorySettingsStatus}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.cleanHistoricalData)} style={styles.button} title="clear history"></Button>
                        </View>
                        <Text style={styles.textStyle}>{cleanHistoricalDataStatus}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={
                                () => {
                                    currentCmd.current = SDK.SendCmd.deviceBind
                                    sendData(SDK.SendCmd.deviceBind)
                                }
                            } style={styles.button} title="Device binding"></Button>
                        </View>
                        <Text style={styles.textStyle}>{deviceBindStatus}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                currentCmd.current = SDK.SendCmd.deviceUnBind
                                sendData(SDK.SendCmd.deviceUnBind)
                            }} style={styles.button} title="Device unbinding"></Button>
                        </View>
                        <Text style={styles.textStyle}>{deviceUnBindStatus}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                startOem.current = true
                                sendData(SDK.SendCmd.deviceInfo1)
                            }} style={styles.button} title="Start OEM verify"></Button>
                        </View>
                        <Text style={styles.textStyle}>{oemResult}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.timeSyn)} style={styles.button} title="Time sync"></Button>
                        </View>
                        <Text style={styles.textStyle}>{timeSyncStatus}</Text>
                    </View>

                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.temperature)} style={styles.button} title="Temperature data"></Button>
                        </View>
                        <Text style={styles.textStyle}>Finger temperature:{temperatureValue}°C</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.deviceInfo1)} style={styles.button} title="Device Info 1 Data"></Button>
                        </View>
                        <Text style={styles.textStyle}>color：{device1Value.color} size:{device1Value.size}  bleAddress:{device1Value.bleAddress} deviceVer:{device1Value.deviceVer}
                            switchOem:{device1Value.switchOem} chargingMode:{device1Value.chargingMode}  mainChipModel:{device1Value.mainChipModel}  hasSportsMode:{device1Value.hasSportsMode}
                            productIteration:{device1Value.productIteration} isSupportEcg:{device1Value.isSupportEcg} deviceType:{device1Value.deviceType}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.deviceInfo2)} style={styles.button} title="Device Info 2 Data"></Button>
                        </View>
                        <Text style={styles.textStyle}>sn:{device2Value.sn}  bindStatus:{device2Value.bindStatus}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.deviceInfo5)} style={styles.button} title="Device Info 5 Data"></Button>
                        </View>
                        <Text style={styles.textStyle}>hrMeasurementTime:{device5Value.hrMeasurementTime}  oxMeasurementInterval:{device5Value.oxMeasurementInterval}  oxMeasurementSwitch:{device5Value.oxMeasurementSwitch}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => sendData(SDK.SendCmd.batteryDataAndState)} style={styles.button} title="Battery Info"></Button>
                        </View>
                        <Text style={styles.textStyle}>batteryValue：{battery.batteryValue}mV status:{battery.status} batteryPer:{battery.batteryPer} {battery.isSleep} {battery.isWear}</Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                getOldHistoryData();
                            }} style={styles.button} title="History Data"></Button>
                        </View>
                        {getHistoryStart ?
                            <Text>{progress}</Text> :
                            <Button onPress={
                                handleOpenOldHistoryDialog} title="show old history"></Button>
                        }
                    </View>
                    <OldHistoryDialog
                        visible={oldHistoryModalVisible}
                        onClose={handleOldHistoryCloseDialog}
                        data={history}
                    ></OldHistoryDialog>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                getSleepData(mArray, historyDatas);
                            }} style={styles.button} title="old Algorithm Sleep data"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {showSleepTime()}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                            <View style={styles.button}>
                                <Button onPress={() => {
                                    sendData(SDK.SendCmd.NEW_ALGORITHM_HISTORY_NUM);
                                    setTimeout(() => {
                                        sendData(SDK.SendCmd.NEW_ALGORITHM_HISTORY);
                                    }, 1000)
                                }} style={styles.button} title="new algorithm history"></Button>
                            </View>
                            <Text style={styles.textStyle}> {loadingStatus}</Text>
                            {loadingStatus === 'done' && (
                                <Button onPress={handleHistoryOpenDialog} style={styles.button} title=" show history" />
                            )}
                        </View>
                        <NewHistoryDialog
                            visible={historyModalVisible}
                            onClose={handleHistoryCloseDialog}
                            data={newAlgorithmHistory}
                            title={"New Algorithm History"}
                        />
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                getNewAlgorithmSleepData(mArray, newAlgorithmHistoryData);
                            }} style={styles.button} title="new Algorithm Sleep data"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {showNewSleepTime()}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                calcRestingHeartRate(mHrArray);
                            }} title="Resting heart rate"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {restingHeartRate}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                calcRespiratoryRate(mArray);
                            }} title="Respiratory rate"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {respiratoryRate}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                getOxygenSaturation(mArray);
                            }} title="Ox saturation"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {showOxygenSaturation()}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                getHeartRateImmersion(mArray, mHrArray);
                            }} title="Hr immersion"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {heartRateImmersion}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                showCalendar(true);
                            }} title="show calendar"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            Set the time for obtaining temperature fluctuations and pressure data
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                healthViewModel.handleTempChartClose();
                                healthViewModel.setTemperatureShowTitle('Obtaining...')
                                setTimeout(() => {
                                    healthViewModel.getTemperature(currentDate);
                                }, 0);
                            }} title={healthViewModel.tempTitle}></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            ftcW:{healthViewModel.ftcW} ftcBase:{healthViewModel.ftcBase}
                        </Text>
                    </View>
                    {healthViewModel.showTempChart && <TempLineChart arr={healthViewModel.tempArr}></TempLineChart>}
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                healthViewModel.handleStressChartClose();
                                healthViewModel.setStressShowTitle('Obtaining...')
                                setTimeout(() => {
                                    healthViewModel.getStress(currentDate);
                                }, 0);
                            }} title={healthViewModel.stressTitle}></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {healthViewModel.stressDays}  recoveryTime:{healthViewModel.recoveryTime} stressTime:{healthViewModel.stressTime}
                        </Text>
                    </View>
                    {healthViewModel.showStressChart && <StressLineChart arr={healthViewModel.pressureArray} baseLine={healthViewModel.pressureBaseLine}></StressLineChart>}
                    {healthViewModel.showStressChart && <MotionBarChart arr={healthViewModel.motionArray}></MotionBarChart>}
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                startRawEcg();

                            }} title="start Raw ECG"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {showEcgPrint()}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                stopRawEcg();

                            }} title="stop Raw ECG"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                requestEcgArrhythmiaEcg();
                            }} title="Arrhythmia electrocardiogram from web"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                requestSpeEcg();
                            }} title="spe electrocardiogram from web"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                        </Text>
                    </View>

                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                startRawEcgWithBSECURAlgorithm();
                            }} title="start Raw witch BSECUR ECG"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {currentEcgMode.current === SDK.DISP_SRC.RAW_DATA_WITH_BSECUR_ALGORITHM && ecgResult}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                stopRawEcgWithBSECURAlgorithm();
                            }} title="stop Raw witch BSECUR ECG"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                startEcgAlgorithm();
                            }} title="start Algorithm ECG"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                            {currentEcgMode.current === SDK.DISP_SRC.ALGORITHM_LIBRARY_DATA && ecgResult}
                        </Text>
                    </View>
                    <View style={styles.viewHorizontal}>
                        <View style={styles.button}>
                            <Button onPress={() => {
                                // saveEcgDataToFile();
                                stopEcgAlgorithm();
                            }} title="stop Algorithm ECG"></Button>
                        </View>
                        <Text style={styles.textStyle}>
                        </Text>
                    </View>
                    <EcgWave data={ecgWave} swing={swing} update={updateEcg} />
                    

                    <View style={{ flexDirection: 'row', marginTop: 20 }}>
                        <Text style={{ width: 200, textAlign: 'center', textAlignVertical: 'center', fontSize: 15 }}>Packet response information</Text>
                        <Text style={styles.textStyle}>send cmd:{rePackage.cmd} result:{rePackage.result} reason:{rePackage.reason}  </Text>
                    </View>
                    <View style={styles.chart_container}>
                        <Svg width="500" height="200">
                            <Path d={getPath()} fill="none" stroke="blue" strokeWidth="2" />
                        </Svg>
                    </View>
                    <View style={styles.chart_container}>
                        <Svg width="500" height="200">
                            <Path d={getIrPath()} fill="none" stroke="green" strokeWidth="2" />
                        </Svg>
                    </View>
                    <View style={styles.chart_container}>
                        <Svg width="500" height="200">
                            <Path d={getRedPath()} fill="none" stroke="red" strokeWidth="2" />
                        </Svg>
                    </View>

                </ScrollView>
            </ScrollView>
            {isDateShow && <DateTimePicker value={currentDate} onChange={dateChange} />}
        </>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    button: {
        width: 150,
    },
    viewHorizontal: {
        flexDirection: 'row',
        alignItems: 'flex-end'
    },
    textStyle: {
        paddingLeft: 10
    },
    input: {
        height: 40,

        borderColor: 'blue',
        borderWidth: 0,
        borderBottomWidth: 1,
        paddingHorizontal: 10,
        marginRight: 10
    },
    pickStyle: {
        width: 270,
    },
    chart_container: {
        flex: 1,
        // alignItems: 'center',
        // justifyContent:'flex-start',
    },

})

export default Main;