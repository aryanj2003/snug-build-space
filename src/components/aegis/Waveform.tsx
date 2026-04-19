import { memo, useEffect, useRef } from "react";

interface Props {
  active: boolean;
  height?: number;
}

/**
 * Cyan industrial waveform. Uses mic input when `active`, otherwise renders
 * an idle shimmer so the canvas isn't empty pre-call.
 */
export const Waveform = memo(function Waveform({ active, height = 72 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDrawTimeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!active) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new Ctor();
        ctxRef.current = audioCtx;
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
      } catch {
        // mic denied — fall back to idle shimmer
      }
    }

    setup();
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function draw(timestamp: number) {
    // Frame-skipping: only draw when ≥33ms have elapsed (~30fps)
    if (timestamp - lastDrawTimeRef.current < 33) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    lastDrawTimeRef.current = timestamp;

    const cvs = canvasRef.current;
    if (!cvs) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = cvs.clientWidth;
    const H = cvs.clientHeight;
    if (cvs.width !== W * dpr || cvs.height !== H * dpr) {
      cvs.width = W * dpr;
      cvs.height = H * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, W, H);

    // grid baseline
    ctx.strokeStyle = "rgba(34, 211, 238, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    const analyser = analyserRef.current;
    const barCount = 64;
    const barW = W / barCount;
    const data = new Uint8Array(analyser?.frequencyBinCount ?? barCount);
    if (analyser) analyser.getByteFrequencyData(data);

    // Create gradient once for all bars (reused across the loop)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(34, 211, 238, 0.95)");
    grad.addColorStop(1, "rgba(34, 211, 238, 0.45)");
    ctx.fillStyle = grad;

    // Set shadow once before the loop instead of per-bar
    ctx.shadowColor = "rgba(34, 211, 238, 0.6)";
    ctx.shadowBlur = 6;

    for (let i = 0; i < barCount; i++) {
      let amp: number;
      if (analyser) {
        amp = (data[i] ?? 0) / 255;
      } else {
        // idle shimmer
        const t = Date.now() / 600;
        amp = 0.06 + 0.04 * Math.sin(t + i * 0.4) + 0.03 * Math.sin(t * 2.1 + i);
      }
      const h = Math.max(2, amp * H * 0.9);
      const x = i * barW + barW * 0.15;
      const y = (H - h) / 2;

      ctx.fillRect(x, y, barW * 0.7, h);
    }
    ctx.shadowBlur = 0;

    rafRef.current = requestAnimationFrame(draw);
  }

  return (
    <div className="relative w-full overflow-hidden rounded-sm border border-primary/20 bg-slate-950/60" style={{ height }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="scan-line" />
    </div>
  );
});
