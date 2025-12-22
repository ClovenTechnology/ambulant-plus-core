'use client';
import React from 'react';

type Goal = {
  title: string;
  current: number;
  target: number;
  unit: string;
  streak?: number;
  badge?: string;
};

interface GoalCardProps {
  goal: Goal;
}

export default function GoalCard({ goal }: GoalCardProps) {
  const progress = Math.min(100, Math.round((goal.current / goal.target) * 100));

  return (
    <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center space-y-2">
      <div className="text-sm font-medium">{goal.title}</div>
      <div className="text-2xl font-bold">{goal.current}{goal.unit}</div>
      <div className="w-full bg-gray-200 h-2 rounded-full">
        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
      </div>
      {goal.badge && <div className="text-xl">{goal.badge}</div>}
      {goal.streak && <div className="text-xs text-gray-500">🔥 {goal.streak} day streak</div>}
    </div>
  );
}
