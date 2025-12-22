import React from 'react';

type HealthScoreProps = { score: number };
export default function HealthScore({ score }: HealthScoreProps) {
  const color = score > 70 ? 'text-green-400' : score > 40 ? 'text-yellow-400' : 'text-red-500';
  return (
    <div className="flex flex-col items-center mt-6 animate-fadeIn">
      <span className="text-lg font-bold">Your Health Score</span>
      <span className={`text-4xl font-extrabold ${color}`}>{score}</span>
    </div>
  );
}
