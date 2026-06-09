import React from "react";
import { AbsoluteFill, Easing, random } from "remotion";
import { MONO, W, H } from "../simply/theme";
import { ReelBeat, ipl } from "../simply/helpers";
import manifest from "../simply/beats.json";

// ════════════════════════════════════════════════════════════════════════════
//  CAMERA — one camera flying forward through scene planes hung in a void.
//  No CSS perspective: for a fronto-parallel plane, perspective projection IS
//  uniform 2D scale → scale = FOCAL / (z_plane - z_camera). Deterministic.
// ════════════════════════════════════════════════════════════════════════════

const SPACING = 1000;
const FOCAL = 1000;
const DRIFT = 80; // in-beat creep → free Ken Burns push on every beat
const burstEase = Easing.bezier(0.65, 0, 0.18, 1);

type CamHead = { x: number; y: number; roll: number };
type BeatMeta = { cam: CamHead; move: string };

const META: Record<string, BeatMeta> = {};
for (const b of manifest.beats) {
  META[b.key] = {
    cam: (b as any).cam ?? { x: 0, y: 0, roll: 0 },
    move: (b as any).move ?? "dolly",
  };
}
const meta = (key: string): BeatMeta =>
  META[key] ?? { cam: { x: 0, y: 0, roll: 0 }, move: "dolly" };

export type CamState = {
  z: number;
  x: number;
  y: number;
  roll: number;
  vN: number; // normalized forward velocity 0..1
  beatIdx: number;
  burstP: number; // 0 during hold, 0..1 through the burst
  riseY: number; // transient whip offset (rise move)
};

function beatFrames(b: ReelBeat, fps: number) {
  const sF = Math.round(b.start * fps);
  const durF = Math.max(1, Math.round(b.dur * fps));
  return { sF, durF };
}

function zAt(bts: ReelBeat[], fps: number, frame: number): number {
  // piecewise: hold = linear drift, burst = eased 920-unit jump; C0-continuous
  const n = bts.length;
  for (let i = 0; i < n; i++) {
    const { sF, durF } = beatFrames(bts[i], fps);
    if (frame < sF + durF || i === n - 1) {
      const last = i === n - 1;
      const mv = meta(bts[i].key).move;
      const T = last
        ? 0
        : Math.min(mv === "warp" ? 10 : 16, Math.floor(0.45 * durF));
      const drift = mv === "warp" ? 0 : DRIFT;
      const holdF = durF - T;
      const lf = Math.min(Math.max(frame - sF, 0), durF);
      if (lf < holdF || last) {
        return (
          i * SPACING + drift * (holdF > 0 ? Math.min(lf, holdF) / holdF : 0)
        );
      }
      const u = burstEase((lf - holdF) / T);
      return i * SPACING + drift + (SPACING - drift) * u;
    }
  }
  return (n - 1) * SPACING;
}

export function useCamera(
  bts: ReelBeat[],
  fps: number,
  frame: number,
): CamState {
  const z = zAt(bts, fps, frame);
  const zPrev = zAt(bts, fps, Math.max(0, frame - 1));
  const vN = Math.min(1, Math.max(0, (z - zPrev) / 90));

  // which beat + burst progress
  let beatIdx = bts.length - 1;
  let burstP = 0;
  for (let i = 0; i < bts.length; i++) {
    const { sF, durF } = beatFrames(bts[i], fps);
    if (frame >= sF && frame < sF + durF) {
      beatIdx = i;
      const mv = meta(bts[i].key).move;
      const last = i === bts.length - 1;
      const T = last
        ? 0
        : Math.min(mv === "warp" ? 10 : 16, Math.floor(0.45 * durF));
      const holdF = durF - T;
      const lf = frame - sF;
      burstP = T > 0 && lf >= holdF ? burstEase((lf - holdF) / T) : 0;
      break;
    }
  }
  const cur = meta(bts[beatIdx].key).cam;
  const nxt = meta(bts[Math.min(beatIdx + 1, bts.length - 1)].key).cam;
  const x = cur.x + (nxt.x - cur.x) * burstP;
  const y = cur.y + (nxt.y - cur.y) * burstP;
  const roll = cur.roll + (nxt.roll - cur.roll) * burstP;

  // 'rise' whip: when the NEXT beat is a rise move, the burst into it whips
  // camY out and back (sin envelope) with a settle — most kinetic move.
  let riseY = 0;
  const nextMove = meta(bts[Math.min(beatIdx + 1, bts.length - 1)].key).move;
  if (nextMove === "rise" && burstP > 0) {
    riseY = -320 * Math.sin(burstP * Math.PI);
  }
  return { z, x, y, roll, vN, beatIdx, burstP, riseY };
}

// ── per-scene projection (replaces crossfade transitions entirely) ──────────
export const CamScene: React.FC<{
  i: number;
  cam: CamState;
  moduleTag?: string;
  accent: string;
  children: React.ReactNode;
}> = ({ i, cam, moduleTag, accent, children }) => {
  const zPlane = (i + 1) * SPACING;
  const d = zPlane - cam.z;
  if (d < 60 || d > 2600) return null;
  const scale = FOCAL / d;
  const opacity = Math.min(ipl(d, 1500, 2400, 1, 0), ipl(d, 140, 520, 0, 1));
  const brightness = ipl(d, 1100, 2400, 1, 0.55);
  const frameOp = ipl(d, 1080, 1600, 0, 1); // hologram chrome while approaching
  return (
    <AbsoluteFill style={{ zIndex: 100 - i, pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          opacity,
          transform: `translate(${-(cam.x - meta0(i).x)}px, ${-(cam.y + cam.riseY - meta0(i).y)}px) rotate(${-(cam.roll - meta0(i).roll)}deg) scale(${scale})`,
          transformOrigin: "50% 50%",
          filter: `brightness(${brightness})`,
          willChange: "transform,opacity",
        }}
      >
        {children}
        {moduleTag && frameOp > 0.01 && d > 1050 && (
          <HoloPanelFrame tag={moduleTag} accent={accent} opacity={frameOp} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// each scene rests at its own heading so the camera "arrives" centered
function meta0(i: number): CamHead {
  const b = manifest.beats[i] as any;
  return b?.cam ?? { x: 0, y: 0, roll: 0 };
}

// ── hologram chrome the camera flies INTO ───────────────────────────────────
export const HoloPanelFrame: React.FC<{
  tag: string;
  accent: string;
  opacity: number;
}> = ({ tag, accent, opacity }) => (
  <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        inset: 40,
        border: `1.5px solid ${accent}80`,
        borderRadius: 26,
      }}
    />
    {[
      { left: 28, top: 28, t: "rotate(0deg)" },
      { right: 28, top: 28, t: "rotate(90deg)" },
      { right: 28, bottom: 28, t: "rotate(180deg)" },
      { left: 28, bottom: 28, t: "rotate(270deg)" },
    ].map((c, k) => (
      <svg
        key={k}
        width="34"
        height="34"
        viewBox="0 0 34 34"
        style={{ position: "absolute", ...c, transform: (c as any).t } as any}
      >
        <path
          d="M2 30 L2 2 L30 2"
          fill="none"
          stroke={accent}
          strokeWidth="3"
        />
      </svg>
    ))}
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 72,
        fontFamily: MONO,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.18em",
        color: accent,
      }}
    >
      {tag}
    </div>
  </AbsoluteFill>
);

// ── anamorphic streaks during bursts (mounted only when vN > 0.15) ──────────
export const SpeedStreaks: React.FC<{ vN: number; frame: number }> = ({
  vN,
  frame,
}) => {
  if (vN <= 0.15) return null;
  return (
    <AbsoluteFill style={{ zIndex: 6500, pointerEvents: "none" }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const x = random(`streak-${i}`) * W;
        const h = 300 + random(`sh-${i}`) * 300;
        const y = ((frame * (24 + i * 7)) % (H + 1400)) - 700;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 2,
              height: h,
              background:
                "linear-gradient(180deg, transparent, rgba(255,255,255,0.7), transparent)",
              transform: `scaleY(${1 + vN * 1.5})`,
              opacity: vN * 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
