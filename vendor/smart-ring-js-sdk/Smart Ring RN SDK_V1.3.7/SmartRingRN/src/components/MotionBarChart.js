import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { SVGRenderer, SvgChart } from '@wuba/react-native-echarts';
import { StyleSheet, View } from 'react-native';
import { GridComponent } from 'echarts/components';
echarts.use([SVGRenderer, BarChart, GridComponent]);

const MotionBarChart = (pro) => {
  const svgRef = useRef(null);
  const motionColors = ['#00000000', '#8a8a8a', '#02679e', '#7dcbf5', '#fff'];
  useEffect(() => {
    if (pro.arr && pro.arr.length == 0) {
      return;
    }
    let motionData = [];
    motionData.push(...pro.arr);
    let endTime = new Date(motionData[0].timeStamp).setHours(24, 0, 0, 0);
    motionData.push({
      timeStamp: endTime,
      motionSum: 0,
      motionType: 0,
    });
    let dataPoints = [];
    if (motionData && motionData.length > 0) {
      dataPoints = motionData.map((item) => {
        return {
          value: [
            new Date(item.timeStamp).toISOString(), // 转换为ISO 8601格式的时间字符串
            item.motionSum, // 示例数据，这里生成一个40-100之间的随机数
          ],
          itemStyle: {
            color: motionColors[item.motionType], // 为每个柱子设置颜色
          },
        }
      });
    }
    const xAxisOptions = {
      type: 'time',
      axisLabel: {
        formatter: function (value) {
          return "";
        },
      },
    };
    const option = {
      xAxis: xAxisOptions,
      yAxis: {
        type: 'value',
        boundaryGap: false,
        axisLabel: {
          show: false,
        },
        splitLine: {
          show: false,
        },
      },
      series: [{
        type: 'bar',
        data: dataPoints,
        barWidth: '100%',
      }],
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
  }, [pro.arr.length]);

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

export default MotionBarChart;