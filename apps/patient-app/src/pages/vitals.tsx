import React from 'react';

const vitals = {
  heartRate: 74,
  bloodPressure: '122/78',
  spo2: 97,
  hrv: 52,
  sleepQuality: 'Good',
};

export default function Vitals() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-blue-900">💓 Vitals Dashboard</h2>
      <p className="text-gray-600">Your most recent heart rate, sleep data, and more from IoMTs will appear here.</p>

      <div className="grid grid-cols-2 gap-4 text-center mt-4">
        <VitalCard label="Heart Rate" value={`${vitals.heartRate} bpm`} />
        <VitalCard label="Blood Pressure" value={vitals.bloodPressure} />
        <VitalCard label="SPO2" value={`${vitals.spo2}%`} />
        <VitalCard label="HRV" value={`${vitals.hrv} ms`} />
        <VitalCard label="Sleep" value={vitals.sleepQuality} />
      </div>
    </div>
  );
}

function VitalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white shadow-md p-4 border border-gray-100">
      <p className="text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-purple-700">{value}</p>
    </div>
  );
}
