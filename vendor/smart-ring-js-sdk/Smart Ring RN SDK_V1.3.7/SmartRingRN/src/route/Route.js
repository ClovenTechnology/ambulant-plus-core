import React from "react";

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BlueTooth from "../pages/Bluetooth";
import Main from "../pages/Main";
import Ota from '../pages/Ota';
import UpgradeProcess from '../pages/UpgradeProcess';
import OtaDownLoad from "../pages/OtaDownLoad";
import ChargeOta from "../pages/ChargeOta";
import BloodPressure from "../pages/BloodPressure";
import Login from "../pages/Login";
const Stack = createStackNavigator();
const Route = () => {

    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={"bluetooth"} screenOptions={{ headerTitleAlign: "center" }}>
                <Stack.Screen name="login" component={Login} ></Stack.Screen>
                <Stack.Screen name="bluetooth" component={BlueTooth} ></Stack.Screen>
                <Stack.Screen name="main" component={Main}></Stack.Screen>
                <Stack.Screen name="ota" component={Ota}></Stack.Screen>
                <Stack.Screen name="otaDownLoad" component={OtaDownLoad}></Stack.Screen>
                <Stack.Screen name="chargeOta" component={ChargeOta}></Stack.Screen>
                <Stack.Screen name="upgradeProcess" component={UpgradeProcess}></Stack.Screen>
                <Stack.Screen name="bloodPressure" component={BloodPressure} options={{ title: 'Blood pressure measurement' }}></Stack.Screen>
            </Stack.Navigator>
        </NavigationContainer>
    )

}

export default Route;