// apps/patient-app/app/reminder/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import Link from 'next/link';
import Section from '@/components/Section';
import PillReminderCard from '@/components/PillReminderCard';
import ReminderList, { type ReminderShape } from '@/components/ReminderList';
import Sparkline from '@/components/charts/Sparkline';

import ReminderHeader from '@/components/reminders/ReminderHeader';
import ReminderTabs from '@/components/reminders/ReminderTabs';
import PillsTab from '@/components/reminders/PillsTab';
import HydrationTab from '@/components/reminders/HydrationTab';
import ExerciseTab from '@/components/reminders/ExerciseTab';
import MeditationTab from '@/components/reminders/MeditationTab';
import SleepTab from '@/components/reminders/SleepTab';

import {
  type ApiReminder,
  type TabId,
  MOCK_REMINDERS,
  MOCK_ADHERENCE_TREND,
  nowHHMM,
  timeToIsoToday,
  getReminderType,
  computeStats,
  getCategoryIcon,
  hasNotificationSupport,
} from '@/components/reminders/shared';

import { ensureRemindersPushSubscription } from '@/lib/pushBrowser';
import { toast } from '../../components/toast';

type ActionResult = {
  ok: boolean;
  data?: any;
  status: number;
};

function parseRemindersPayload(data: any): ApiReminder[] {
  const list: any[] = Array.isArray(data?.reminders)
    ? data.reminders
    : Array.isArray(data)
    ? data
    : [];
  return list as ApiReminder[];
}

function normalizeActionOk(res: Response, data: any) {
  if (!res.ok) return false;
  if (data && typeof data === 'object' && data.ok === false) return false;
  return true;
}

function formatHHMMFromIso(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function RemindersPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [reminders, setReminders] = useState<ApiReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedMock, setUsedMock] = useState(false);

  // Medication adherence trend (server may override, else fallback)
  const [adherenceTrend, setAdherenceTrend] = useState<number[]>(MOCK_ADHERENCE_TREND);

  // Desktop / in-tab notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const scheduledIdsRef = useRef<Set<string>>(new Set());

  // confirm dialog state (for pills / any reminder)
  const [confirming, setConfirming] = useState<ApiReminder | null>(null);
  const [confirmMode, setConfirmMode] = useState<'now' | 'earlier'>('now');
  const [confirmTime, setConfirmTime] = useState<string>(nowHHMM());
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Modal accessibility refs
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmFirstRadioRef = useRef<HTMLInputElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Header micro-copy
  const [showAlertsInfo, setShowAlertsInfo] = useState(false);

  // Quick scroll target when switching tabs from quick actions
  const [pendingScrollTarget, setPendingScrollTarget] = useState<
    'hydration' | 'exercise' | 'meditation' | 'sleep' | null
  >(null);

  // Refs to creation forms in tabs (for quick-scroll)
  const hydrationFormRef = useRef<HTMLFormElement | null>(null);
  const exerciseFormRef = useRef<HTMLFormElement | null>(null);
  const meditationFormRef = useRef<HTMLFormElement | null>(null);
  const sleepFormRef = useRef<HTMLFormElement | null>(null);

  // All reminders search/filter (overview tab)
  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderFilterType, setReminderFilterType] = useState<
    'all' | 'pill' | 'hydration' | 'exercise' | 'meditation' | 'sleep'
  >('all');

  async function fetchTodayReminders() {
    const res = await fetch('/api/reminders?for=today', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load reminders');
    const data = await res.json().catch(() => ({}));
    const list = parseRemindersPayload(data);
    const effectiveList = list.length ? list : MOCK_REMINDERS;
    const usedMockNow = !list.length;
    return { data, list, effectiveList, usedMockNow };
  }

  function applyTrendFromData(data: any, effectiveList: ApiReminder[]) {
    const serverTrend = data?.adherenceTrend;
    if (Array.isArray(serverTrend) && serverTrend.length) {
      setAdherenceTrend(serverTrend);
      return;
    }

    const pillList = effectiveList.filter((r) => getReminderType(r) === 'pill');
    const pillStats = computeStats(pillList);
    const todayPct = pillStats.pct;

    setAdherenceTrend((prev) => {
      const base = prev && prev.length ? prev : MOCK_ADHERENCE_TREND;
      return [...base.slice(1), todayPct];
    });
  }

  async function loadReminders() {
    setLoading(true);
    setError(null);
    setUsedMock(false);

    try {
      const { data, effectiveList, usedMockNow } = await fetchTodayReminders();

      // New "today" dataset: reset scheduled notification keys
      scheduledIdsRef.current.clear();

      setReminders(effectiveList);
      setUsedMock(usedMockNow);
      applyTrendFromData(data, effectiveList);
    } catch (err: any) {
      console.error('Error loading reminders', err);
      setError(err?.message || 'Could not load reminders.');

      scheduledIdsRef.current.clear();
      setReminders(MOCK_REMINDERS);
      setUsedMock(true);

      toast('Showing sample reminders while we reconnect.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function refreshRemindersSilent() {
    try {
      const { data, effectiveList, usedMockNow } = await fetchTodayReminders();
      scheduledIdsRef.current.clear();
      setReminders(effectiveList);
      setUsedMock(usedMockNow);
      applyTrendFromData(data, effectiveList);
    } catch (err) {
      // silent: no toast spam; just log
      console.error('Silent refresh failed', err);
    }
  }

  async function postReminderAction(payload: any): Promise<ActionResult> {
    const urls = ['/api/reminders', '/api/reminders/confirm']; // confirm kept as backward compatible alias
    let lastErr: any = null;

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });

        // If the route exists but method not allowed, try the fallback.
        if (res.status === 404 || res.status === 405) continue;

        const data = await res.json().catch(() => null);
        const ok = normalizeActionOk(res, data);

        return { ok, data, status: res.status };
      } catch (e) {
        lastErr = e;
      }
    }

    console.error('All action routes failed', lastErr);
    return { ok: false, data: null, status: 0 };
  }

  useEffect(() => {
    loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect existing notification permission (initial hint)
  useEffect(() => {
    if (!hasNotificationSupport()) return;
    if (window.Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Typed slices
  const pillReminders = useMemo(() => reminders.filter((r) => getReminderType(r) === 'pill'), [reminders]);
  const hydrationReminders = useMemo(
    () => reminders.filter((r) => getReminderType(r) === 'hydration'),
    [reminders]
  );
  const exerciseReminders = useMemo(
    () => reminders.filter((r) => getReminderType(r) === 'exercise'),
    [reminders]
  );
  const meditationReminders = useMemo(
    () => reminders.filter((r) => getReminderType(r) === 'meditation'),
    [reminders]
  );
  const sleepReminders = useMemo(() => reminders.filter((r) => getReminderType(r) === 'sleep'), [reminders]);

  // Stats per category + overall
  const pillStats = useMemo(() => computeStats(pillReminders), [pillReminders]);
  const hydrationStats = useMemo(() => computeStats(hydrationReminders), [hydrationReminders]);
  const exerciseStats = useMemo(() => computeStats(exerciseReminders), [exerciseReminders]);
  const meditationStats = useMemo(() => computeStats(meditationReminders), [meditationReminders]);
  const sleepStats = useMemo(() => computeStats(sleepReminders), [sleepReminders]);
  const overallStats = useMemo(() => computeStats(reminders), [reminders]);

  const overallCompletionPct = useMemo(() => {
    const total = overallStats.pending + overallStats.taken + overallStats.missed;
    if (total === 0) return 0;
    return Math.round((overallStats.taken / total) * 100);
  }, [overallStats]);

  const pillTrendAverage = useMemo(() => {
    if (!adherenceTrend.length) return 0;
    const sum = adherenceTrend.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / adherenceTrend.length);
  }, [adherenceTrend]);

  // "Today" pills = medication reminders that are still Pending
  const todaysPills = useMemo(
    () =>
      pillReminders
        .filter((r) => r.status === 'Pending')
        .slice()
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [pillReminders]
  );

  // normalize for ReminderList (titles WITHOUT emojis; ReminderCard handles icons)
  const reminderShapes: ReminderShape[] = useMemo(
    () =>
      reminders.map((r) => {
        const type = getReminderType(r);
        const baseTitle = r.name || 'Reminder';
        return {
          id: r.id,
          type,
          title: baseTitle,
          dueTime: r.time || r.meta?.displayTime,
          completed: r.status === 'Taken',
          dose: r.dose ?? undefined,
          status: r.status,
          erxId: r.meta?.erxId ?? null,
          notes: r.meta?.notes,
          recurrence: r.meta?.recurrence,
          meta: { ...r.meta, displayTime: r.time ?? r.meta?.displayTime },
        };
      }),
    [reminders]
  );

  const pillShapes = useMemo(() => reminderShapes.filter((r) => r.type === 'pill'), [reminderShapes]);
  const hydrationShapes = useMemo(
    () => reminderShapes.filter((r) => r.type === 'hydration'),
    [reminderShapes]
  );
  const exerciseShapes = useMemo(() => reminderShapes.filter((r) => r.type === 'exercise'), [reminderShapes]);
  const meditationShapes = useMemo(
    () => reminderShapes.filter((r) => r.type === 'meditation'),
    [reminderShapes]
  );
  const sleepShapes = useMemo(() => reminderShapes.filter((r) => r.type === 'sleep'), [reminderShapes]);

  const filteredReminderShapes = useMemo(() => {
    const query = reminderSearch.trim().toLowerCase();
    return reminderShapes.filter((r) => {
      if (reminderFilterType !== 'all' && r.type !== reminderFilterType) return false;
      if (!query) return true;
      const haystack = `${r.title ?? ''} ${r.dose ?? ''} ${r.type ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [reminderShapes, reminderSearch, reminderFilterType]);

  function openConfirmDialog(rem: ApiReminder) {
    lastFocusRef.current = (typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null) as HTMLElement | null;

    setConfirming(rem);
    setConfirmMode('now');
    setConfirmTime(nowHHMM());
  }

  function closeConfirmDialog() {
    if (confirmBusy) return;
    setConfirming(null);

    // Restore focus to the element that opened the dialog (accessibility polish)
    window.setTimeout(() => lastFocusRef.current?.focus?.(), 0);
  }

  async function applyConfirm() {
    if (!confirming) return;
    setConfirmBusy(true);

    try {
      const takenAtIso = confirmMode === 'now' ? new Date().toISOString() : timeToIsoToday(confirmTime);

      // ✅ Unified action route: /api/reminders (legacy alias remains /api/reminders/confirm)
      const payload = {
        action: 'confirm',
        ids: [confirming.id],
        id: confirming.id, // backward compatibility if upstream still expects "id"
        takenAt: takenAtIso,
      };

      const result = await postReminderAction(payload);

      // ✅ Fix bug: do NOT mark taken on failure
      if (!result.ok) {
        console.error('Confirm failed', result.data);
        toast('Could not confirm this reminder. We kept your list unchanged.', { type: 'error' });
        return;
      }

      // optimistic UI: mark as Taken and clear snooze (only after success)
      setReminders((prev) =>
        prev.map((r) => (r.id === confirming.id ? { ...r, status: 'Taken', snoozedUntil: null } : r))
      );

      closeConfirmDialog();

      // ✅ Server truth wins: silently refresh in background
      void refreshRemindersSilent();
    } catch (err) {
      console.error('Error confirming reminder', err);
      toast('Network error confirming reminder.', { type: 'error' });
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleSnoozeById(id: string, minutes = 15) {
    try {
      const payload = {
        action: 'snooze',
        ids: [id],
        id, // backward compatibility
        snoozeMinutes: minutes,
      };

      const result = await postReminderAction(payload);

      if (!result.ok) {
        console.error('Snooze failed', result.data);
        toast('Could not snooze this reminder.', { type: 'error' });
        return;
      }

      // optimistic UI: set snoozedUntil if we can infer it (then refresh silently)
      const optimisticUntil = new Date(Date.now() + minutes * 60_000).toISOString();
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, snoozedUntil: optimisticUntil } : r)));

      // ✅ Server truth wins
      void refreshRemindersSilent();
    } catch (err) {
      console.error('Error snoozing reminder', err);
      toast('Could not snooze this reminder.', { type: 'error' });
    }
  }

  // callbacks for ReminderList
  function handleListConfirm(r: ReminderShape) {
    const original = reminders.find((x) => x.id === r.id);
    if (!original) return;
    openConfirmDialog(original);
  }

  function handleListSnooze(r: ReminderShape, mins = 10) {
    if (!r.id) return;
    handleSnoozeById(r.id, mins);
  }

  /**
   * Tier 3 hook: notify native shell (iOS/Android) that alerts changed.
   * Mobile container can listen for this message and register native push tokens.
   */
  function notifyNativeShellAlerts(enabled: boolean) {
    if (typeof window === 'undefined') return;
    try {
      const payload = JSON.stringify({ type: 'reminder-alerts-updated', enabled });

      // React Native WebView bridge
      (window as any).ReactNativeWebView?.postMessage(payload);

      // Optional: WKWebView / other native bridges can hook here too
      (window as any).webkit?.messageHandlers?.reminderAlertsUpdated?.postMessage?.({ enabled });
    } catch (err) {
      console.error('Error notifying native shell about alerts change', err);
    }
  }

  // Alerts toggle (enable/disable in-tab scheduling + background web push)
  async function handleAlertsToggle() {
    if (!hasNotificationSupport()) {
      toast('Your browser does not support notifications.', { type: 'error' });
      return;
    }

    const notificationCtor = window.Notification;

    // Turning alerts OFF (in-tab + notify native shell)
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      scheduledIdsRef.current.clear();
      notifyNativeShellAlerts(false);
      toast(
        'Alerts turned off for this device. To fully stop browser notifications, use your browser settings.',
        { type: 'info' }
      );
      return;
    }

    // Helper to flip local state, notify native shell, and set up web push
    const enableAndSetupPush = async () => {
      setNotificationsEnabled(true);
      notifyNativeShellAlerts(true);
      toast('Notifications enabled. We’ll alert you when it’s time.', { type: 'success' });

      // Tier 2: register service worker + push subscription in the background.
      try {
        await ensureRemindersPushSubscription();
      } catch (err) {
        console.error('Error setting up push subscription', err);
        // Non-fatal: in-tab timers still work as fallback.
      }
    };

    // Turning alerts ON
    const currentPermission = notificationCtor.permission;
    if (currentPermission === 'granted') {
      await enableAndSetupPush();
      return;
    }

    try {
      const result = await notificationCtor.requestPermission();
      if (result === 'granted') {
        await enableAndSetupPush();
      } else if (result === 'denied') {
        toast('Notifications are blocked. You can enable them in your browser settings.', { type: 'error' });
      } else {
        toast('Notifications were not enabled.', { type: 'info' });
      }
    } catch (err) {
      console.error('Notification permission error', err);
      toast('Could not enable notifications.', { type: 'error' });
    }
  }

  // Local "alarm" scheduling in the browser (only while tab is open)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!notificationsEnabled) return;

    const hasNotification = hasNotificationSupport() && window.Notification.permission === 'granted';

    const now = new Date();
    const timers: number[] = [];

    reminders.forEach((r) => {
      if (r.status !== 'Pending') return;

      // ✅ Canonical effective time (dedupe safe)
      const effectiveIso =
        r.snoozedUntil || (r.time ? timeToIsoToday(r.time) : null);

      if (!effectiveIso) return;
      const key = `${r.id}:${effectiveIso}`;

      // Avoid double-scheduling the same reminder+time
      if (scheduledIdsRef.current.has(key)) return;

      const target = new Date(effectiveIso);
      if (Number.isNaN(target.getTime())) return;

      const delay = target.getTime() - now.getTime();

      // Only schedule future reminders within the next 24h
      if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;

      scheduledIdsRef.current.add(key);

      const timeoutId = window.setTimeout(() => {
        try {
          const title = r.name || 'Reminder';
          const bodyParts: string[] = [];

          if (r.dose) bodyParts.push(r.dose);

          const displayTime = r.snoozedUntil ? formatHHMMFromIso(r.snoozedUntil) : (r.time ?? '');
          if (displayTime) bodyParts.push(displayTime);

          const body = bodyParts.join(' · ');

          if (hasNotification) {
            // Browser notification
            // eslint-disable-next-line no-new
            new window.Notification(title, { body, tag: r.id });
          } else {
            // Fallback: in-app toast
            toast(`Time for: ${title}${body ? ` (${body})` : ''}`, { type: 'info' });
          }

          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              (navigator as any).vibrate?.(200);
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.error('Error firing local reminder notification', err);
        }
      }, delay);

      timers.push(timeoutId);
    });

    // Cleanup on re-run/unmount
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, [notificationsEnabled, reminders]);

  // Focus the first radio when confirm dialog opens
  useEffect(() => {
    if (confirming && confirmFirstRadioRef.current) {
      confirmFirstRadioRef.current.focus();
    }
  }, [confirming]);

  // Handle keyboard for dialog (Escape + basic focus trap)
  function handleDialogKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!confirming) return;

    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      closeConfirmDialog();
      return;
    }

    if (e.key === 'Tab' && confirmDialogRef.current) {
      const focusable = confirmDialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isShift = e.shiftKey;
      const active = document.activeElement as HTMLElement | null;

      if (!isShift && active === last) {
        e.preventDefault();
        first.focus();
      } else if (isShift && active === first) {
        e.preventDefault();
        last.focus();
      }
    }
  }

  // Quick actions: switch tab and scroll to the relevant form
  function goToTabAndScroll(
    tabId: TabId,
    target?: 'hydration' | 'exercise' | 'meditation' | 'sleep'
  ) {
    setActiveTab(tabId);
    if (target) setPendingScrollTarget(target);
  }

  useEffect(() => {
    if (!pendingScrollTarget) return;

    let el: HTMLElement | null = null;
    if (activeTab === 'hydration' && pendingScrollTarget === 'hydration') el = hydrationFormRef.current;
    if (activeTab === 'exercise' && pendingScrollTarget === 'exercise') el = exerciseFormRef.current;
    if (activeTab === 'meditation' && pendingScrollTarget === 'meditation') el = meditationFormRef.current;
    if (activeTab === 'sleep' && pendingScrollTarget === 'sleep') el = sleepFormRef.current;

    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setPendingScrollTarget(null);
  }, [activeTab, pendingScrollTarget]);

  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const totalReminders = reminders.length;
  const totalCompleted = overallStats.taken;
  const totalPending = overallStats.pending;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <ReminderHeader
        todayLabel={todayLabel}
        totalReminders={totalReminders}
        totalPending={totalPending}
        totalCompleted={totalCompleted}
        usedMock={usedMock}
        showAlertsInfo={showAlertsInfo}
        onToggleAlertsInfo={() => setShowAlertsInfo((v) => !v)}
        pillStatsPct={pillStats.pct}
        pillTrendAverage={pillTrendAverage}
        overallCompletionPct={overallCompletionPct}
        loading={loading}
        notificationsEnabled={notificationsEnabled}
        onRefresh={loadReminders}
        onToggleAlerts={handleAlertsToggle}
      />

      {/* Sticky Tabs */}
      <ReminderTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <section
          id="reminders-panel-overview"
          role="tabpanel"
          aria-labelledby="reminders-tab-overview"
          className="space-y-6"
        >
          {/* Quick actions row (polish: match shell language) */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur-xl p-4 text-xs shadow-sm shadow-black/[0.04]">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Quick actions
              </p>
              <p className="text-xs text-gray-600">
                Add new reminders for today or your routine.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => goToTabAndScroll('hydration', 'hydration')}
                className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span aria-hidden="true">💧</span>
                <span>+ Hydration</span>
              </button>
              <button
                type="button"
                onClick={() => goToTabAndScroll('exercise', 'exercise')}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span aria-hidden="true">🏋️</span>
                <span>+ Exercise</span>
              </button>
              <button
                type="button"
                onClick={() => goToTabAndScroll('meditation', 'meditation')}
                className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <span aria-hidden="true">🧘</span>
                <span>+ Meditation</span>
              </button>
              <button
                type="button"
                onClick={() => goToTabAndScroll('sleep', 'sleep')}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span aria-hidden="true">🌙</span>
                <span>+ Sleep</span>
              </button>
            </div>
          </div>

          {/* Overview / Today’s pills + Summary */}
          <section className="grid gap-4 md:grid-cols-2">
            <Section title="⚕️ Today's pills" subtitle="Tap to confirm or snooze." defaultOpen>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {error && <div className="mb-2 text-sm text-rose-600">{error}</div>}

                  {!error && todaysPills.length === 0 && (
                    <div className="text-sm text-gray-500">No pill reminders for today.</div>
                  )}

                  {!error && todaysPills.length > 0 && (
                    <div className="space-y-2">
                      {todaysPills.map((r) => (
                        <PillReminderCard
                          key={r.id}
                          med={{
                            name: r.name,
                            dose: r.dose ?? '',
                            time: r.time ?? '',
                            status: r.status,
                          }}
                          onConfirm={() => openConfirmDialog(r)}
                          onSnooze={() => handleSnoozeById(r.id, 15)}
                        />
                      ))}
                    </div>
                  )}

                  <p className="mt-3 text-xs text-gray-500">
                    You can create new medication reminders from the{' '}
                    <Link href="/medications" className="text-emerald-700 underline underline-offset-2">
                      Medications
                    </Link>{' '}
                    page.
                  </p>
                </>
              )}
            </Section>

            <Section title="📊 Today at a glance" subtitle="Snapshot of all reminders." defaultOpen>
              <div className="space-y-3 text-sm">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Active (pending) reminders</span>
                    <span className="font-semibold">{overallStats.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completed</span>
                    <span className="font-semibold">{overallStats.taken}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Marked missed</span>
                    <span className="font-semibold">{overallStats.missed}</span>
                  </div>
                </div>

                <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-emerald-50/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span aria-hidden="true">{getCategoryIcon('pill')}</span>
                        <span className="font-medium text-gray-800">Medication</span>
                      </div>
                      <span className="text-gray-600">{pillStats.pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      {pillStats.pending} pending · {pillStats.taken} completed · {pillStats.missed} missed
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-sky-50/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span aria-hidden="true">{getCategoryIcon('hydration')}</span>
                        <span className="font-medium text-gray-800">Hydration</span>
                      </div>
                      <span className="text-gray-600">{hydrationStats.pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      {hydrationStats.pending} pending · {hydrationStats.taken} completed · {hydrationStats.missed} missed
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-amber-50/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span aria-hidden="true">{getCategoryIcon('exercise')}</span>
                        <span className="font-medium text-gray-800">Exercise</span>
                      </div>
                      <span className="text-gray-600">{exerciseStats.pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      {exerciseStats.pending} pending · {exerciseStats.taken} completed · {exerciseStats.missed} missed
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-purple-50/70 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span aria-hidden="true">{getCategoryIcon('meditation')}</span>
                        <span className="font-medium text-gray-800">Meditation</span>
                      </div>
                      <span className="text-gray-600">{meditationStats.pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      {meditationStats.pending} upcoming · {meditationStats.taken} completed · {meditationStats.missed} missed
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-indigo-50/70 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span aria-hidden="true">{getCategoryIcon('sleep')}</span>
                        <span className="font-medium text-gray-800">Sleep</span>
                      </div>
                      <span className="text-gray-600">{sleepStats.pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      {sleepStats.pending} upcoming · {sleepStats.taken} completed · {sleepStats.missed} missed
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  When you confirm a reminder, you can log if it happened right now or earlier in the day so adherence statistics stay accurate.
                </p>

                <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white p-2">
                  <div className="mb-1 text-xs text-slate-500">Pill adherence trend (last 7 days)</div>
                  <Sparkline data={adherenceTrend} height={64} />
                </div>
              </div>
            </Section>
          </section>

          {/* All upcoming (all types) */}
          <Section
            title="⏰ All upcoming reminders"
            subtitle="Search and filter across ⚕️ medication, 💧 hydration, 🏋️ exercise, 🌙 sleep, and 🧘 meditation."
            defaultOpen
          >
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Search reminders
                    </label>
                    <input
                      type="search"
                      value={reminderSearch}
                      onChange={(e) => setReminderSearch(e.target.value)}
                      placeholder="Search by name, dose, or type…"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:border-emerald-400"
                    />
                  </div>
                  <div className="w-full md:w-52">
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Filter by type
                    </label>
                    <select
                      value={reminderFilterType}
                      onChange={(e) => setReminderFilterType(e.target.value as any)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:border-emerald-400"
                    >
                      <option value="all">All</option>
                      <option value="pill">⚕️ Medication</option>
                      <option value="hydration">💧 Hydration</option>
                      <option value="exercise">🏋️ Exercise</option>
                      <option value="meditation">🧘 Meditation</option>
                      <option value="sleep">🌙 Sleep</option>
                    </select>
                  </div>
                </div>

                {/* Legend for icons */}
                <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">{getCategoryIcon('pill')}</span>
                    <span>Medication</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">{getCategoryIcon('hydration')}</span>
                    <span>Hydration</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">{getCategoryIcon('exercise')}</span>
                    <span>Exercise</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">{getCategoryIcon('meditation')}</span>
                    <span>Meditation</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">{getCategoryIcon('sleep')}</span>
                    <span>Sleep</span>
                  </span>
                </div>

                {!filteredReminderShapes.length && (
                  <div className="text-sm text-gray-500">
                    No reminders found. Try adjusting your search or add reminders from your medication list or NexRing device.
                  </div>
                )}

                {filteredReminderShapes.length > 0 && (
                  <ReminderList
                    reminders={filteredReminderShapes}
                    onConfirm={handleListConfirm}
                    onSnooze={handleListSnooze}
                  />
                )}
              </>
            )}
          </Section>
        </section>
      )}

      {/* PILLS TAB */}
      {activeTab === 'pills' && (
        <PillsTab
          todaysPills={todaysPills}
          pillShapes={pillShapes}
          pillStats={pillStats}
          adherenceTrend={adherenceTrend}
          onOpenConfirm={openConfirmDialog}
          onSnoozeReminder={handleSnoozeById}
          onListConfirm={handleListConfirm}
          onListSnooze={handleListSnooze}
        />
      )}

      {/* HYDRATION TAB */}
      {activeTab === 'hydration' && (
        <HydrationTab
          stats={hydrationStats}
          reminders={hydrationShapes}
          onListConfirm={handleListConfirm}
          onListSnooze={handleListSnooze}
          onRemindersCreated={loadReminders}
          formRef={hydrationFormRef}
        />
      )}

      {/* EXERCISE TAB */}
      {activeTab === 'exercise' && (
        <ExerciseTab
          stats={exerciseStats}
          reminders={exerciseShapes}
          onListConfirm={handleListConfirm}
          onListSnooze={handleListSnooze}
          onRemindersCreated={loadReminders}
          formRef={exerciseFormRef}
        />
      )}

      {/* MEDITATION TAB */}
      {activeTab === 'meditation' && (
        <MeditationTab
          stats={meditationStats}
          reminders={meditationShapes}
          onListConfirm={handleListConfirm}
          onListSnooze={handleListSnooze}
          onRemindersCreated={loadReminders}
          formRef={meditationFormRef}
        />
      )}

      {/* SLEEP TAB */}
      {activeTab === 'sleep' && (
        <SleepTab
          stats={sleepStats}
          reminders={sleepShapes}
          onListConfirm={handleListConfirm}
          onListSnooze={handleListSnooze}
          onRemindersCreated={loadReminders}
          formRef={sleepFormRef}
        />
      )}

      {/* Confirm modal (shared across tabs) */}
      {confirming && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Log this reminder"
          onKeyDown={handleDialogKeyDown}
        >
          <div
            ref={confirmDialogRef}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-xl shadow-black/10"
          >
            <header className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-950">Log this reminder</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {confirming.name}{' '}
                  {confirming.dose ? <span className="text-slate-500">· {confirming.dose}</span> : null}
                </p>
              </div>

              <button
                type="button"
                onClick={closeConfirmDialog}
                className="h-10 w-10 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="space-y-4 px-5 py-5 text-sm">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  When did it happen?
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      ref={confirmFirstRadioRef}
                      type="radio"
                      className="h-4 w-4"
                      checked={confirmMode === 'now'}
                      onChange={() => setConfirmMode('now')}
                    />
                    <span>Right now</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="h-4 w-4"
                      checked={confirmMode === 'earlier'}
                      onChange={() => setConfirmMode('earlier')}
                    />
                    <span className="flex flex-wrap items-center gap-2">
                      Earlier today at
                      <input
                        type="time"
                        value={confirmTime}
                        onChange={(e) => setConfirmTime(e.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:border-emerald-400"
                      />
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4">
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={confirmBusy}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyConfirm}
                disabled={confirmBusy}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
              >
                {confirmBusy ? 'Saving…' : 'Confirm'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
