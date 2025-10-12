import { Alert } from'react-native';

export const showDialog = () => {
    Alert.alert(
        'Warning',
        'Please test historical data first',
        [
            { text: 'Cancel', style: 'cancel' },
        ],
        {
            cancelable: false
        }
    );
}