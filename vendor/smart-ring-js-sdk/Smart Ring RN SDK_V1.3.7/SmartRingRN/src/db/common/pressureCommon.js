
export const TrainingZone = {
    StressZone: 1, // 压力区间
    EngagementZone: 2, // 投入区间
    RelaxationZone: 3, // 放松区间
    RecoveryZone: 4, // 恢复区间
    Unknown: 5 // 未知区间
};

export const MotionType = {
    //极低
    ExtremelyLow: 1,
    //低
    Low: 2,
    //中
    Medium: 3,
    //高
    High: 4,
    //未知
    Unknown: 5
}

export function classifyStressLevel(averageHRV, pressureBaseLine) {
    // 这里仅为示例，实际需要根据您的区间规则进行准确分类
    if (10 < averageHRV && averageHRV <= pressureBaseLine * 0.6) {
      return TrainingZone.StressZone;
    } else if (pressureBaseLine * 0.6 < averageHRV &&
      averageHRV <= pressureBaseLine) {
      return TrainingZone.EngagementZone;
    } else if (pressureBaseLine > averageHRV &&
      averageHRV <= pressureBaseLine * 1.5) {
      return TrainingZone.RelaxationZone;
    } else if (averageHRV > pressureBaseLine * 1.5) {
      return TrainingZone.RecoveryZone;
    }
    return TrainingZone.Unknown;
  }

  export function getMotionType(motionSum) {
    if (0 <= motionSum && motionSum <= 100) {
      return MotionType.ExtremelyLow;
    } else if (101 <= motionSum && motionSum <= 500) {
      return MotionType.Low;
    } else if (501 <= motionSum && motionSum <= 1000) {
      return MotionType.Medium;
    } else if (motionSum >= 1001) {
      return MotionType.High;
    }
    return MotionType.Unknown;
  }