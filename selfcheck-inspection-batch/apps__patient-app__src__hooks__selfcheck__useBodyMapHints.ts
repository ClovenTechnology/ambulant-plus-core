'use client';

import { useMemo } from 'react';
import type { BodyArea } from '@/components/selfcheck/BodyMap2D';

type Vital = { key: string; value: any };

export type BodyHintTone = 'info' | 'warn' | 'danger';

export type BodyHint = {
  tone: BodyHintTone;
  title: string;
  body: string;
  basedOn?: string; // short evidence line
};

function num(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getVitalNumber(vitals: Vital[], key: string): number | null {
  const v = vitals.find((x) => x.key === key)?.value;
  return num(v);
}

function parseSystolic(bp: any): number | null {
  if (typeof bp === 'string' && bp.includes('/')) {
    const s = Number(bp.split('/')[0]?.trim());
    return Number.isFinite(s) ? s : null;
  }
  return null;
}

function pick<T>(...vals: Array<T | null | undefined>): T | null {
  for (const v of vals) if (v != null) return v;
  return null;
}

export default function useBodyMapHints(args: {
  vitals: Vital[];
  symptoms: Record<string, boolean>;
}) {
  const { vitals, symptoms } = args;

  const signals = useMemo(() => {
    const hr = pick(getVitalNumber(vitals, 'hr'), getVitalNumber(vitals, 'heart_rate'));
    const spo2 = pick(getVitalNumber(vitals, 'spo2'));
    const temp = pick(getVitalNumber(vitals, 'temp'), getVitalNumber(vitals, 'temperature'));
    const bpRaw = vitals.find((v) => v.key === 'bp')?.value;
    const systolic = pick(parseSystolic(bpRaw), getVitalNumber(vitals, 'systolic'));

    const fever = Boolean(symptoms['fever']) || (temp != null && temp >= 37.8);
    const cough = Boolean(symptoms['cough']);
    const sob = Boolean(symptoms['sob']);
    const dizzy = Boolean(symptoms['dizzy']);
    const fatigue = Boolean(symptoms['fatigue']);

    const highHr = hr != null && hr >= 100;
    const veryHighHr = hr != null && hr >= 120;

    const lowSpo2 = spo2 != null && spo2 < 94;
    const veryLowSpo2 = spo2 != null && spo2 < 92;

    const highBp = systolic != null && systolic >= 140;

    return {
      hr,
      spo2,
      temp,
      systolic,
      fever,
      cough,
      sob,
      dizzy,
      fatigue,
      highHr,
      veryHighHr,
      lowSpo2,
      veryLowSpo2,
      highBp,
    };
  }, [vitals, symptoms]);

  const basedOnLine = useMemo(() => {
    const bits: string[] = [];
    if (signals.hr != null) bits.push(`HR ${Math.round(signals.hr)} bpm`);
    if (signals.spo2 != null) bits.push(`SpO₂ ${Math.round(signals.spo2)}%`);
    if (signals.temp != null) bits.push(`Temp ${signals.temp.toFixed(1)}°C`);
    if (signals.systolic != null) bits.push(`BP ${Math.round(signals.systolic)}/…`);
    if (signals.fatigue) bits.push('fatigue');
    if (signals.dizzy) bits.push('dizziness');
    if (signals.sob) bits.push('shortness of breath');
    if (signals.fever) bits.push('fever');
    return bits.length ? `Based on: ${bits.slice(0, 4).join(' • ')}` : undefined;
  }, [signals]);

  function getHint(arg: { area: BodyArea; side: 'front' | 'back' }): BodyHint | null {
    const { area, side } = arg;

    // Global “red flag” style guidance (kept general + safe)
    if ((signals.veryLowSpo2 || (signals.sob && signals.veryHighHr)) && (area === 'shoulders' || area === 'upper_back')) {
      return {
        tone: 'danger',
        title: 'Breathing + strain signal',
        body:
          'If you feel chest tightness, worsening breathing, fainting, or severe weakness, get urgent medical help. Otherwise, pause activity and re-check after 5–10 minutes of rest.',
        basedOn: basedOnLine,
      };
    }

    // Area-smart hints
    switch (area) {
      case 'shoulders':
      case 'upper_back': {
        const tone: BodyHintTone =
          (signals.fever && signals.fatigue) || signals.highHr ? 'warn' : 'info';

        const title = side === 'back' ? 'Upper back tension' : 'Shoulder tension';
        const body =
          signals.fever
            ? 'Body aches can show up here with fever. Hydrate, rest, and re-check temperature later.'
            : signals.highHr
            ? 'High heart rate can pair with tension/stress. Try slow breathing (4-second inhale, 6-second exhale) for 2 minutes.'
            : 'Common with posture, long screen time, or stress. Do a gentle stretch + shoulder rolls, then re-check how it feels.';
        return { tone, title, body, basedOn: basedOnLine };
      }

      case 'lower_back': {
        const tone: BodyHintTone = signals.fever ? 'warn' : 'info';
        return {
          tone,
          title: 'Lower back comfort',
          body:
            signals.fever
              ? 'Aches can spike with fever. Rest + fluids can help. If pain becomes severe or unusual, check with a clinician.'
              : 'Often posture/strain-related. Try a short walk, gentle hip hinge stretch, and avoid heavy lifting for now.',
          basedOn: basedOnLine,
        };
      }

      case 'biceps':
      case 'forearms': {
        const tone: BodyHintTone = signals.highHr ? 'warn' : 'info';
        return {
          tone,
          title: area === 'biceps' ? 'Arm strain check' : 'Forearm strain check',
          body:
            signals.highHr
              ? 'If your HR is elevated, avoid extra exertion. Hydrate and give it 10–15 minutes before you push again.'
              : 'Often from lifting, gripping, or repetitive use. If it’s new, reduce load and see if it settles after rest.',
          basedOn: basedOnLine,
        };
      }

      case 'abs':
      case 'side_abs': {
        const tone: BodyHintTone = signals.dizzy || signals.fever ? 'warn' : 'info';
        return {
          tone,
          title: area === 'abs' ? 'Core discomfort' : 'Side/core discomfort',
          body:
            signals.fever
              ? 'If you’re feverish, muscle aches and cramps can show up around the core. Rest + fluids, and re-check later.'
              : signals.dizzy
              ? 'Dizziness can come from dehydration or low energy. Sip water and sit down briefly, then re-check.'
              : 'Could be posture or activity related. Avoid intense core work for now; re-check after rest.',
          basedOn: basedOnLine,
        };
      }

      case 'quadriceps':
      case 'calves':
      case 'glutes': {
        const tone: BodyHintTone = signals.fatigue || signals.highHr ? 'warn' : 'info';
        return {
          tone,
          title:
            area === 'quadriceps'
              ? 'Leg fatigue check'
              : area === 'calves'
              ? 'Calf tightness check'
              : 'Glute/hip tension',
          body:
            signals.fatigue || signals.highHr
              ? 'If you feel run-down or your HR is elevated, go easy. Hydrate and try a short gentle stretch, then re-check.'
              : 'Often from walking/exercise. If you notice unusual swelling, redness, or severe pain, don’t ignore it—get checked.',
          basedOn: basedOnLine,
        };
      }

      default:
        return { tone: 'info', title: 'Body signal', body: 'Noted. We’ll include this in your check.', basedOn: basedOnLine };
    }
  }

  return getHint;
}
