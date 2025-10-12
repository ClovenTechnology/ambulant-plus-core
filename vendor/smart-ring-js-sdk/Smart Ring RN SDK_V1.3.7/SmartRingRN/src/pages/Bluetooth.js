import React, { useEffect, useRef, useState,useMemo } from 'react';
import {
    Alert,
    FlatList,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    PermissionsAndroid,
    Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { bleModule } from '../module/BleModule';
import Characteristic from '../components/Characteristic';
import Header from '../components/Header';
import { BleEventType, BleState } from '../common/Type';
import SDK from '../lib/ringSDK';

var updateValueListener;

const BlueTooth = () => {

    // 蓝牙是否连接
    const [isConnected, setIsConnected] = useState(false);
    // 正在扫描中
    const [scaning, setScaning] = useState(false);
    // 蓝牙是否正在监听
    const [isMonitoring, setIsMonitoring] = useState(false);
    // 当前正在连接的蓝牙id
    const [connectingId, setConnectingId] = useState('');
    // 写数据
    const [writeData, setWriteData] = useState('');
    // 接收到的数据
    const [receiveData, setReceiveData] = useState('');
    // 读取的数据
    const [readData, setReadData] = useState('');
    // 输入的内容
    const [inputText, setInputText] = useState('');
    // 扫描的蓝牙列表
    const [data, setData] = useState([]);
    // 蓝牙连接状态
    const [status, setStatus] = useState('');
    const [showModeModal, setShowModeModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [filterText, setFilterText] = useState('');

 

    /** 蓝牙接收的数据缓存 */
    const bleReceiveData = useRef([]);
    /** 使用Map类型保存搜索到的蓝牙设备，确保列表不显示重复的设备 */
    const deviceMap = useRef(new Map());

    const isOTAModel = useRef(false);

    const navigation = useNavigation();

       /** 过滤后的设备列表 */
    const filteredDevices = useMemo(() => {
        const devices = [...deviceMap.current.values()];
        if (!filterText) return devices;
        // console.log(`filteredDevices 1= ${JSON.stringify(devices)}`);
        return devices.filter(device => 
            device.name && device.name.toLowerCase().startsWith(filterText.toLowerCase())
        );
    }, [data, filterText]);

    useEffect(() => {
        bleModule.start();
    }, []);

    useEffect(() => {

        bleModule.addListener(
            BleEventType.BleManagerDidUpdateState,
            handleUpdateState,
        );
        bleModule.addListener(
            BleEventType.BleManagerStopScan,
            handleStopScan,
        );
        bleModule.addListener(
            BleEventType.BleManagerDiscoverPeripheral,
            handleDiscoverPeripheral,
        );
        bleModule.addListener(
            BleEventType.BleManagerConnectPeripheral,
            handleConnectPeripheral,
        );
        bleModule.addListener(
            BleEventType.BleManagerDisconnectPeripheral,
            handleDisconnectPeripheral,
        );
        ApplyPermissions();
        return () => {
            bleModule.removeListener(BleEventType.BleManagerDidUpdateState);
            bleModule.removeListener(BleEventType.BleManagerStopScan);
            bleModule.removeListener(BleEventType.BleManagerDiscoverPeripheral);
            bleModule.removeListener(BleEventType.BleManagerConnectPeripheral);
            bleModule.removeListener(BleEventType.BleManagerDisconnectPeripheral);
            console.log(` ==============updateValueListener.remove()=============== `)
        };
    }, []);

    const showDialog = () => {
        Alert.alert(
            'Warning',
            'bluetooth is disconnected, please try again',
            [
                { text: 'Cancel', style: 'cancel' },
            ],
            {
                cancelable: false
            }
        );
    }

    async function ApplyPermissions() {
        // for android dynamic permission,begin start android M;
        if (Platform.OS === 'android' && Platform.Version >= 23 && Platform.Version <= 30) {
            const result = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            );
            if (result === true) {
                console.log('application has the location permission');
            } else {
                console.log('application do not has the location permission');
                // request the permission
                const grant = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission Request',
                        message:
                            'The Bluetooth module needs to access your location information, in order to make the application run smoothly, please give this permission',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'Ok',
                    },
                );
                if (grant === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('user grant the permission request');
                } else {
                    console.log('user refuse the permission request');
                }

                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                    {
                        title: 'File read and write permissions',
                        message: 'The application requires access to files in storage space.',
                        buttonPositive: 'Ok',
                        buttonNegative: 'Cancel',
                    },
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('user grant the permission request');
                } else {
                    console.log('user refuse the permission request');
                }
            }
        } else if (Platform.OS === 'android' && Platform.Version >= 31) {
            console.log('Platform.Version >= 31');
            const result = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            );
            if (result === true) {
                console.log('application has the bluetooth permission');
            } else {
                console.log('application do not has the bluetooth permission');
                // request the permission
                const grant = await PermissionsAndroid.requestMultiple(["android.permission.BLUETOOTH_SCAN"
                    , 'android.permission.BLUETOOTH_ADVERTISE', 'android.permission.BLUETOOTH_CONNECT', PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]);
                console.log('grant =' + JSON.stringify(grant));
            }
        }
    }

    /** 蓝牙状态改变 */
    function handleUpdateState(event) {
        bleModule.bleState = event.state;
        // 蓝牙打开时自动扫描
        if (event.state === BleState.On) {
            // scan();
        }
    }

    /** 扫描结束监听 */
    function handleStopScan() {
        setScaning(false);
    }

    /** 搜索到一个新设备监听 */

    function handleDiscoverPeripheral(data) {
        // console.log('handleDiscoverPeripheral' + JSON.stringify(data));
        console.log('New device discovered:', data.name);
        
        if(!data.name) {
            console.log('Ignoring device without name');
            return;
        }

        // 蓝牙连接 id
        let id;
        // 蓝牙 Mac 地址
        let macAddress;
        var isAndroid = Platform.OS == 'android'
        if (isAndroid) {
            macAddress = data.id;
            id = macAddress;
        } else {
            // ios连接时不需要用到Mac地址，但跨平台识别同一设备时需要 Mac 地址
            macAddress = SDK.getMacFromAdvertising(data);
            id = data.id;
        }
        
        var ringData = SDK.getBroadcastData(data?.advertising?.rawData?.bytes, isAndroid);
        data.color = ringData.color;
        data.size = ringData.size;
        deviceMap.current.set(data.id, data);
        setData([...deviceMap.current.values()]); // Update raw data
    }
    function handleConnectPeripheral(data) {
        // console.log('BleManagerConnectPeripheral:', data);
    }

    /** 蓝牙设备已断开连接 */
    function handleDisconnectPeripheral(data) {
        showDialog();
        // console.log('BleManagerDisconnectPeripheral:', data);
        initData();
    }

    function initData() {
        // 断开连接后清空UUID
        bleModule.initUUID();
        // 断开后显示上次的扫描结果
        setConnectingId('');
        setStatus('');
        setData([...deviceMap.current.values()]);
        setIsConnected(false);
        setWriteData('');
        setReadData('');
        setReceiveData('');
        setInputText('');
    }

    /** 接收到新数据 */
    function handleUpdateValue(data) {
        // console.log(`=========接收到新数据=====handleUpdateValue===========isOTAModel=${isOTAModel.current}= cmd=${data.value[1]} data[12]=${data.value[12]} `)
        if (!isOTAModel.current) {
            // console.log(`=========接收到新数据=====handleUpdateValue==============data=${JSON.stringify(data)} `)
            let value = data.value;
            SDK.pushRawData(value);
        }
    }

    function scan() {
        if (bleModule.bleState !== BleState.On) {
            enableBluetooth();
            return;
        }

        // 重新扫描时清空列表
        deviceMap.current.clear();
        filteredDevices.length = 0;
        bleModule
            .scan()
            .then(() => {
                setScaning(true);
            })
            .catch(err => {
                setScaning(false);
            });
    }

    function enableBluetooth() {
        if (Platform.OS === 'ios') {
            alert('Please enable Bluetooth on your phone');
        } else {
            Alert.alert('Tip', 'Please enable Bluetooth on your phone', [
                {
                    text: 'Cancel',
                    onPress: () => { },
                },
                {
                    text: 'Open',
                    onPress: () => {
                        bleModule.enableBluetooth();
                    },
                },
            ]);
        }
    }

    /** 连接蓝牙 */
    function connect(item) {
        setConnectingId(item.id);
        setStatus('connecting...');
        if (scaning) {
            // 当前正在扫描中，连接时关闭扫描
            bleModule.stopScan().then(() => {
                setScaning(false);
            });
        }
        var bleName = item.name;
        bleModule
            .connect(item.id)
            .then(peripheralInfo => {
                console.log(` connect success ================= `);
                setIsConnected(true);
                // 连接成功后，列表只显示已连接的设备
                setData([item]);

                setSelectedDevice(item);
                setShowModeModal(true);
            })
            .catch(err => {
                alert('connect failed');
            })
            .finally(() => {
                console.log(`connect finally `);
                setConnectingId('');
            });
    }

    /** 断开连接 */
    function disconnect() {
        bleModule.disconnect();
        initData();
    }

    function notify(index) {
        bleModule
            .startNotification(index)
            .then(() => {
                setIsMonitoring(true);
                alert('Successfully opened');
            })
            .catch(err => {
                setIsMonitoring(false);
                alert('Opening failed');
            });
    }

    function read(index) {
        bleModule
            .read(index)
            .then((data) => {
                setReadData(data);
            })
            .catch(err => {
                alert('read failure');
            });
    }

    function write(writeType) {
        return (index) => {
            if (inputText.length === 0) {
                alert('Please enter the message');
                return;
            }

            bleModule[writeType](inputText, index)
                .then(() => {
                    bleReceiveData.current = [];
                    setWriteData(inputText);
                    setInputText('');
                })
                .catch(err => {
                    alert('fail in send');
                });
        };
    }

    function alert(text) {
        Alert.alert('Tip', text, [{ text: 'OK', onPress: () => { } }]);
    }

    function renderItem(item) {
        const data = item.item;
        const disabled = !!connectingId && connectingId !== data.id;
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                disabled={disabled || isConnected}
                onPress={() => {
                    connect(data);
                }}
                style={[styles.item, { opacity: disabled ? 0.5 : 1 }]}>
                <View style={{ flexDirection: 'row' }}>
                    <Text style={{ color: 'black' }}>{data.name ? data.name : ''}</Text>
                    <Text style={{ color: 'black', marginLeft: 20 }}>{`color:${ringColor(data.color)} size:${data.size}`}</Text>
                    <Text style={{ marginLeft: 50, color: 'red' }}>
                        {connectingId === data.id ? status : ''}
                    </Text>
                </View>
                <Text>{data.id}</Text>
            </TouchableOpacity>
        );
    }

    function ringColor(val) {
        // console.log(` val=${val} `);
        var color = ""
        switch (val) {
            case 0:
                color = "Deep Black";
                break;
            case 1:
                color = "Silver";
                break;
            case 2:
                color = "Gold";
                break;
            case 3:
                color = "Rose Gold";
                break;
            case 4:
                color = "Gold/Silver Mix";
                break;
            case 5:
                color = "Purple/Silver Mix";
                break;
            case 6:
                color = "Rose Gold/Silver Mix";
                break;
            case 7:
                color = "Brushed Silver";
                break;
            case 8:
                color = "Black Matte";
                break;
            case 9:
                color = "dark grey";
        }
        return color;
    }

    function renderFooter() {
        if (!isConnected) {
            return;
        }
        return (
            <ScrollView
                style={{
                    marginTop: 10,
                    borderColor: '#eee',
                    borderStyle: 'solid',
                    borderTopWidth: StyleSheet.hairlineWidth * 2,
                }}>
                <Characteristic
                    label="（write）："
                    action="send"
                    content={writeData}
                    characteristics={bleModule.writeWithResponseCharacteristicUUID}
                    onPress={write('write')}
                    input={{ inputText, setInputText }}
                />

                <Characteristic
                    label="（writeWithoutResponse）："
                    action="send"
                    content={writeData}
                    characteristics={bleModule.writeWithoutResponseCharacteristicUUID}
                    onPress={write('writeWithoutResponse')}
                    input={{ inputText, setInputText }}
                />

                <Characteristic
                    label="read："
                    action="read"
                    content={readData}
                    characteristics={bleModule.readCharacteristicUUID}
                    onPress={read}
                />

                <Characteristic
                    label={`Notify listeners to receive data（${isMonitoring ? 'Listening enabled' : 'Listening not enabled'
                        }）：`}
                    action="Enable notifications"
                    content={receiveData}
                    characteristics={bleModule.nofityCharacteristicUUID}
                    onPress={notify}
                />
            </ScrollView>
        );
    }

    const handleModeSelect = (mode) => {
        setShowModeModal(false);
        const bleName = selectedDevice.name;
        
        switch(mode) {
            case 'health':
                isOTAModel.current = false;
                updateValueListener?.remove();
                updateValueListener = bleModule.addListener(
                    BleEventType.BleManagerDidUpdateValueForCharacteristic,
                    handleUpdateValue,
                );
                bleModule.startNotification();
                navigation.navigate('main', { bleName });
                break;
            case 'ringOta':
                isOTAModel.current = true;
                updateValueListener?.remove();
                navigation.navigate('otaDownLoad');
                break;
            case 'chargingOta':
                isOTAModel.current = true;
                updateValueListener?.remove();
                navigation.navigate('chargeOta');
                break;
            case 'bloodPressure':
                isOTAModel.current = false;
                updateValueListener?.remove();
                updateValueListener = bleModule.addListener(
                    BleEventType.BleManagerDidUpdateValueForCharacteristic,
                    handleUpdateValue,
                );
                bleModule.startNotification();
                navigation.navigate('login');
                break;
        }
    };

    return (
        <>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Filter by device name"
                    value={filterText}
                    onChangeText={setFilterText}
                />
            </View>
        
            <Modal
                animationType="slide"
                transparent={true}
                visible={showModeModal}
                onRequestClose={() => {
                    setShowModeModal(false);
                }}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>Select Mode</Text>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => handleModeSelect('health')}>
                            <Text style={styles.modalButtonText}>Go to Health</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => handleModeSelect('ringOta')}>
                            <Text style={styles.modalButtonText}>Go to Ring OTA</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => handleModeSelect('chargingOta')}>
                            <Text style={styles.modalButtonText}>Go to Charging OTA</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => handleModeSelect('bloodPressure')}>
                            <Text style={styles.modalButtonText}>Go to bloodPressure</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        <SafeAreaView style={styles.container}>
            <Header
                isConnected={isConnected}
                scaning={scaning}
                disabled={scaning || !!connectingId}
                onPress={isConnected ? disconnect : scan}
            />
            <FlatList
                renderItem={renderItem}
                keyExtractor={item => item.id}
                data={filteredDevices}
                extraData={[connectingId, filterText,data]}
            />
            {/* {renderFooter()} */}
        </SafeAreaView>
        </>
    );
};

const styles = StyleSheet.create({
    searchContainer: {
        padding: 10,
        backgroundColor: '#f5f5f5',
    },
    searchInput: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        paddingLeft: 10,
        backgroundColor: 'white',
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    modalButton: {
        backgroundColor: '#2196F3',
        borderRadius: 5,
        padding: 10,
        marginVertical: 5,
        width: '100%',
        alignItems: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    item: {
        flexDirection: 'column',
        borderColor: 'rgb(235,235,235)',
        borderStyle: 'solid',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingLeft: 10,
        paddingVertical: 8,
    },
});
export default BlueTooth;

