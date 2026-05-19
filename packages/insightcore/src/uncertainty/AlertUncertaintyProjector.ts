import type { Alert } from '../contracts';
import type { UncertaintyBundle } from '../contracts/uncertainty';

export class AlertUncertaintyProjector {
  apply(alerts: Alert[], uncertainty: UncertaintyBundle): Alert[] {
    return alerts.map((alert) => ({
      ...alert,
      rationale: [...alert.rationale, `uncertainty.overall=${uncertainty.overall}`],
    }));
  }
}