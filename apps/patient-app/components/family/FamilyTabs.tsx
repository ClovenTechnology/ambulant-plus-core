import type { TabId } from './types';
import { cn } from './utils';

export default function FamilyTabs({
  tabs,
  tab,
  onChange,
}: {
  tabs: { id: TabId; label: string; description: string }[];
  tab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-100 pb-2">
      {tabs.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'rounded-full px-3 py-2 text-xs font-medium transition-all duration-200',
              active
                ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
                : 'border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
            )}
            title={t.description}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}