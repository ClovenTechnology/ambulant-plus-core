import React from 'react';

const actions = [
  { label: 'Teleconsult', icon: '📞' },
  { label: 'Schedule MedReach', icon: '💊' },
  { label: 'View eRx', icon: '🩺' },
];

export default function ActionCards() {
  return (
    <div className="flex justify-center gap-4 mt-6 flex-wrap">
      {actions.map(a => (
        <div key={a.label} className="bg-white/20 backdrop-blur-md p-4 rounded-xl cursor-pointer shadow-lg hover:scale-105 transition-transform flex flex-col items-center">
          <span className="text-2xl">{a.icon}</span>
          <span className="mt-2 font-semibold">{a.label}</span>
        </div>
      ))}
    </div>
  );
}
