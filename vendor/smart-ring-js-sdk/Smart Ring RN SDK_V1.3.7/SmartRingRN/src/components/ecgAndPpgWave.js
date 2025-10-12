import React, { useEffect, useState } from 'react';

import { StyleSheet, View, InteractionManager, Button, Text, Platform, Dimensions } from 'react-native';
import Canvas, { Path2D } from 'react-native-canvas';
import EcgUtils from '../utils/ecgUtils'
import SDK from '../lib/ringSDK';
let ecgList = [];
let xs = 0;
let speedX = 0;
let yScale = 0;
let oldEcg = [];
let spiltArray = [];
// let step = 2450;
let pageIndex = 0;
let isControl = false;
let paths = [];
const screenWidth = Dimensions.get('window').width;
console.log(`screenWidth=${screenWidth}`);
var VREF_ECG = SDK.ECG_WAVE_PARAMETER.VREF_ECG;
var ECG_GAIN = SDK.ECG_WAVE_PARAMETER.ECG_GAIN;
var coe = SDK.ECG_WAVE_PARAMETER.RAW_COE; //ECG数据2字节32768，3字节131072
var verticalScalingFactor = SDK.ECG_WAVE_PARAMETER.VERTICAL_SCALING_FACTOR_RAW; //ECG数据量纲转换因子
const EcgAndPpgWave = (prop) => {

  const [page, setPage] = useState(0);


  useEffect(() => {
    drawGrid();
  }, []);

  useEffect(() => {
    // if (prop.swing == 0) {
    //   coe = SDK.ECG_WAVE_PARAMETER.RAW_COE;
    //   verticalScalingFactor = SDK.ECG_WAVE_PARAMETER.VERTICAL_SCALING_FACTOR_RAW;
    // } else {
    //   coe = SDK.ECG_WAVE_PARAMETER.ALGORITHM_COE;
    //   verticalScalingFactor = SDK.ECG_WAVE_PARAMETER.VERTICAL_SCALING_FACTOR_ALGORITHM;
    // }
    coe = SDK.ECG_WAVE_PARAMETER.RAW_COE;
    verticalScalingFactor = SDK.ECG_WAVE_PARAMETER.VERTICAL_SCALING_FACTOR_RAW;
    console.log(`useEffect coe=${coe} `);
    console.log(`=============ECGWave==========================useEffect=====================`);
    dealData(prop.data);

  }, [prop.data, prop.swing, prop.update]);

  const drawGrid = () => {
    let myCanvas = this.canvasbg;
    //加一个判断，如果不支持canvas也不至于报错
    if (myCanvas.getContext) {
      let ctx = myCanvas.getContext('2d');

      let { width, height } = styles.root;
      myCanvas.width = width;
      myCanvas.height = height;
      ctx.translate(0.5, 0.5);
      drawSmallGrid(ctx, width, height);
      drawBigGrid(ctx, width, height);
    }
  };
  //画小的表格背景
  const drawSmallGrid = (ctx, width, height) => {
    //设置线条颜色
    ctx.strokeStyle = '#706f6e';
    //线条粗细
    ctx.lineWidth = 1;
    ctx.beginPath();
    //画竖线
    //循环一下，初始值为0，宽度为画布的宽度，每次走5个像素
    for (let x = 0; x <= width; x += 5) {
      //每次从新定位一下从哪里开始画，x轴每次变化y轴始终是0
      ctx.moveTo(x, 0);
      //每次画整个画布高的线
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    //横线同理
    for (let y = 0; y <= height; y += 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.closePath();
  };

  //大的表格和小的是同样原理
  const drawBigGrid = (ctx, width, height) => {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.strokeStyle = '#f1ffdf';
    //唯一不一样的就是颜色和间隔
    for (let x = 0; x <= width; x += 25) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 25) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.closePath();
  };

  const dealData = (data) => {
    InteractionManager.runAfterInteractions(() => {
      spiltArray = [];
      pageIndex = 0;
      paths = [];
      ecgList = [];
      oldEcg = [];
      oldEcg = oldEcg.concat(data);
      for (let index = 0; index < oldEcg.length; index++) {
        ecgList.push(getY(oldEcg[index]));
      }
      isControl = false

      spiltArray.push(ecgList);
      requestECGWaveLayout();
    });
  };

  function requestECGWaveLayout() {
    if (ecgList.length === 0) {
      return;
    }
    let canvas = this.canvas;
    let { width, height } = styles.root;
    canvas.width = width;
    canvas.height = height;
    if (canvas.getContext) {
      let ctx = canvas.getContext('2d');
      // if (speedX === 0) {
      speedX = getSpeed();
      // }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ff0000';
      ctx.beginPath();
      let path = new Path2D(canvas);

      for (let index = 0; index < ecgList.length; index++) {
        path.lineTo(speedX * index, ecgList[index]);
        if (index % 500 == 0) {
          ctx.stroke(path);
        }
      }
      ctx.stroke(path);
      isControl = true;
      paths.push(path);
    }
  }

  function switchPage(isleft) {
    if (ecgList.length === 0 || !isControl) {
      return;
    }
    if (isleft) {
      if (pageIndex != 0) {
        pageIndex--;
      }
    } else if (pageIndex < spiltArray.length - 1) {
      pageIndex++;
    } else {
      return;
    }
    setPage(pageIndex);
    // let list = spiltArray[pageIndex];
    let canvas = this.canvas;
    let { width, height } = styles.root;
    canvas.width = width;
    canvas.height = height;
    if (canvas.getContext) {
      let ctx = canvas.getContext('2d');
      if (speedX === 0) {
        speedX = getSpeed();
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ff0000';
      ctx.beginPath();
      let path = paths[pageIndex];
      ctx.stroke(path);
      ctx.closePath();
    }
  }


  /**
   * data/1000/0.1
   * /1000 Convert voltage value to mv
   * /0.1 A voltage value of 1mm
   * @returns 
   */
  function getY(data) {
    const canvas = this.canvas;
    const height = canvas.height;
    if (xs === 0) {
      xs = getxS();
    }
    if (yScale === 0) {
      if (Platform.OS == 'ios') {
        yScale = getYScale(3);
      } else {
        yScale = getYScale(2);
      }
    }
    var vol = data * VREF_ECG / (coe * ECG_GAIN);
    let y = 0;
    // if (prop.swing == 1) {
    //   y = height / 2 + data / 1000 / 0.1 * xs * yScale;
    // } else {
    //   y = height / 2 + vol * verticalScalingFactor * xs * yScale;
    // }
    y = height / 2 + vol * verticalScalingFactor * xs * yScale;
    return y;
  }

  function getSpeed() {
    const DATA_PER_SEC = 512;
    const mode = EcgUtils.getPaperSpeedMode()
    const scale = getXScale(1);
    const dataPerLattice = DATA_PER_SEC / (25 * scale);
    return getxS() / dataPerLattice;
  }

  function getYScale(type) {
    let scale = 0;
    switch (type) {
      case 1:
        scale = 0.5; //5mm/mV
        break;
      case 2:
        scale = 1; //10mm/mV
        break;
      case 3:
        scale = 2; //20mm/mV
        break;
    }
    return scale;
  }

  function getxS() {
    const spac1 = 5;
    return spac1;
  }

  function getXScale(type) {
    let scale = 0;
    switch (type) {
      case 1:
        scale = 1; //25mm/s
        break;
      case 2:
        scale = 2; //50mm/s
        break;
    }
    return scale;
  }

  return (
    <View style={styles.content}>
      <Canvas ref={(ref) => (this.canvasbg = ref)} style={styles.root1} />
      <Canvas ref={(ref) => (this.canvas = ref)} style={styles.root} />
      <View style={styles.buttonContent}>
        <Button title={'left'} onPress={() => switchPage(true)}></Button>
        <Text>{`Page=${page}`}</Text>
        <Button title={'right'} onPress={() => switchPage(false)}></Button>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  root1: {
    width: screenWidth,
    height: 127,
    backgroundColor: '#66ff66',
  },
  root: {
    width: screenWidth,
    height: 127,
    marginTop: -127,
    zIndex: 999,
  },
  buttonContent: {
    width: screenWidth,
    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 5
  },
  content: {
    position: 'relative',
  },
});
export default EcgAndPpgWave;
