import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, CandlestickChart } from 'echarts/charts';
import { SVGRenderer, SvgChart } from '@wuba/react-native-echarts';
import { StyleSheet, View } from 'react-native';
import { GridComponent, MarkLineComponent } from 'echarts/components';
echarts.use([SVGRenderer, LineChart, CandlestickChart, GridComponent, MarkLineComponent]);

const StressLineChart = (pro) => {
  const svgRef = useRef(null);
  // const dataMax = Math.max(...pro.arr.flatMap(obj => Object.values(obj).flat().map(item => item.pressure)));
  // const dataMin = Math.min(...pro.arr.flatMap(obj => Object.values(obj).flat().map(item => item.pressure)));
  // var dataMax = 120;
  const pressureLabels = ['恢复', '放松', '投入', '压力'];
  const baseLine = pro.baseLine;
  const pressureThresholds = [
    baseLine * 1.5,
    baseLine * 1,
    baseLine * 0.6,
    10,
  ];
  // const customYAxisTicks = [0, 50, 80, 90];
  // const yAxisOptions = {
  //   type: 'value',
  //   boundaryGap: false,
  //   splitLine: {
  //     lineStyle: {
  //       type: 'dashed',
  //       color: '#555',
  //     },
  //   },
  //   axisLabel: {
  //     formatter: function (value) {
  //       // 只保留我们指定的坐标值
  //       console.log(` Y轴显示坐标 value=${value} pressureThresholds.includes(value)=${pressureThresholds.includes(value)}`)
  //       if (pressureThresholds.includes(value)) {
  //         console.log(` 找到了自定义刻度 value=${value} `)
  //         return value.toString(); // 直接返回值
  //       }
  //       return null; // 其他值不显示标签
  //     },
  //     showMinLabel: true,
  //     showMaxLabel: true,
  //   },
  //   axisTick: {
  //     alignWithLabel: true,
  //     // 自动计算的ticks可能会和我们的customYAxisTicks冲突，所以这里可以关闭
  //     // show: false,
  //   },
  //   // interval: 0,
  //   // min: 0, // 确保Y轴起始点包含最小值
  //   // max: dataMax, // 确保Y轴结束点包含最大值，但确保不超过或低于你想要的刻度
  // };
  useEffect(() => {
    let series = [];
    console.log(` pro.arr.length=${Object.keys(pro.arr).length} pro.arr=${pro.arr}`)
    if (Object.keys(pro.arr).length == 0) {
      return;
    }
    // dataMax = Math.max(...pro.arr.flatMap(obj => Object.values(obj).flat().map(item => item.pressure))) + 10;
    let endTime = 0;
    if (Object.keys(pro.arr).length > 0) {
      pro.arr.forEach((obj) => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            let dataPoints = [];
            dataPoints = obj[key].map((item) => {
              endTime = item.timeStamp
              return [
                new Date(item.timeStamp).toISOString(),
                item.pressure,
              ]
            });
            series.push({
              name: key,
              type: 'line',
              data: dataPoints,
              symbolSize: 3,
              color: '#7dcbf5',
            });
          }
        }
      });
    }
    //补充一个24点的坐标轴
    if (endTime != 0) {
      let zeroClock = new Date(endTime).setHours(24, 0, 0, 0);
      series.push({
        name: "24点",
        type: 'line',
        data: [[new Date(zeroClock).toISOString(), null]],
        symbolSize: 3,
      });
      //添加压力基线
      pressureThresholds.forEach((item, index) => {
        series.push({
          name: pressureLabels[index],
          type: 'line',
          data: [[new Date(zeroClock).toISOString(), item]],
          symbolSize: 3,
          color: '#f57d7d',
          markLine: {
            symbol: 'none',
            data: [
              { type: 'average', name: '平均值' },
            ],
            label: {
              show: true, // 显示标签
              position: 'insideEndTop', // 或者其他您希望的标签位置，例如'middle'
              formatter: `${pressureLabels[index]}`, // 标签内容
              textStyle: {
                color: '#f57d7d',
              },
            },
          },
        });
      });
    }

    const xAxisOptions = {
      type: 'time',
      axisLabel: {
        formatter: function (value, index) {
          let date = new Date(value);
          let formatString = "";
          if (index > 0 && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            formatString = '24:00';
          } else {
            formatString = echarts.time.format(new Date(value), '{HH}:{mm}', false);
          }
          return formatString;
        },
        interval: 0,
        rotate: -45,
        showMinLabel: true,
        showMaxLabel: true,
      },
      axisTick: {
        alignWithLabel: true,
      },
    };
    const option = {
      xAxis: xAxisOptions,
      yAxis: {
        type: 'value',
        splitLine: {
          show: false,
        },
        axisLabel: {
          show: false,
        }
      },
      series: series,
    };
    let chart;
    if (svgRef.current) {
      chart = echarts.init(svgRef.current, 'light', {
        renderer: 'svg',
        width: 350,
        height: 400,
      });
      chart.setOption(option);
    }
    return () => chart?.dispose();
  }, [Object.keys(pro.arr).length]);

  return (
    <View style={style.container}>
      <SvgChart ref={svgRef} />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    marginTop: 0,
  },
});

export default StressLineChart;