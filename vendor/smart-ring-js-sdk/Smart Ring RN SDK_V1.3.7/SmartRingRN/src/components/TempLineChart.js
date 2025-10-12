import React, {useRef, useEffect,useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart, CandlestickChart} from 'echarts/charts';
import {SVGRenderer, SvgChart} from '@wuba/react-native-echarts';
import {StyleSheet, View} from 'react-native';
import { GridComponent } from 'echarts/components';
echarts.use([SVGRenderer, LineChart, CandlestickChart,GridComponent]);

const TempLineChart=(pro)=> {
  const svgRef = useRef(null);
  let chart;
  useEffect(() => {
    
    console.log(`TempLineChart  length: ${pro.arr.length}`);
    
    let dataPoints = [];
    if (pro.arr && pro.arr.length > 0) {
      dataPoints = pro.arr.map((item) => {
        return [
        new Date(item.timeStamp).toISOString(), // 转换为ISO 8601格式的时间字符串
        item.temp, // 示例数据，这里生成一个40-100之间的随机数
      ]});
    }
    const xAxisOptions = {
      type: 'time',
      axisLabel: {
        formatter: function (value, index) {
          return echarts.time.format(new Date(value), '{HH}:{mm}', false);
        },
        interval: 0, // 设置为0试图让每个刻度都有标签
        rotate: -45, // 旋转标签以便在有限的空间内显示更多
        showMinLabel: true, // 确保显示最小刻度的标签
        showMaxLabel: true, // 确保显示最大刻度的标签
      },
      axisTick: {
        alignWithLabel: true, // 确保刻度线与标签对齐
      },
      // 如果你的数据跨越多个天数，可能还需要设置min和max属性
    };
    const option = {
      xAxis: xAxisOptions,
      yAxis: {
        type: 'value',
        max:3,
        min:-3,
        boundaryGap: false,
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#555',
          },
        },
      },
      series: [
        {
          name: '数据序列',
          type: 'line',
          data: dataPoints,
          symbolSize: 3, // 可选：设置标记大小
        },
      ],
    };
    
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

export default TempLineChart;