'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type RecordingResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  egressId?: string | null;
  filepath?: string | null;
  s3Prefix?: string | null;
  recording?: any;
  recordings?: any[];
};

function formatBytes(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function statusText(recording: any) {
  return String(recording?.status || recording?.recording?.status || 'UNKNOWN');
}

function recordingKey(roomId: string) {
  return `ambulant.training.recording.egress.${roomId}`;
}

function isCompleteStatus(status: string) {
  return ['EGRESS_COMPLETE', 'EGRESS_FAILED', 'EGRESS_ABORTED', 'EGRESS_LIMIT_REACHED'].includes(status);
}

export default function RecordingControls({
  roomId,
  trainingSlotId,
  liveRoomUrl,
}: {
  roomId: string;
  trainingSlotId: string;
  liveRoomUrl: string;
}) {
  const [busy, setBusy] = useState<'start' | 'stop' | 'refresh' | null>(null);
  const [egressId, setEgressId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [recordings, setRecordings] = useState<any[]>([]);

  const storageKey = useMemo(() => recordingKey(roomId), [roomId]);

  const activeRecording = useMemo(() => {
    const bySavedId = recordings.find((r) => String(r?.egressId || '') === egressId);
    if (bySavedId && !isCompleteStatus(statusText(bySavedId))) return bySavedId;

    return recordings.find((r) => !isCompleteStatus(statusText(r))) || null;
  }, [recordings, egressId]);

  const activeEgressId = String(activeRecording?.egressId || egressId || '').trim();

  const callJson = async (url: string, init?: RequestInit): Promise<RecordingResponse> => {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });

    const text = await res.text();
    let data: RecordingResponse = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, error: text || res.statusText };
    }

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    }

    return data;
  };

  const refresh = useCallback(async () => {
    setBusy('refresh');
    setNotice(null);

    try {
      const data = await callJson(
        `/api/admin/training/recordings/list?roomId=${encodeURIComponent(roomId)}`,
      );

      const list = Array.isArray(data.recordings) ? data.recordings : [];
      setRecordings(list);

      const active = list.find((r) => !isCompleteStatus(statusText(r)));
      if (active?.egressId) {
        const id = String(active.egressId);
        setEgressId(id);
        localStorage.setItem(storageKey, id);
      } else {
        const saved = localStorage.getItem(storageKey) || '';
        if (saved) setEgressId(saved);
      }
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Unable to refresh recordings.' });
    } finally {
      setBusy(null);
    }
  }, [roomId, storageKey]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || '';
    if (saved) setEgressId(saved);
    refresh();
  }, [refresh, storageKey]);

  const startRecording = async () => {
    setBusy('start');
    setNotice(null);

    try {
      const data = await callJson('/api/admin/training/recordings/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomId,
          layout: 'grid',
        }),
      });

      const id = String(data.egressId || data.recording?.egressId || '').trim();

      if (!id) {
        throw new Error('Recording started but egressId was not returned.');
      }

      setEgressId(id);
      localStorage.setItem(storageKey, id);
      setNotice({
        tone: 'ok',
        text: `Recording started: ${id}`,
      });

      await refresh();
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Unable to start recording.' });
    } finally {
      setBusy(null);
    }
  };

  const stopRecording = async () => {
    const id = activeEgressId;

    if (!id) {
      setNotice({ tone: 'err', text: 'No active egressId found to stop.' });
      return;
    }

    setBusy('stop');
    setNotice(null);

    try {
      await callJson('/api/admin/training/recordings/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ egressId: id }),
      });

      localStorage.removeItem(storageKey);
      setEgressId('');
      setNotice({
        tone: 'ok',
        text: `Recording stop requested: ${id}`,
      });

      await refresh();
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Unable to stop recording.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-black text-slate-950">
            Training recording controls
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Start and stop secure LiveKit room-composite recording for this cohort room. Recordings are stored in the private Ambulant+ S3 recording bucket.
          </p>

          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <span className="font-bold text-slate-800">Room:</span>{' '}
              <span className="font-mono">{roomId}</span>
            </div>
            <div>
              <span className="font-bold text-slate-800">Slot:</span>{' '}
              <span className="font-mono">{trainingSlotId}</span>
            </div>
            <div>
              <span className="font-bold text-slate-800">Active egress:</span>{' '}
              <span className="font-mono">{activeEgressId || '—'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-800">Status:</span>{' '}
              {activeRecording ? statusText(activeRecording) : 'No active recording'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={liveRoomUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            Open room
          </a>

          <button
            type="button"
            onClick={refresh}
            disabled={busy !== null}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {busy === 'refresh' ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={startRecording}
            disabled={busy !== null || Boolean(activeRecording)}
            className="inline-flex rounded-xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy === 'start' ? 'Starting...' : 'Start recording'}
          </button>

          <button
            type="button"
            onClick={stopRecording}
            disabled={busy !== null || !activeEgressId}
            className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy === 'stop' ? 'Stopping...' : 'Stop recording'}
          </button>
        </div>
      </div>

      {notice ? (
        <div
          className={
            notice.tone === 'ok'
              ? 'mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900'
              : notice.tone === 'err'
                ? 'mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800'
                : 'mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900'
          }
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-950">
          Recent room recordings
        </div>

        {recordings.length === 0 ? (
          <div className="px-4 py-4 text-sm text-slate-500">
            No recordings returned yet for this room.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recordings.slice(0, 6).map((r) => {
              const id = String(r?.egressId || 'unknown');
              const file = r?.file || {};
              const filename = String(file?.filename || r?.roomComposite?.file?.filepath || '');
              const size = formatBytes(file?.size);
              const status = statusText(r);

              return (
                <div key={id} className="px-4 py-3 text-sm">
                  <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{id}</div>
                      <div className="mt-1 text-xs text-slate-500 break-all">{filename || 'No file path yet'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-bold text-slate-700">
                        {status}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                        {size}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Raw S3 object URLs are intentionally private. Secure download links should be issued server-side when the recording library/download page is added.
      </p>
    </section>
  );
}
