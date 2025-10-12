import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import CountryPicker from 'react-native-country-picker-modal';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { httpManager } from '../http/httpManager';
import Config from 'react-native-config';
import { phoneLogin, emailLogin } from '../http/httpManager';
import { loginSuccess, updateAccount } from '../redux/authSlice'
import { useNavigation } from '@react-navigation/native';

const Login = () => {
  const [loginType, setLoginType] = useState('phone'); // 'phone' or 'email'
  const [countryCode, setCountryCode] = useState('86');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phonePassword, setPhonePassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const validateForm = () => {
    const newErrors = {};
    if (loginType === 'phone') {
      if (!phoneNumber.trim()) {
        newErrors.phone = 'Please enter your phone number';
      }
      if (!phonePassword.trim()) {
        newErrors.password = 'Please input a password';
      } else if (phonePassword.length < 6) {
        newErrors.password = 'Password length should be at least 6 characters';
      }
    } else {
      if (!email.trim()) {
        newErrors.email = 'Please enter your email address';
      } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        newErrors.email = 'Email format incorrect';
      }
      if (!emailPassword.trim()) {
        newErrors.password = 'Please input a password';
      } else if (emailPassword.length < 6) {
        newErrors.password = 'Password length should be at least 6 characters';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const loginData = loginType === 'phone'
        ? { phone: `${countryCode}${phoneNumber}`, phonePassword }
        : { email, emailPassword };
      console.log(` countryCode=${countryCode} `);
      var response = null;
      var account = "";
      if (loginType === 'phone') {
        response = await phoneLogin({ icode: `+${countryCode}`, phone: phoneNumber, pwd: phonePassword });
        account = phoneNumber;
        if (response.data.state == 0) {
          console.log(` naviagte to  bloodPressure`);
          dispatch(loginSuccess(response.data.t));
          dispatch(updateAccount(account));
          navigation.navigate('bloodPressure');
        } else {
          if (response.data.state == 2) {
            Alert.alert('Login failed', 'Incorrect phone number or password format');
          } else if (response.data.state == 3) {
            Alert.alert('Login failed', 'Account does not exist');
          } else if (response.data.state == 4) {
            Alert.alert('Login failed', 'Password error');
          } else {
            Alert.alert('Login failed', 'Service request failed');
          }
        }
      } else {
        response = await emailLogin({ username: email, pwd: emailPassword });
        account = email;
        if (response.status == 200) {
          dispatch(loginSuccess(response.data));
          dispatch(updateAccount(account));
          navigation.navigate('bloodPressure');
        } else if (response.status == 401) {
          Alert.alert('Login failed', 'Account or password error');
        } else {
          Alert.alert('Login failed', 'Service request failed');
        }

      }

    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('error', 'An error occurred during the login process, please try again later');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (type)=>{
    setLoginType(type);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Login</Text>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, loginType === 'phone' && styles.activeToggle]}
          onPress={() => toggle('phone')}
        >
          <Text style={styles.toggleText}>Phone Login
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, loginType === 'email' && styles.activeToggle]}
          onPress={() => toggle('email')}
        >
          <Text style={styles.toggleText}>Email Login
          </Text>
        </TouchableOpacity>
      </View>

      {loginType === 'phone' ? (
        <View style={styles.phoneInputContainer}>
          <View style={styles.countryCodeContainer}>
            <CountryPicker
              withFilter
              withFlag
              withCountryNameButton
              withCallingCode
              withEmoji
              onSelect={(country) => setCountryCode(country.callingCode[0])}
              containerButtonStyle={styles.countryCodeButton}
            />
            <Text style={styles.countryCodeText}>+{countryCode}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput, errors.phone && styles.errorInput]}
            placeholder="Please enter your phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.errorInput]}
            placeholder="Please enter your email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>
      )}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>PassWord</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.inputPassword, errors.password && styles.errorInput]}
            placeholder="Please input a password"
            value={loginType === 'phone'?phonePassword:emailPassword}
            onChangeText={loginType === 'phone'?setPhonePassword:setEmailPassword}
            secureTextEntry={!showPassword} // 控制是否显示密码
          // placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            {/* 使用 Unicode 字符作为眼睛图标 */}
            <Text>{showPassword ? '👁' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Login" onPress={handleLogin} disabled={loading} />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    marginTop: -200,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center',
  },
  toggleButton: {
    padding: 10,
    marginHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeToggle: {
    borderBottomColor: '#007AFF',
  },
  toggleText: {
    fontSize: 16,
  },
  phoneInputContainer: {
    marginBottom: 20,
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  countryCodeButton: {
    padding: 0,
    margin: 0,
  },
  countryCodeText: {
    fontSize: 16,
    marginLeft: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
  },
  inputPassword: {
    flex: 1, // 让输入框占据剩余空间
    fontSize: 16,
    color: '#333',
    paddingRight: 30,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  phoneInput: {
    flex: 1,
  },
  errorInput: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    marginTop: 5,
  },
  passwordContainer: {
    flexDirection: 'row', // 设置为行布局
    alignItems: 'center', // 垂直居中对齐

    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
});

export default Login;
