'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@/components/toast';

type VerifyStep =
  | 'pill-visible'
  | 'open-mouth'
  | 'ingest'
  | 'swallow'
  | 'closed-mouth'
  | 'done';

const STEP_ORDER: VerifyStep[] = [
  'pill-visible',
  'open-mouth',
  'ingest',
  'swallow',
  'closed-mouth',
  'done',
];

const STEP_LABELS: Record<Exclude<VerifyStep, 'done'>, string> = {
  'pill-visible': 'Show pill to camera',
  'open-mouth': 'Show open mouth baseline',
  'ingest': 'Bring water / pill to mouth',
  'swallow': 'Swallow clearly on camera',
  'closed-mouth': 'Show closed mouth after swallow',
};

const MAX_SECONDS = 60;

function sanitizeReturnTo(value: string | null): string {
  const trimmed = String(value || '').trim();

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/reminder';
  }

  return trimmed;
}

function ReminderVerifyPageContent() {
  const params = useSearchParams();
  const router = useRouter();

  const reminderId = useMemo(() => params?.get('reminderId')?.trim() ?? '', [params]);
  const sessionId = useMemo(() => params?.get('sessionId')?.trim() ?? '', [params]);
  const returnTo = useMemo(() => sanitizeReturnTo(params?.get('returnTo') ?? null), [params]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [snapshots, setSnapshots] = useState<Array<{ step: string; dataUrl: string; capturedAt: string }>>([]);
  const [stepTrace, setStepTrace] = useState<Array<{ step: string; completedAt: string }>>([]);

  const currentStep = useMemo(() => STEP_ORDER[stepIndex], [stepIndex]);
  const isDone = currentStep === 'done';

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera access is not available in this browser or context.');
          setCameraReady(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 540 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setCameraReady(true);
        setCameraError(null);
      } catch (err) {
        console.error('camera start error', err);
        setCameraError('Could not access the camera on this device/browser.');
        setCameraReady(false);
      }
    }

    if (!reminderId || !sessionId) {
      setCameraError('Missing reminderId or sessionId.');
      return;
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [reminderId, sessionId]);

  useEffect(() => {
    if (!cameraReady || isDone || busy) return;

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          toast('Verification timed out. Please restart.', { type: 'error' });
          router.replace(returnTo);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [cameraReady, isDone, busy, router, returnTo]);

  function captureSnapshot(step: string) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const targetWidth = 320;
    const targetHeight = Math.max(180, Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * targetWidth));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.45);
  }

  function completeCurrentStep() {
    if (isDone) return;

    const step = currentStep as Exclude<VerifyStep, 'done'>;
    const capturedAt = new Date().toISOString();
    const dataUrl = captureSnapshot(step);

    if (dataUrl) {
      setSnapshots((prev) => [...prev, { step, dataUrl, capturedAt }]);
    }

    setStepTrace((prev) => [...prev, { step, completedAt: capturedAt }]);
    setStepIndex((prev) => Math.min(prev + 1, STEP_ORDER.length - 1));
  }

  function goBackOneStep() {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }

  async function finishVerification() {
    if (!reminderId || !sessionId) {
      toast('Missing reminder/session details.', { type: 'error' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/medication-verifications/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reminderId,
          sessionId,
          takenAt: new Date().toISOString(),
          stepTrace: {
            steps: stepTrace,
            completedLocally: true,
            secondsRemainingAtComplete: secondsLeft,
          },
          proofManifest: {
            captureMode: 'guided_camera_sequence',
            offlineSafe: true,
            snapshots: snapshots.map((s) => ({
              step: s.step,
              capturedAt: s.capturedAt,
              dataUrl: s.dataUrl,
            })),
          },
          meta: {
            platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            recordingBadgeShown: true,
            countdownStartedAtSeconds: MAX_SECONDS,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast(data?.error || 'Could not complete verification.', { type: 'error' });
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      toast('Medication verified and recorded.', { type: 'success' });
      router.replace(returnTo);
      router.refresh();
    } catch (err) {
      console.error('finish verification error', err);
      toast('Network error completing verification.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-p-ui="patient-reminder-verify-page" className="min-w-0 overflow-x-clip mx-auto max-w-5xl p-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Medication verification
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Camera-guided dose verification
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Complete the sequence continuously on camera. If the medication was already taken earlier,
              go back and use the earlier-taken action instead of re-taking a dose.
            </p>
          </div>

          <Link
            href={returnTo}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exit
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-black p-4 shadow-sm">
          <div className="relative overflow-hidden rounded-2xl bg-slate-950 aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            <canvas ref={canvasRef} className="hidden" />

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                {cameraError ? cameraError : 'Starting camera…'}
              </div>
            )}

            {cameraReady && (
              <>
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white shadow">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  REC
                </div>

                <div className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">
                  {secondsLeft}s
                </div>
              </>
            )}

            {cameraReady && !isDone && (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/60 px-4 py-3 text-white backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-emerald-300">
                  Current step
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {STEP_LABELS[currentStep as Exclude<VerifyStep, 'done'>]}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Checklist</div>
            <div className="mt-2 space-y-2">
              {STEP_ORDER.filter((s) => s !== 'done').map((step, idx) => {
                const done = idx < stepIndex;
                const active = idx === stepIndex && !isDone;

                return (
                  <div
                    key={step}
                    className={`rounded-2xl border px-3 py-2 text-sm ${
                      done
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : active
                        ? 'border-sky-200 bg-sky-50 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Do not continue here if the patient already took the medication earlier and re-taking would risk overdosing.
          </div>

          {snapshots.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">Captured proof snapshots</div>
              <div className="grid grid-cols-2 gap-2">
                {snapshots.map((s, i) => (
                  <div key={`${s.step}-${i}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img src={s.dataUrl} alt={s.step} className="h-20 w-full object-cover" />
                    <div className="px-2 py-1 text-[10px] text-slate-600">{s.step}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isDone ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goBackOneStep}
                disabled={stepIndex === 0 || busy}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={completeCurrentStep}
                disabled={!cameraReady || busy}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Capture step
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={finishVerification}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Saving verification…' : 'Finish verification'}
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function ReminderVerifyPage() {
  return (
    <Suspense
      fallback={
        <main data-p-ui="patient-reminder-verify-page" className="min-w-0 overflow-x-clip mx-auto max-w-5xl p-6 text-sm text-slate-600">
          Loading medication verification…
        </main>
      }
    >
      <ReminderVerifyPageContent />
    </Suspense>
  );
}
