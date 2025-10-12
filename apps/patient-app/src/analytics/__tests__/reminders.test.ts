// ============================================================================
// apps/patient-app/src/analytics/__tests__/reminders.test.ts
// ============================================================================
import { describe, it, expect } from 'vitest';
import { loadReminders, saveReminder, removeReminder } from '../../analytics/reminders';

describe('reminders', () => {
  it('saves and removes', () => {
    const id = `t-${Date.now()}`;
    saveReminder({ id, title:'t', whenISO:new Date().toISOString(), active:true, createdAt:new Date().toISOString() });
    const after = loadReminders().some(r => r.id===id);
    expect(after).toBe(true);
    removeReminder(id);
    const gone = loadReminders().some(r => r.id===id);
    expect(gone).toBe(false);
  });
});
