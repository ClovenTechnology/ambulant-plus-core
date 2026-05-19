export class BaselineSignalInterpreter {
  interpret(args: {
    hrDelta24hVs30d?: number | null;
    sleepDelta24hVs30d?: number | null;
    systolicDelta24hVs30d?: number | null;
  }) {
    const signals: string[] = [];

    if ((args.hrDelta24hVs30d ?? 0) >= 8) {
      signals.push('resting_hr_upshift');
    }

    if ((args.sleepDelta24hVs30d ?? 0) <= -1.5) {
      signals.push('sleep_debt_building');
    }

    if ((args.systolicDelta24hVs30d ?? 0) >= 10) {
      signals.push('systolic_bp_upshift');
    }

    return {
      signals,
      hasSignals: signals.length > 0,
    };
  }
}
