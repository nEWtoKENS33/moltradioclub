"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "chill" | "hype" | "dark";

export default function WebAudioPlayer({ mode = "dark" }: { mode?: Mode }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(92);
  const [intensity, setIntensity] = useState(0.6); // 0..1

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getCtx() {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    return ctxRef.current!;
  }

  function scheduleStep(step: number) {
    const ctx = getCtx();
    const master = masterRef.current!;
    const t = ctx.currentTime;

    const beat = step % 16;
    const isDark = mode === "dark";
    const isHype = mode === "hype";

    // Kick (0, 8)
    if (beat === 0 || beat === 8) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.08);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.8 * intensity, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      o.connect(g);
      g.connect(master);

      o.start(t);
      o.stop(t + 0.15);
    }

    // Snare (4, 12)
    if (beat === 4 || beat === 12) {
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = isDark ? 900 : 1800;
      filter.Q.value = 0.8;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * intensity, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      noise.connect(filter);
      filter.connect(g);
      g.connect(master);

      noise.start(t);
      noise.stop(t + 0.12);
    }

    // Hi-hat
    const hatEvery = isHype ? 1 : 2;
    if (beat % hatEvery === 0) {
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15 * intensity, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

      noise.connect(hp);
      hp.connect(g);
      g.connect(master);

      noise.start(t);
      noise.stop(t + 0.04);
    }

    // Ambient pad each bar
    if (beat === 0) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();

      o.type = "sawtooth";
      o.frequency.value = isDark ? 110 : 220;

      f.type = "lowpass";
      f.frequency.value = 650;

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08 * intensity, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);

      o.connect(f);
      f.connect(g);
      g.connect(master);

      o.start(t);
      o.stop(t + 1.7);
    }
  }

  function start() {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();

    setIsPlaying(true);

    let step = 0;
    const intervalMs = (60_000 / bpm) / 4; // 16th notes

    scheduleStep(step++);

    timerRef.current = window.setInterval(() => {
      scheduleStep(step++);
    }, intervalMs);
  }

  function stop() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }

  return (
    <div className="card">
      <div className="rowBetween">
        <h2 className="h2">Claw Radio Synth</h2>
        <div className="pill">{mode.toUpperCase()}</div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={isPlaying ? stop : start}>
          {isPlaying ? "STOP" : "PLAY"}
        </button>

        <div className="small">BPM</div>
        <input
          className="input"
          style={{ width: 110 }}
          type="number"
          min={60}
          max={160}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
        />

        <div className="small">Intensity</div>
        <input
          style={{ width: 180 }}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
        />
      </div>

      <p className="p" style={{ marginTop: 10 }}>
        Generated audio. Perfect for testing the station vibe.
      </p>
    </div>
  );
}
