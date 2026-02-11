// services/alert-engine/rules.ts
export const RuleAlertEngine: AlertEngine = {
async evaluate(inferences: InferenceOutput[]) {
const alerts: Alert[] = [];


for (const inf of inferences) {
if (inf.model === 'cardiac-risk-model') {
alerts.push({
id: uuid(),
patientId: inf.patientId,
type: 'Cardiac risk',
severity: 'high',
score: inf.confidence,
source: 'model',
timestamp: new Date().toISOString(),
status: 'new',
});
}


if (inf.model === 'respiratory-risk-model') {
alerts.push({
id: uuid(),
patientId: inf.patientId,
type: 'Respiratory risk',
severity: 'critical',
score: inf.confidence,
source: 'model',
timestamp: new Date().toISOString(),
status: 'new',
});
}
}


for (const alert of alerts) {
await eventBus.publish({
id: uuid(),
type: 'ALERT_CREATED',
entityId: alert.id,
source: 'alert-engine',
timestamp: new Date().toISOString(),
data: alert,
});
}


return alerts;
},
};