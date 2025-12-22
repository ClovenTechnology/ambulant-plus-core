// components/reminders/ReminderTabs.tsx
import React from 'react';
import { TabId, tabs, getTabIcon } from './shared';

type ReminderTabsProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

export default function ReminderTabs({
  activeTab,
  onTabChange,
}: ReminderTabsProps) {
  return (
    <nav
      className="sticky top-0 z-20 mt-2 border-b bg-white/80 backdrop-blur"
      role="tablist"
      aria-label="Reminder sections"
    >
      <div className="flex gap-2 overflow-x-auto py-1 text-sm">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const icon = getTabIcon(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`reminders-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`reminders-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              className={[
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs sm:text-sm transition-colors flex items-center gap-1.5',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {icon && <span aria-hidden="true">{icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
