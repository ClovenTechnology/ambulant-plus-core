'use client';

export type DashboardFilters = {
  range: 'today' | '7d' | '30d';
};

type FiltersBarProps = {
  value: DashboardFilters;
  onChange: (value: DashboardFilters) => void;
};

const ranges = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export default function FiltersBar({ value, onChange }: FiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-white border rounded-xl p-4 shadow-sm">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Date range
        </label>
        <select
          className="text-sm rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={value.range}
          onChange={(e) =>
            onChange({ ...value, range: e.target.value as DashboardFilters['range'] })
          }
        >
          {ranges.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {/* You can extend this with lab/phleb dropdowns later */}
    </div>
  );
}
