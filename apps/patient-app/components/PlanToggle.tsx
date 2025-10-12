'use client';

import { usePlan } from './context/PlanContext';

export default function PlanToggle() {
  const { plan, setPlan } = usePlan();

  return (
    <div className="ml-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs bg-white">
      <span className="text-gray-600">Plan</span>
      <button
        onClick={() => setPlan('free')}
        className={`px-2 py-0.5 rounded-full ${plan === 'free' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
      >
        Free
      </button>
      <button
        onClick={() => setPlan('premium')}
        className={`px-2 py-0.5 rounded-full ${plan === 'premium' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
      >
        Premium
      </button>
    </div>
  );
}
