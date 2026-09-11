import { useEffect, useRef, useState } from "react";
import "./App.css";
import { blip, setAudioEnabled, unlockAudio } from "./audio/blip";
import {
  clickDownload,
  frameAt,
  MotionTape,
  recordWebm,
  type TapeFile,
  webmSupported,
} from "./export/tape";
import {
  applyImpulse,
  applySnapshot,
  clearGrab,
  createJelly,
  layoutJelly,
  setGrab,
  snapshotPoints,
  stepJelly,
} from "./jelly/physics";
import { drawJelly, tintFromFeel } from "./jelly/renderer";
import type { Feel } from "./rpc/feel";
import { feelFromProbe } from "./rpc/feel";
import { RpcSession } from "./rpc/session";
import { Hud } from "./ui/Hud";
import { Replay } from "./ui/Replay";

const IDLE_MS = 1600;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jellyRef = useRef(createJelly());
  const sessionRef = useRef(new RpcSession());
  const tapeRef = useRef(new MotionTape());
  const feelRef = useRef<Feel | null>(null);
  const replayRef = useRef<TapeFile | null>(null);
  const replayTRef = useRef(0);
  const playingRef = useRef(false);
  const filmingRef = useRef(false);

  const [hudTick, setHudTick] = useState(0);
  const [hoppedNote, setHoppedNote] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [replay, setReplay] = useState<TapeFile | null>(null);
  const [replayT, setReplayT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [filming, setFilming] = useState(false);
  const [canWebm] = useState(() => webmSupported());

  const bumpHud = () => setHudTick((n) => n + 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const jelly = jellyRef.current;
    const session = sessionRef.current;
    const tape = tapeRef.current;
    let raf = 0;
    let last = performance.now();
    let hudAccum = 0;
    let idleAccum = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      layoutJelly(jelly, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const pointFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const fire = async (reason: "poke" | "idle") => {
      jelly.waiting = true;
      bumpHud();
      const { result, hopped } = await session.fire(reason);
      jelly.waiting = session.inflight;
      if (!result) {
        bumpHud();
        return;
      }
      if (hopped) {
        setHoppedNote(`hopped → ${session.current().name}`);
      }
      const feel = feelFromProbe(result.rttMs, result.status);
      feelRef.current = feel;
      jelly.damping = feel.damping;
      jelly.stiffnessScale = feel.stiffness;
      applyImpulse(jelly, feel.kind, feel.strength);
      if (feel.sour) blip("sour");
      else if (feel.kind === "tight") blip("tick");
      bumpHud();
    };

    const onDown = (e: PointerEvent) => {
      if (replayRef.current) return;
      if ((e.target as HTMLElement | null)?.closest?.(".hud, .replay, .chrome")) {
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      unlockAudio();
      const p = pointFromEvent(e);
      setGrab(jelly, p.x, p.y);
      void fire("poke");
    };
    const onMove = (e: PointerEvent) => {
      if (!jelly.grab) return;
      const p = pointFromEvent(e);
      setGrab(jelly, p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      clearGrab(jelly);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const tapeFile = replayRef.current;
      if (tapeFile) {
        if (playingRef.current) {
          replayTRef.current += dt * 1000;
          const max = tapeFile.frames[tapeFile.frames.length - 1].t;
          if (replayTRef.current > max) {
            replayTRef.current = max;
            playingRef.current = false;
            setPlaying(false);
          }
        }
        const frame = frameAt(tapeFile.frames, replayTRef.current);
        if (frame) {
          applySnapshot(jelly, frame.pts);
          const tint = tintFromFeel(frame.rtt, frame.sour, false);
          drawJelly(ctx, jelly, tint, dpr);
        }
      } else {
        stepJelly(jelly, dt);
        const lastR = session.last;
        const tint = tintFromFeel(
          lastR?.rttMs ?? null,
          feelRef.current?.sour ?? false,
          jelly.waiting,
        );
        drawJelly(ctx, jelly, tint, dpr);
        tape.push(
          now,
          snapshotPoints(jelly),
          lastR?.rttMs ?? null,
          lastR?.slot ?? null,
          feelRef.current,
        );

        idleAccum += dt * 1000;
        if (idleAccum >= IDLE_MS + (Math.random() * 400 - 120)) {
          idleAccum = 0;
          if (session.idleAllowed()) void fire("idle");
        }
      }

      hudAccum += dt;
      if (hudAccum > 0.28) {
        hudAccum = 0;
        if (replayRef.current) setReplayT(replayTRef.current);
        else bumpHud();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const session = sessionRef.current;
  const endpoint = session.current();

  const exportTape = () => {
    const file = tapeRef.current.toFile(endpoint.url, session.samples);
    if (file.frames.length < 4) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    clickDownload(`rpcjelly-${stamp}.json`, blob);
    openReplay(file);
  };

  const openReplay = (file: TapeFile) => {
    replayRef.current = file;
    replayTRef.current = 0;
    playingRef.current = true;
    setReplay(file);
    setReplayT(0);
    setPlaying(true);
    layoutJelly(jellyRef.current, window.innerWidth, window.innerHeight, true);
  };

  const closeReplay = () => {
    replayRef.current = null;
    playingRef.current = false;
    setReplay(null);
    setPlaying(false);
    layoutJelly(jellyRef.current, window.innerWidth, window.innerHeight, true);
  };

  const onLoadTape = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as TapeFile;
      if (parsed.v !== 1 || !parsed.frames?.length) return;
      openReplay(parsed);
    } catch {
      /* ignore junk files */
    }
  };

  const film = async () => {
    const canvas = canvasRef.current;
    if (!canvas || filmingRef.current) return;
    filmingRef.current = true;
    setFilming(true);
    try {
      const blob = await recordWebm(canvas, 6500);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      clickDownload(`rpcjelly-${stamp}.webm`, blob);
    } catch {
      // JSON tape is the reliable path; WebM is opportunistic
    } finally {
      filmingRef.current = false;
      setFilming(false);
    }
  };

  const hop = () => {
    const next = sessionRef.current.hop();
    setHoppedNote(`manual hop → ${next.name}`);
    bumpHud();
  };

  void hudTick;

  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" />
      <div className="chrome">
        <div className="brand">
          <h1>rpcjelly</h1>
          <p>poke it. getSlot RTT is the wobble. idle pulse ~1.5s.</p>
        </div>
        <div className="tools">
          <button type="button" onClick={exportTape}>
            save tape
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            load tape
          </button>
          {canWebm && (
            <button type="button" onClick={() => void film()} disabled={filming}>
              {filming ? "filming…" : "film 6s"}
            </button>
          )}
          <button
            type="button"
            className={soundOn ? "active" : ""}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setAudioEnabled(next);
              if (next) unlockAudio();
            }}
          >
            {soundOn ? "sound" : "muted"}
          </button>
        </div>
      </div>
      <Hud
        last={session.last}
        samples={session.samples}
        endpointName={endpoint.name}
        endpointUrl={endpoint.url}
        waiting={session.inflight}
        hoppedNote={hoppedNote}
        onHop={hop}
      />
      <Replay
        tape={replay}
        playing={playing}
        t={replayT}
        onToggle={() => {
          playingRef.current = !playingRef.current;
          setPlaying(playingRef.current);
        }}
        onScrub={(t) => {
          replayTRef.current = t;
          playingRef.current = false;
          setPlaying(false);
          setReplayT(t);
        }}
        onClose={closeReplay}
      />
      <input
        ref={fileRef}
        className="hidden-file"
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onLoadTape(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
