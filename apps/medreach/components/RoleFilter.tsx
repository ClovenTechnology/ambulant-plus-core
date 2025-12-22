import { useState } from 'react';

type Option = { value: string; label: string };

export default function RoleFilter({ options, onChange }: { options: Option[]; onChange: (value: string) => void }) {
  const [value, setValue] = useState(options[0].value);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">Filter</label>
      <select
        value={value}
        onChange={e => { setValue(e.target.value); onChange(e.target.value); }}
        className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
