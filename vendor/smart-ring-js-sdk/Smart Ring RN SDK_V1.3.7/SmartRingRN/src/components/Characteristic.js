import React from 'react';
import PropTypes from "prop-types"
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const Characteristic = (props) => {
    const { label, action, characteristics, onPress, content, input } = props;

    if (characteristics.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={{ color: 'black' }}>{label}</Text>
            <Text style={styles.content}>{content}</Text>
            {input && (
                <TextInput
                    style={styles.textInput}
                    value={input.inputText}
                    placeholder="Please enter a message"
                    onChangeText={text => {
                        input.setInputText(text);
                    }}
                />
            )}
            {characteristics.map((item, index) => {
                return (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.7}
                        style={styles.buttonView}
                        onPress={() => {
                            onPress(index);
                        }}>
                        <Text style={styles.buttonText}>
                            {action} ({item})
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderColor: '#eee',
        borderStyle: 'solid',
        borderBottomWidth: StyleSheet.hairlineWidth * 2,
    },
    buttonView: {
        height: 30,
        backgroundColor: 'rgb(33, 150, 243)',
        paddingHorizontal: 10,
        borderRadius: 5,
        justifyContent: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
    },
    content: {
        marginTop: 5,
        marginBottom: 15,
    },
    textInput: {
        paddingLeft: 5,
        paddingRight: 5,
        backgroundColor: 'white',
        height: 50,
        fontSize: 16,
        flex: 1,
    },
});

Characteristic.prototype = {
    label: PropTypes.string.isRequired,
    action: PropTypes.string.isRequired,
    characteristics: PropTypes.array.isRequired,
    onPress: PropTypes.func.isRequired,
    content: PropTypes.string.isRequired,
    input: PropTypes.object.isRequired | PropTypes.any.isRequired,
}
export default Characteristic