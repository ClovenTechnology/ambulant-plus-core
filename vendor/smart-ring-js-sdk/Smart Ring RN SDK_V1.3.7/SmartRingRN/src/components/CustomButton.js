import { TouchableOpacity, Text, StyleSheet } from "react-native";

// 自定义按钮组件
const CustomButton = ({ onPress, children }) => (
  <TouchableOpacity onPress={onPress} style={styles.button}>
    <Text style={styles.buttonText}>{children}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#007AFF', // 例子颜色，可以根据需要调整
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    width: 150, // 按钮宽度，可以根据需要调整
    fontSize: 16, // 文本大小
    textAlign: 'center', // 文本居中
    fontWeight: 'normal', // 控制字体粗细，可以改为'bold'加粗
    textTransform: 'none', // 关闭默认的大写转换
  },
});

export default CustomButton;