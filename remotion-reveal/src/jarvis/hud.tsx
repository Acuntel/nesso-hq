import React from "react";
import { AbsoluteFill, random } from "remotion";
import { MONO, SANS, W, H } from "../simply/theme";
import { ipl } from "../simply/helpers";
import type { CamState } from "./camera";

// ════════════════════════════════════════════════════════════════════════════
//  HUD — the camera's "windshield". Mounted once, parallax 0.3x, alive from
//  frame 0 to the last frame. Idle periods are mutually odd (24/40/64/70/80/
//  90/130/140f) so the ambient layer never visibly loops inside 60s.
// ════════════════════════════════════════════════════════════════════════════

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

// mission clock: evening → NIGHTWATCH spins it to 03:07:44 → ticks onward
function missionClock(frame: number, nw: { sF: number; durF: number } | null) {
  const fps = 30;
  const t0 = 22 * 3600 + 41 * 60 + 7;
  const tNight = 3 * 3600 + 7 * 60 + 44;
  let secs: number;
  if (!nw || frame < nw.sF) {
    secs = t0 + frame / fps;
  } else {
    const spinEnd = nw.sF + Math.floor(nw.durF * 0.35);
    if (frame < spinEnd) {
      const p = (frame - nw.sF) / Math.max(1, spinEnd - nw.sF);
      const from = t0 + nw.sF / fps;
      secs = from + (tNight + 24 * 3600 - from) * p; // spin forward through midnight
    } else {
      secs = tNight + (frame - spinEnd) / fps;
    }
  }
  secs = secs % (24 * 3600);
  const h = pad2(secs / 3600);
  const m = pad2((secs % 3600) / 60);
  const s = pad2(secs % 60);
  const ff = pad2(frame % 30);
  return `${h}:${m}:${s}:${ff}`;
}

const TICKER_LINES = [
  "INTAKE: 2 NEW LEADS",
  "PIPELINE: 38 JOBS LIVE",
  "REVENUE SYNC: OK",
  "UPTIME: 24/7",
  "CONTRACT SCAN: 28s · $0.04",
  "SYSTEMS ONLINE: 14",
  "OWNER ASLEEP · BOT ON",
];
const CTA_LINES = [
  "BUILD SLOTS THIS MONTH: FEW",
  "REPLY TIME: SAME DAY",
  "FREE 15-MIN TEARDOWN",
];

export const HudFrame: React.FC<{
  frame: number;
  cam: CamState;
  accent: string;
  activeKey: string;
  voActive: boolean;
  nightwatch: { sF: number; durF: number } | null;
  totalFrames: number;
}> = ({ frame, cam, accent, activeKey, voActive, nightwatch, totalFrames }) => {
  const px = -cam.x * 0.3;
  const py = -(cam.y + cam.riseY) * 0.3;
  const breathe =
    0.35 + 0.15 * (0.5 + 0.5 * Math.sin((frame / 80) * Math.PI * 2));
  const dim = activeKey === "MAKER" || activeKey === "BUILT_ME" ? 0.55 : 1;
  const pulse = 1 + cam.vN * 0.15; // cockpit reacts to its own camera
  const rec = (Math.sin((frame / 24) * Math.PI * 2) + 1) / 2 > 0.4;
  const dataPulseX = ((frame % 90) / 90) * (W - 88);

  const ctaMode = activeKey === "OFFER" || activeKey === "CTA_HOLD";
  const lines = ctaMode ? CTA_LINES : TICKER_LINES;
  const tick = Math.floor(frame / 70);
  const roll = Math.min(1, (frame % 70) / 6);
  const lineA = lines[tick % lines.length];

  // waveform: 14 bars, layered sines under a speech envelope
  const env = voActive ? 1 : 0.25;
  const wfLabel =
    activeKey === "MAKER" || activeKey === "BUILT_ME"
      ? "// THIS IS WHO BUILT ME"
      : activeKey === "CTA_HOLD"
        ? "SYSTEM STANDING BY"
        : "AI NARRATOR // ONLINE";

  return (
    <AbsoluteFill
      style={{
        zIndex: 7500,
        pointerEvents: "none",
        opacity: dim,
        transform: `translate(${px}px, ${py}px)`,
      }}
    >
      {/* corner brackets */}
      {[
        { left: 36, top: 36, r: 0 },
        { right: 36, top: 36, r: 90 },
        { right: 36, bottom: 36, r: 180 },
        { left: 36, bottom: 36, r: 270 },
      ].map((c, k) => (
        <svg
          key={k}
          width="40"
          height="40"
          viewBox="0 0 40 40"
          style={
            {
              position: "absolute",
              left: (c as any).left,
              right: (c as any).right,
              top: (c as any).top,
              bottom: (c as any).bottom,
              transform: `rotate(${c.r}deg)`,
              opacity: breathe * pulse,
            } as any
          }
        >
          <path
            d="M2 36 L2 2 L36 2"
            fill="none"
            stroke={accent}
            strokeWidth="2"
          />
        </svg>
      ))}

      {/* top status bar */}
      <div
        style={{
          position: "absolute",
          top: 58,
          left: 92,
          right: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 22,
          color: "rgba(255,255,255,0.78)",
          letterSpacing: "0.1em",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#ff5555",
              opacity: rec ? 1 : 0.25,
              boxShadow: rec ? "0 0 10px #ff5555" : "none",
            }}
          />
          SIMPLY SCALED // FIELD UNIT
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: accent }}>
          {missionClock(frame, nightwatch)}
        </span>
      </div>
      {/* divider + traveling data pulse */}
      <div
        style={{
          position: "absolute",
          top: 102,
          left: 44,
          right: 44,
          height: 1,
          background: "rgba(255,255,255,0.14)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: dataPulseX,
            top: -1,
            width: 60,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />
      </div>

      {/* status feed ticker */}
      <div
        style={{
          position: "absolute",
          top: 122,
          left: 92,
          fontFamily: MONO,
          fontSize: 19,
          letterSpacing: "0.12em",
          color: ctaMode ? accent : "rgba(255,255,255,0.45)",
          overflow: "hidden",
          height: 26,
        }}
      >
        <div
          style={{
            transform: `translateY(${(1 - roll) * -22}px)`,
            opacity: roll,
          }}
        >
          ▸ {lineA}
        </div>
      </div>

      {/* right progress rail — honest F1 scrubber */}
      <div
        style={{
          position: "absolute",
          right: 44,
          top: H / 2 - 100,
          width: 2,
          height: 200,
          background: "rgba(255,255,255,0.14)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -3,
            top: (frame / totalFrames) * 192,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
      </div>

      {/* voice waveform — the narrator visibly speaking */}
      <div style={{ position: "absolute", left: 56, bottom: 540 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 5,
            height: 44,
          }}
        >
          {Array.from({ length: 14 }).map((_, i) => {
            const s =
              env *
              (0.25 +
                0.75 *
                  Math.abs(
                    Math.sin(0.31 * frame + i * 1.7) *
                      Math.sin(0.05 * frame + i * 0.4),
                  ));
            return (
              <div
                key={i}
                style={{
                  width: 4,
                  height: 44,
                  background: accent,
                  opacity: 0.5 + s * 0.5,
                  transform: `scaleY(${Math.max(0.08, s)})`,
                  transformOrigin: "bottom",
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: MONO,
            fontSize: 17,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {wfLabel}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── deep background band (1.3x parallax, behind all scenes) ─────────────────
export const DeepSpace: React.FC<{
  frame: number;
  cam: CamState;
  accent: string;
}> = ({ frame, cam, accent }) => {
  const px = -cam.x * 1.3;
  const py = -(cam.y + cam.riseY) * 1.3;
  const bloomB =
    0.85 + 0.15 * (0.5 + 0.5 * Math.sin((frame / 140) * Math.PI * 2));
  const scanY = ((frame % 130) / 130) * H;
  return (
    <AbsoluteFill
      style={{
        zIndex: 0,
        background: "#070B14",
        transform: `translate(${px}px, ${py}px) scale(1.08)`,
      }}
    >
      {/* particle field — 24 seeded dots */}
      {Array.from({ length: 24 }).map((_, i) => {
        const x0 = random(`px-${i}`) * W;
        const vx = 0.1 + random(`pv-${i}`) * 0.25;
        const x = (x0 + frame * vx) % W;
        const y = random(`py-${i}`) * H;
        const sz = 2 + Math.round(random(`ps-${i}`));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: sz,
              height: sz,
              borderRadius: "50%",
              background: "#fff",
              opacity: 0.25 + 0.2 * Math.sin(0.05 * frame + i),
            }}
          />
        );
      })}
      {/* drifting dot grid */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          backgroundImage: `radial-gradient(${accent} 1.5px, transparent 1.5px)`,
          backgroundSize: "44px 44px",
          backgroundPosition: `${(frame * 0.15) % 44}px ${(frame * 0.09) % 44}px`,
          opacity: 0.1,
          maskImage:
            "radial-gradient(ellipse 85% 75% at 50% 45%, black 38%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 75% at 50% 45%, black 38%, transparent 100%)",
        }}
      />
      {/* bloom breathe */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 65% at 50% 108%, ${accent}33 0%, transparent 60%)`,
          opacity: 0.55 * bloomB,
        }}
      />
      {/* drifting scanline band */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanY,
          height: 2,
          background: "linear-gradient(90deg, transparent, #fff, transparent)",
          opacity: 0.04,
        }}
      />
    </AbsoluteFill>
  );
};
