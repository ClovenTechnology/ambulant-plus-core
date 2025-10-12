import PropTypes from "prop-types"
import React from "react";
import { View, TouchableOpacity, Text,StyleSheet } from "react-native"
const Header = (props) => {
    const {  disabled, isConnected, onPress, scaning } = props;
    return (
        <View style={styles.container}>
            <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.buttonView, { opacity: disabled ? 0.7 : 1 }]}
                disabled={disabled}
                onPress={onPress}>
                <Text style={[styles.buttonText]}>
                    {scaning ? 'Scanning' : isConnected ? 'Disconnect' : 'Scan'}
                </Text>
            </TouchableOpacity>

            <Text style={{ marginLeft: 10, marginTop: 10 }}>
                {isConnected ? 'The currently connected device' : 'Available devices'}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
    },
    buttonView: {
        backgroundColor: 'rgb(33, 150, 243)',
        paddingHorizontal: 10,
        marginHorizontal: 10,
        borderRadius: 5,
        marginTop: 10,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
    },
});
Header.prototype = {
    isConnected: PropTypes.bool.isRequired,
    scaning: PropTypes.bool.isRequired,
    disabled: PropTypes.bool.isRequired,
    onPress: PropTypes.func.isRequired,
}

export default Header;