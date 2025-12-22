// apps/patient-app/src/devices/analyser.ts
import { getAudioContext } from '@/src/devices/audioCtx';

let analyser: AnalyserNode | null = null;
let gain: GainNode | null = null;

export function attachAnalyserFromStream(
  stream: MediaStream,
  { startMuted = true }: { startMuted?: boolean } = {}
) {
  const ctx = getAudioContext();
  const src = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  gain = ctx.createGain();
  gain.gain.value = startMuted ? 0.0 : 1.0;

  src.connect(analyser);
  analyser.connect(gain);
  gain.connect(ctx.destination);
}

export function setOutputVolume(v: number) {
  if (gain) gain.gain.value = v; // 0 = silent
}

export function drawWaveform(canvas: HTMLCanvasElement) {
  if (!analyser) return;
  const ctx2d = canvas.getContext('2d')!;
  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);

  const draw = () => {
    requestAnimationFrame(draw);
    analyser!.getByteTimeDomainData(data);

    const { width, height } = canvas;
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();

    const slice = width / bufLen;
    for (let i = 0; i < bufLen; i++) {
      const x = i * slice;
      const v = data[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.lineTo(width, height / 2);
    ctx2d.stroke();
  };
  draw();
}
