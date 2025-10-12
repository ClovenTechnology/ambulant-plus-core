// ============================================================================
// apps/patient-app/src/analytics/reminders.ts
// Local notification reminders (tab/PWA fallback). No external push.
// ============================================================================
export type Reminder = {
  id: string;            // e.g., 'lab:OGTT' or 'kick:daily'
  title: string;         // 'OGTT due'
  whenISO: string;       // 'YYYY-MM-DDTHH:mm:ssZ'
  repeatDaily?: boolean; // daily at same local time
  payload?: Record<string, any>;
  active: boolean;
  createdAt: string;
};

const KEY = 'antenatal:reminders';

export function loadReminders(): Reminder[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function saveReminder(r: Reminder) {
  const all = loadReminders().filter(x => x.id !== r.id);
  all.push(r); persist(all);
}

export function removeReminder(id: string) {
  persist(loadReminders().filter(x => x.id !== id));
}

export function toggleReminder(id: string, on: boolean) {
  const all = loadReminders().map(r => r.id === id ? { ...r, active: on } : r);
  persist(all);
}

function persist(all: Reminder[]) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
}

export function requestNotifyPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

function showNotification(title: string, body?: string) {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  } else {
    // fallback: visible toast via event
    window.dispatchEvent(new CustomEvent('local-toast', { detail: { title, body } }));
  }
}

function nextOccurrence(whenISO: string): number {
  const now = Date.now();
  const when = new Date(whenISO).getTime();
  return when - now;
}

/**
 * Start background loop while page is open.
 * Checks every 60s; fires active reminders that are due.
 * If repeatDaily, reschedules to next day same local time.
 */
export function startReminderLoop() {
  if (typeof window === 'undefined') return;
  let ticking = (window as any).__ancReminderLoop as number | undefined;
  if (ticking) return;

  const tick = () => {
    const now = Date.now();
    const all = loadReminders();
    let changed = false;

    all.forEach(r => {
      if (!r.active) return;
      const due = new Date(r.whenISO).getTime() <= now + 500; // allow small skew
      if (due) {
        showNotification(r.title, r.payload?.body);
        if (r.repeatDaily) {
          const t = new Date(r.whenISO);
          t.setDate(t.getDate() + 1);
          r.whenISO = t.toISOString();
        } else {
          r.active = false;
        }
        changed = true;
      }
    });

    if (changed) persist(all);
  };

  tick();
  ticking = window.setInterval(tick, 60 * 1000);
  (window as any).__ancReminderLoop = ticking;
}
