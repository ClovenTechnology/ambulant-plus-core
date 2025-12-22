'use client';
import React from 'react';

type Insight = {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
};

interface InsightCardProps {
  insight: Insight;
}

export default function InsightCard({ insight }: InsightCardProps) {
  const levelColor = {
    info: 'text-blue-600',
    warning: 'text-orange-500',
    critical: 'text-red-600'
  }[insight.level];

  return (
    <div className={`bg-white p-4 rounded-lg shadow`}>
      <div className={`font-medium ${levelColor}`}>{insight.title}</div>
      <div className="text-sm">{insight.message}</div>
    </div>
  );
}
