import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
  Img,
} from "remotion";

// ════════════════════════════════════════════════════════════════════════════
//  SIMPLY SCALED — hero reel v3  ("look like the future" + grandpa-clear)
//  10 FULL-SCREEN beats, ~63s. Z-axis camera, 2.5D tilt, parallax, animated
//  cursor, AI scan-line/token-extraction. Two visually OPPOSITE worlds:
//    LAW = calm indigo records-vault (cases/files/documents)
//    FIRE & WATER REPAIR = hot copper money scoreboard (jobs/leads/dollars)
//  Generic names only. No email. Money is the hero. Plain captions (works muted).
//  Timing is data-driven (beats prop ← real ElevenLabs VO).
// ════════════════════════════════════════════════════════════════════════════

export type ReelBeat = { key: string; start: number; dur: number };

export type SimplyScaledReelProps = {
  beats?: ReelBeat[];
  brand?: string;
  phone?: string;
  logoUrl?: string;
  lite?: boolean;
};

const DEFAULT_DURS: { key: string; dur: number }[] = [
  { key: "PROOF_FLASH", dur: 2 },
  { key: "HOOK", dur: 5.5 },
  { key: "BRIDGE", dur: 3.5 },
  { key: "LAW_TOUR", dur: 9 },
  { key: "LAW_PDF", dur: 6 },
  { key: "LAW_HOME", dur: 5.5 },
  { key: "LAW_EMAIL", dur: 5.5 },
  { key: "PIVOT", dur: 3.5 },
  { key: "RESTO_MONEY", dur: 6 },
  { key: "RESTO_PIPE", dur: 6 },
  { key: "AI_TEXT", dur: 8 },
  { key: "PROOF_TURN", dur: 5.5 },
  { key: "CLOSE_CTA", dur: 11 },
];

function buildDefaultBeats(): ReelBeat[] {
  let t = 0;
  return DEFAULT_DURS.map((d) => {
    const b = { key: d.key, start: t, dur: d.dur };
    t += d.dur;
    return b;
  });
}

const CAPTIONS: Record<string, string> = {
  HOOK: "RUNNING A BUSINESS? THESE 5 THINGS EAT YOUR DAY.",
  BRIDGE: "ONE SYSTEM THAT DOES IT ALL FOR YOU.",
  PROOF_FLASH: "",
  LAW_TOUR: "ONE SYSTEM RUNS THE WHOLE FIRM.",
  LAW_PDF: "AI READS A CONTRACT IN ABOUT 30 SECONDS.",
  LAW_HOME: "FULL PROPERTY RECORDS. ZERO COST.",
  LAW_EMAIL: "A DAY OF EMAIL, INTO READY-TO-SAVE CONTACTS.",
  PIVOT: "SAME BUILDER. A COMPLETELY DIFFERENT BUSINESS.",
  RESTO_MONEY: "A FIRE & WATER REPAIR CO: $612,480 IN JOBS SOLD.",
  RESTO_PIPE: "EVERY CUSTOMER, FROM FIRST CALL TO PAID JOB.",
  AI_TEXT: "A CUSTOMER TEXTS. THE SOFTWARE FILES THE JOB ITSELF.",
  PROOF_TURN: "TWO REAL BUSINESSES. ONE PERSON BUILT BOTH.",
  CLOSE_CTA: "",
};

const LAW = {
  bg: "#080B14",
  bg2: "#0C1020",
  indigo: "#6366F1",
  indigoHi: "#A5B4FC",
  sky: "#7CA8FF",
  text: "#E8ECF6",
  soft: "rgba(232,236,246,0.55)",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(165,180,252,0.18)",
};
const FIRE = {
  bg: "#0B0805",
  bg2: "#150D06",
  copper: "#F0742A",
  copperHi: "#FFA45C",
  ember: "#FF6B3D",
  emerald: "#34D399",
  info: "#60A5FA",
  amber: "#F5B945",
  text: "#FFF3EA",
  soft: "rgba(255,243,234,0.55)",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(240,116,42,0.22)",
};
const RED = "#F4475F";

const SANS =
  "'SF Pro Display','SF Pro Text','Helvetica Neue','Inter','Arial',sans-serif";
const MONO = "'SF Mono','Roboto Mono','Menlo',monospace";
const W = 1080;
const H = 1920;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.inOut(Easing.cubic);

// ─── helpers ────────────────────────────────────────────────────────────────
type BeatInfo = {
  active: boolean;
  visible: boolean;
  sF: number;
  eF: number;
  durF: number;
  localF: number;
  p: number;
};

function useBeats(beats: ReelBeat[], fps: number, frame: number) {
  const map: Record<string, BeatInfo> = {};
  for (const b of beats) {
    const sF = Math.round(b.start * fps);
    const durF = Math.max(1, Math.round(b.dur * fps));
    const eF = sF + durF;
    map[b.key] = {
      active: frame >= sF && frame < eF,
      visible: frame >= sF - 8 && frame < eF + 3,
      sF,
      eF,
      durF,
      localF: frame - sF,
      p: Math.max(0, Math.min(1, (frame - sF) / durF)),
    };
  }
  return map;
}

const ipl = (
  f: number,
  a: number,
  b: number,
  lo: number,
  hi: number,
  e?: any,
) =>
  interpolate(f, [a, b], [lo, hi], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e,
  });

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function countUp(
  frame: number,
  sF: number,
  durF: number,
  to: number,
  from = 0,
) {
  return from + (to - from) * ipl(frame, sF, sF + durF, 0, 1, ease);
}

// ─── atmosphere / finishing ─────────────────────────────────────────────────
const DotGrid: React.FC<{
  color: string;
  opacity?: number;
  frame: number;
  speed?: number;
}> = ({ color, opacity = 1, frame, speed = 0.15 }) => {
  const drift = (frame * speed) % 40;
  return (
    <div
      style={{
        position: "absolute",
        inset: -60,
        opacity,
        backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.5px)`,
        backgroundSize: "40px 40px",
        backgroundPosition: `${drift}px ${drift * 0.6}px`,
        maskImage:
          "radial-gradient(ellipse 85% 75% at 50% 45%, black 38%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 85% 75% at 50% 45%, black 38%, transparent 100%)",
      }}
    />
  );
};
const Bloom: React.FC<{ color: string; intensity?: number; at?: string }> = ({
  color,
  intensity = 1,
  at = "50% 108%",
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(120% 65% at ${at}, ${color} 0%, transparent 60%)`,
      opacity: 0.55 * intensity,
      pointerEvents: "none",
    }}
  />
);
const Grain: React.FC = () => (
  <svg
    width={W}
    height={H}
    style={{
      position: "absolute",
      inset: 0,
      opacity: 0.055,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      zIndex: 9000,
    }}
  >
    <filter id="gr">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.9"
        numOctaves="2"
        stitchTiles="stitch"
      />
    </filter>
    <rect width="100%" height="100%" filter="url(#gr)" />
  </svg>
);
const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      boxShadow: "inset 0 0 300px 64px rgba(0,0,0,0.62)",
      pointerEvents: "none",
      zIndex: 8000,
    }}
  />
);
// specular key-light sweep across an element
const LightSweep: React.FC<{ p: number }> = ({ p }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(108deg, transparent 38%, rgba(255,255,255,0.85) 50%, transparent 62%)",
      transform: `translateX(${p * 200 - 100}%)`,
      mixBlendMode: "overlay",
      pointerEvents: "none",
    }}
  />
);

// 2.5D tilt / Z push-in stage wrapper
const Stage: React.FC<{
  tilt?: number;
  tiltX?: number;
  scale?: number;
  x?: number;
  y?: number;
  children: React.ReactNode;
  shadow?: string;
}> = ({ tilt = 0, tiltX = 0, scale = 1, x = 0, y = 0, children, shadow }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      perspective: 1500,
    }}
  >
    <div
      style={{
        width: W,
        height: H,
        transformStyle: "preserve-3d",
        transform: `translate(${x}px, ${y}px) scale(${scale}) rotateY(${tilt}deg) rotateX(${tiltX}deg)`,
        filter: shadow ? `drop-shadow(0 60px 80px ${shadow})` : undefined,
      }}
    >
      {children}
    </div>
  </div>
);

// animated cursor
const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({
  x,
  y,
  click = 0,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      zIndex: 6000,
      pointerEvents: "none",
    }}
  >
    {click > 0 && (
      <div
        style={{
          position: "absolute",
          left: -22,
          top: -22,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.8)",
          transform: `scale(${1 + click * 1.6})`,
          opacity: 1 - click,
        }}
      />
    )}
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}
    >
      <path
        d="M4 2 L4 20 L9 15 L12.5 22 L15 21 L11.5 14 L18 14 Z"
        fill="#fff"
        stroke="#111"
        strokeWidth="1.2"
      />
    </svg>
  </div>
);

// ─── caption (plain, muted-legible) ─────────────────────────────────────────
const Caption: React.FC<{
  text: string;
  localF: number;
  durF: number;
  fps: number;
  accent: string;
  big?: boolean;
}> = ({ text, localF, durF, fps, accent, big }) => {
  if (!text || localF < 0) return null;
  const inP = ipl(localF, 0, fps * 0.25, 0, 1, ease);
  const outP = ipl(localF, durF - fps * 0.3, durF, 1, 0);
  const op = Math.min(inP, outP);
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        right: 56,
        bottom: 235,
        textAlign: "center",
        opacity: op,
        transform: `translateY(${(1 - inP) * 30}px)`,
        zIndex: 7000,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: big ? 70 : 54,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: "#fff",
          textShadow: `0 4px 30px rgba(0,0,0,0.92), 0 0 24px ${accent}66`,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// reusable self-drawing line chart with leading glow dot
const LineChart: React.FC<{
  draw: number;
  color: string;
  glow: string;
  width: number;
  height: number;
  data: number[];
}> = ({ draw, color, glow, width, height, data }) => {
  const n = data.length;
  const max = Math.max(...data) * 1.1;
  const xs = (i: number) => (i / (n - 1)) * width;
  const ys = (v: number) => height - 18 - (v / max) * (height - 30);
  const pts = data.map((v, i) => [xs(i), ys(v)] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const area = `${line} L ${width} ${height - 18} L 0 ${height - 18} Z`;
  // leading dot position along x by draw
  const dx = draw * width;
  let dy = ys(data[0]);
  for (let i = 1; i < n; i++) {
    if (xs(i) >= dx) {
      const t = (dx - xs(i - 1)) / (xs(i) - xs(i - 1));
      dy = ys(data[i - 1]) + (ys(data[i]) - ys(data[i - 1])) * t;
      break;
    }
    dy = ys(data[i]);
  }
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="lcclip">
          <rect x="0" y="0" width={width * draw} height={height} />
        </clipPath>
      </defs>
      <g clipPath="url(#lcclip)">
        <path d={area} fill="url(#lcfill)" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 14px ${glow})` }}
        />
      </g>
      {draw > 0.02 && draw < 0.99 && (
        <circle
          cx={dx}
          cy={dy}
          r={11}
          fill="#fff"
          style={{ filter: `drop-shadow(0 0 16px ${glow})` }}
        />
      )}
    </svg>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  SCENES
// ════════════════════════════════════════════════════════════════════════════

const PAINS = [
  { icon: "📞", t: "Chasing down leads" },
  { icon: "🧾", t: "Unpaid invoices" },
  { icon: "⌨️", t: "Typing the same info twice" },
  { icon: "📅", t: "Scheduling back-and-forth" },
  { icon: "🗂️", t: "Paperwork that never ends" },
];

// 1 — HOOK (slowed, staggered)
const HookScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const push = 1 + ipl(bi.localF, 0, bi.durF, 0, 0.02);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 32%, #170f12 0%, #060508 100%)",
      }}
    >
      <DotGrid color={RED} opacity={0.22} frame={frame} speed={0.08} />
      <Bloom color="rgba(244,71,95,0.32)" at="50% 22%" />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${push})`,
          transformOrigin: "50% 40%",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 215,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 36,
              fontWeight: 700,
              color: LAW.soft,
            }}
          >
            Running a business?
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 62,
              fontWeight: 800,
              color: "#fff",
              marginTop: 10,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            These 5 things
            <br />
            eat your day.
          </div>
        </div>
        <div style={{ position: "absolute", top: 500, left: 90, right: 90 }}>
          {PAINS.map((p, i) => {
            const s = 14 + i * 16; // ~0.53s apart — slow
            const a = ipl(bi.localF, s, s + 12, 0, 1, ease);
            const pulse = 0.7 + 0.3 * Math.abs(Math.sin((bi.localF - s) / 8));
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  background: "rgba(244,71,95,0.09)",
                  border: `1.5px solid rgba(244,71,95,${0.3 * a})`,
                  borderRadius: 18,
                  padding: "24px 30px",
                  marginBottom: 18,
                  opacity: a,
                  transform: `translateY(${(1 - a) * 30}px)`,
                  boxShadow:
                    a > 0.9
                      ? `0 0 ${26 * pulse}px rgba(244,71,95,0.28)`
                      : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 38,
                    color: RED,
                    width: 46,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 42 }}>{p.icon}</div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 40,
                    color: "#fff",
                  }}
                >
                  {p.t}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 2 — BRIDGE (Jarvis): the dropped balls get caught, then the core locks
const BRIDGE_SLIPS = [
  { t: "Missed call" },
  { t: "Blown deadline" },
  { t: "Forgotten follow-up" },
  { t: "Dropped handoff" },
];
const BRIDGE_TAGS = ["NOTHING MISSED", "EVERYTHING TRACKED", "FEWER EMAILS"];
const hexPts = (r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = ((k * 60 - 90) * Math.PI) / 180;
    return `${240 + Math.cos(a) * r},${240 + Math.sin(a) * r}`;
  }).join(" ");

const BridgeScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const cx = 540;
  const coreY = 820;
  const scanY = ipl(bi.localF, 8, bi.durF * 0.46, 280, 740, easeInOut);
  const scanOn = bi.localF > 6 && bi.localF < bi.durF * 0.52;
  const coreP = ipl(bi.localF, bi.durF * 0.34, bi.durF * 0.66, 0, 1, ease);
  const tagsP = ipl(bi.localF, bi.durF * 0.66, bi.durF * 0.84, 0, 1, ease);
  const headP = ipl(bi.localF, bi.durF * 0.72, bi.durF * 0.88, 0, 1, ease);
  const bloom = coreP;
  const rot = frame * 1.1;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 52%, #0b1228 0%, #04050a 100%)",
        overflow: "hidden",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.24} frame={frame} />
      <Bloom color={`rgba(99,102,241,${0.5 * bloom})`} at="50% 60%" />
      {/* dropped-ball alerts (sell the problem) → caught by the scan */}
      {BRIDGE_SLIPS.map((p, i) => {
        const rowY = 320 + i * 112;
        const appear = ipl(bi.localF, 4 + i * 5, 4 + i * 5 + 10, 0, 1, ease);
        const caught = scanY > rowY + 6;
        const fp = ipl(
          bi.localF,
          bi.durF * 0.48 + i * 3,
          bi.durF * 0.48 + i * 3 + 18,
          0,
          1,
          ease,
        );
        const y = rowY + (coreY - rowY) * fp;
        const sc = appear * (1 - fp * 0.82);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 190,
              right: 190,
              top: y - 40,
              transform: `scale(${sc})`,
              transformOrigin: "50% 50%",
              opacity: appear * (1 - fp * 0.95),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: caught
                  ? "rgba(52,211,153,0.12)"
                  : "rgba(244,71,95,0.12)",
                border: `1.5px solid ${caught ? FIRE.emerald : "rgba(244,71,95,0.6)"}`,
                borderRadius: 16,
                padding: "16px 24px",
                boxShadow: caught
                  ? `0 0 26px ${FIRE.emerald}55`
                  : `0 0 18px rgba(244,71,95,0.25)`,
              }}
            >
              <div style={{ fontSize: 30, width: 42 }}>
                {caught ? "✅" : "⚠️"}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 32,
                  color: "#fff",
                  flex: 1,
                }}
              >
                {p.t}
              </div>
              {caught && (
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 22,
                    fontWeight: 800,
                    color: FIRE.emerald,
                  }}
                >
                  CAUGHT
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* scan beam */}
      {scanOn && (
        <div
          style={{
            position: "absolute",
            left: 150,
            right: 150,
            top: scanY,
            height: 5,
            background: `linear-gradient(90deg, transparent, ${LAW.sky}, ${LAW.indigoHi}, ${LAW.sky}, transparent)`,
            boxShadow: `0 0 30px ${LAW.indigo}`,
            borderRadius: 3,
          }}
        />
      )}
      {/* arc-reactor core with hex HUD frame */}
      {coreP > 0 && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: coreY,
            transform: `translate(-50%,-50%) scale(${0.5 + coreP * 0.5})`,
            opacity: coreP,
          }}
        >
          <svg
            width="480"
            height="480"
            viewBox="0 0 480 480"
            style={{ overflow: "visible" }}
          >
            <defs>
              <radialGradient id="bcoreg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="38%" stopColor={LAW.indigoHi} />
                <stop offset="100%" stopColor={LAW.indigo} stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`rotate(${rot * 0.4} 240 240)`}>
              <polygon
                points={hexPts(205)}
                fill="none"
                stroke={LAW.indigo}
                strokeWidth="2.5"
                opacity="0.5"
              />
            </g>
            <g transform={`rotate(${-rot * 0.4} 240 240)`}>
              <polygon
                points={hexPts(168)}
                fill="none"
                stroke={LAW.indigoHi}
                strokeWidth="2"
                opacity="0.4"
              />
            </g>
            <g transform={`rotate(${rot} 240 240)`}>
              <circle
                cx="240"
                cy="240"
                r="148"
                fill="none"
                stroke={LAW.indigo}
                strokeWidth="3"
                strokeDasharray="38 26"
                opacity="0.7"
              />
            </g>
            <g transform={`rotate(${-rot * 1.7} 240 240)`}>
              <circle
                cx="240"
                cy="240"
                r="110"
                fill="none"
                stroke={LAW.sky}
                strokeWidth="5"
                strokeDasharray="58 22"
                opacity="0.95"
                style={{ filter: `drop-shadow(0 0 10px ${LAW.sky})` }}
              />
            </g>
            <circle
              cx="240"
              cy="240"
              r={62 + Math.sin(frame / 6) * 6}
              fill="url(#bcoreg)"
              style={{
                filter: `drop-shadow(0 0 ${46 * bloom}px ${LAW.indigo})`,
              }}
            />
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = ((rot * 1.1 + k * 60) * Math.PI) / 180;
              return (
                <circle
                  key={k}
                  cx={240 + Math.cos(a) * 178}
                  cy={240 + Math.sin(a) * 178}
                  r="5"
                  fill="#fff"
                  opacity="0.85"
                />
              );
            })}
          </svg>
        </div>
      )}
      {/* headline */}
      <div
        style={{
          position: "absolute",
          top: 1180,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 50,
          fontWeight: 800,
          color: "#fff",
          opacity: headP,
          padding: "0 80px",
          textShadow: `0 0 30px ${LAW.indigo}`,
          transform: `translateY(${(1 - headP) * 18}px)`,
        }}
      >
        It catches what you'd{" "}
        <span style={{ color: LAW.indigoHi }}>forget.</span>
      </div>
      {/* payoff tags */}
      <div
        style={{
          position: "absolute",
          top: 1300,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {BRIDGE_TAGS.map((t, i) => (
          <div
            key={i}
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: "0.04em",
              color: "#fff",
              background: "rgba(99,102,241,0.18)",
              border: `1.5px solid ${LAW.indigo}`,
              borderRadius: 999,
              padding: "12px 22px",
              opacity: ipl(
                bi.localF,
                bi.durF * 0.68 + i * 4,
                bi.durF * 0.68 + i * 4 + 10,
                0,
                1,
                ease,
              ),
              boxShadow: `0 0 20px ${LAW.indigo}55`,
            }}
          >
            ✓ {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  STOLEN MULE — accurate recreation (v6). Cursor + elements share the SAME rect
//  so every click lands exactly. Real sidebar, real screens, real 3 AI tools.
// ════════════════════════════════════════════════════════════════════════════
const MULE = {
  canvas: "#0a0e17",
  surface: "#111725",
  sunken: "#070a11",
  indigo: "#6366f1",
  indigoHi: "#818cf8",
  text: "#e6eaf2",
  mid: "#9aa6bf",
  ok: "#4ade80",
  okFill: "rgba(22,163,74,0.18)",
  warn: "#fbbf24",
  warnFill: "rgba(217,119,6,0.18)",
  danger: "#f87171",
  dangerFill: "rgba(220,38,38,0.18)",
  border: "rgba(255,255,255,0.10)",
};

type NavItem = { label: string; icon: string; ai?: boolean };
const NAV: NavItem[] = [
  { label: "Dashboard", icon: "▦" },
  { label: "Matters", icon: "⚖" },
  { label: "Contacts", icon: "👥" },
  { label: "Invoices", icon: "🧾" },
  { label: "Time & Fees", icon: "⏱" },
  { label: "Tasks", icon: "✓" },
  { label: "Calendar", icon: "📅" },
  { label: "Intake", icon: "📥" },
  { label: "Trust Accounting", icon: "🏦" },
  { label: "PDF Scrape", icon: "📄", ai: true },
  { label: "Home Scrape", icon: "🏠", ai: true },
  { label: "Email Scrape", icon: "✉", ai: true },
];
const SIDE_W = 300;
const NAV_TOP = 168;
const ROW_H = 58;
const AI_GAP = 44;
const AI_START = 9;
const navRowY = (i: number) =>
  NAV_TOP + i * ROW_H + (i >= AI_START ? AI_GAP : 0);
const navCenter = (i: number) => ({ x: 150, y: navRowY(i) + ROW_H / 2 });

// ── sidebar (renders rows at navRowY; active pill at activeIdx) ──────────────
const MuleSidebar: React.FC<{ activeIdx: number }> = ({ activeIdx }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: SIDE_W,
      background: MULE.sunken,
      borderRight: `1px solid ${MULE.border}`,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "44px 22px 0",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: MULE.indigo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 22,
          boxShadow: `0 0 18px ${MULE.indigo}88`,
        }}
      >
        S
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 26,
          color: "#fff",
          letterSpacing: "-0.01em",
        }}
      >
        Stolen Mule
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: NAV_TOP + AI_START * ROW_H + 8,
        width: SIDE_W,
        fontFamily: SANS,
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: "0.18em",
        color: MULE.mid,
        paddingLeft: 24,
      }}
    >
      AI INTEGRATIONS
    </div>
    {NAV.map((n, i) => {
      const y = navRowY(i);
      const active = i === activeIdx;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 12,
            top: y,
            width: SIDE_W - 24,
            height: ROW_H - 8,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 16px",
            borderRadius: 12,
            background: active ? `${MULE.indigo}26` : "transparent",
            boxShadow: active ? `inset 0 0 0 1px ${MULE.indigo}66` : "none",
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: active ? 700 : 500,
            color: active ? "#fff" : MULE.mid,
          }}
        >
          <span style={{ fontSize: 22, width: 26, textAlign: "center" }}>
            {n.icon}
          </span>
          <span style={{ flex: 1 }}>{n.label}</span>
          {n.ai && (
            <span
              style={{
                fontFamily: SANS,
                fontSize: 12,
                fontWeight: 800,
                color: "#04150E",
                background: MULE.indigoHi,
                borderRadius: 5,
                padding: "2px 6px",
              }}
            >
              AI
            </span>
          )}
        </div>
      );
    })}
  </div>
);

const MAINX = SIDE_W + 44; // content left
const MAINW = W - MAINX - 44;

const MuleChrome: React.FC<{
  activeIdx: number;
  frame: number;
  title: string;
  children: React.ReactNode;
}> = ({ activeIdx, frame, title, children }) => (
  <AbsoluteFill style={{ background: MULE.canvas }}>
    <DotGrid color={MULE.indigo} opacity={0.18} frame={frame} />
    <MuleSidebar activeIdx={activeIdx} />
    {/* top bar */}
    <div
      style={{
        position: "absolute",
        left: SIDE_W,
        right: 0,
        top: 0,
        height: 110,
        borderBottom: `1px solid ${MULE.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 44px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 40,
          fontWeight: 800,
          color: MULE.text,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: SANS,
          fontSize: 20,
          color: MULE.indigoHi,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: MULE.indigo,
            boxShadow: `0 0 12px ${MULE.indigo}`,
          }}
        />{" "}
        Live
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: MAINX,
        top: 150,
        right: 44,
        bottom: 40,
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

// ── shared pane bits ─────────────────────────────────────────────────────────
const badge = (txt: string, c: string, bg: string) => (
  <span
    style={{
      fontFamily: SANS,
      fontSize: 18,
      fontWeight: 700,
      color: c,
      background: bg,
      borderRadius: 8,
      padding: "4px 12px",
    }}
  >
    {txt}
  </span>
);
const Row: React.FC<{
  cells: React.ReactNode[];
  widths: string[];
  appear?: number;
}> = ({ cells, widths, appear = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "20px 22px",
      borderBottom: `1px solid ${MULE.border}`,
      opacity: appear,
    }}
  >
    {cells.map((c, i) => (
      <div
        key={i}
        style={{
          width: widths[i],
          fontFamily: SANS,
          fontSize: 24,
          color: MULE.text,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {c}
      </div>
    ))}
  </div>
);
const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: MULE.surface,
      border: `1px solid ${MULE.border}`,
      borderRadius: 18,
      ...style,
    }}
  >
    {children}
  </div>
);
const kpi = (label: string, val: string, accent = MULE.text) => (
  <Card style={{ flex: 1, padding: "20px 22px" }}>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: MULE.mid,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 46,
        fontWeight: 800,
        color: accent,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {val}
    </div>
  </Card>
);

// ── module main panes (compact, recognizable, accurate-ish) ──────────────────
const ModulePane: React.FC<{ module: number; frame: number }> = ({
  module,
  frame,
}) => {
  switch (module) {
    case 1: // Matters
      return (
        <Card style={{ overflow: "hidden" }}>
          <Row
            widths={["20%", "16%", "34%", "30%"]}
            cells={[
              <b style={{ color: MULE.mid, fontSize: 18 }}>MATTER</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>STATUS</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>PROPERTY</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>ATTORNEY</b>,
            ]}
          />
          {[
            ["M-2041", "Open", "14 Oak St., Wheaton", "A. Cole"],
            ["M-2039", "Pending", "88 Maple Ave.", "R. Diaz"],
            ["M-2036", "Closed", "5 Birch Ct.", "A. Cole"],
            ["M-2030", "Open", "210 Elm Blvd.", "J. Park"],
          ].map((r, i) => (
            <Row
              key={i}
              widths={["20%", "16%", "34%", "30%"]}
              cells={[
                <span style={{ fontFamily: MONO }}>{r[0]}</span>,
                badge(
                  r[1],
                  r[1] === "Open"
                    ? MULE.ok
                    : r[1] === "Pending"
                      ? MULE.warn
                      : MULE.mid,
                  r[1] === "Open"
                    ? MULE.okFill
                    : r[1] === "Pending"
                      ? MULE.warnFill
                      : "rgba(255,255,255,0.06)",
                ),
                r[2],
                r[3],
              ]}
            />
          ))}
        </Card>
      );
    case 2: // Contacts
      return (
        <Card style={{ overflow: "hidden" }}>
          {[
            ["👤", "Robert Mercer", "Mercer Holdings", "rm@…"],
            ["🏢", "Wheaton Title Co.", "Title company", "ops@…"],
            ["👤", "Sarah Diaz", "Buyer", "sdiaz@…"],
            ["🏦", "First Trust Bank", "Lender", "loans@…"],
          ].map((r, i) => (
            <Row
              key={i}
              widths={["8%", "34%", "30%", "28%"]}
              cells={[
                <span style={{ fontSize: 28 }}>{r[0]}</span>,
                <b>{r[1]}</b>,
                <span style={{ color: MULE.mid }}>{r[2]}</span>,
                <span style={{ color: MULE.mid }}>{r[3]}</span>,
              ]}
            />
          ))}
        </Card>
      );
    case 3: // Invoices
      return (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {kpi("Unpaid", "$112,750", MULE.warn)}
            {kpi("Overdue", "$19,400", MULE.danger)}
            {kpi("Collected", "$284,900", MULE.ok)}
          </div>
          <Card style={{ overflow: "hidden" }}>
            {[
              ["INV-2026-0042", "Paid", "Mercer Holdings", "$8,400"],
              ["INV-2026-0041", "Sent", "S. Diaz", "$3,250"],
              ["INV-2026-0039", "Overdue", "210 Elm LLC", "$6,100"],
            ].map((r, i) => (
              <Row
                key={i}
                widths={["32%", "16%", "30%", "22%"]}
                cells={[
                  <span style={{ fontFamily: MONO, fontSize: 20 }}>
                    {r[0]}
                  </span>,
                  badge(
                    r[1],
                    r[1] === "Paid"
                      ? MULE.ok
                      : r[1] === "Sent"
                        ? MULE.indigoHi
                        : MULE.danger,
                    r[1] === "Paid"
                      ? MULE.okFill
                      : r[1] === "Sent"
                        ? `${MULE.indigo}22`
                        : MULE.dangerFill,
                  ),
                  r[2],
                  <b>{r[3]}</b>,
                ]}
              />
            ))}
          </Card>
        </>
      );
    case 4: // Time & Fees
      return (
        <Card style={{ overflow: "hidden" }}>
          <Row
            widths={["28%", "40%", "16%", "16%"]}
            cells={[
              <b style={{ color: MULE.mid, fontSize: 18 }}>MATTER</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>ACTIVITY</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>HRS</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>AMOUNT</b>,
            ]}
          />
          {[
            ["M-2041", "Draft purchase agreement", "1.5", "$525"],
            ["M-2039", "Title review call", "0.8", "$280"],
            ["M-2036", "Closing prep", "2.2", "$770"],
          ].map((r, i) => (
            <Row
              key={i}
              widths={["28%", "40%", "16%", "16%"]}
              cells={[
                <span style={{ fontFamily: MONO }}>{r[0]}</span>,
                r[1],
                r[2],
                <b style={{ color: MULE.ok }}>{r[3]}</b>,
              ]}
            />
          ))}
        </Card>
      );
    case 5: // Tasks
      return (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              ["Overdue", "2", MULE.danger],
              ["Due Today", "3", MULE.warn],
              ["This Week", "6", MULE.indigoHi],
            ].map((b, i) => (
              <Card key={i} style={{ flex: 1, padding: "16px 20px" }}>
                <div
                  style={{ fontFamily: SANS, fontSize: 18, color: MULE.mid }}
                >
                  {b[0]}
                </div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 40,
                    fontWeight: 800,
                    color: b[2] as string,
                  }}
                >
                  {b[1]}
                </div>
              </Card>
            ))}
          </div>
          <Card style={{ overflow: "hidden" }}>
            {[
              ["Send disclosures — 14 Oak St.", "Today"],
              ["Confirm closing time — Mercer", "Tomorrow"],
              ["File deed — Birch Ct.", "Fri"],
            ].map((r, i) => (
              <Row
                key={i}
                widths={["12%", "62%", "26%"]}
                cells={[
                  <span style={{ color: MULE.ok }}>☐</span>,
                  r[0],
                  <span style={{ color: MULE.mid }}>{r[1]}</span>,
                ]}
              />
            ))}
          </Card>
        </>
      );
    case 6: // Calendar
      return (
        <Card style={{ padding: 22, height: "100%" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <div
                key={d}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: MULE.mid,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, height: 360 }}>
            {[0, 1, 2, 3, 4].map((c) => (
              <div
                key={c}
                style={{
                  flex: 1,
                  position: "relative",
                  background: MULE.sunken,
                  borderRadius: 12,
                  border: `1px solid ${MULE.border}`,
                }}
              >
                {c === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 30,
                      left: 8,
                      right: 8,
                      height: 60,
                      background: MULE.indigo,
                      borderRadius: 8,
                      padding: 8,
                      fontFamily: SANS,
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Closing 10a
                  </div>
                )}
                {c === 2 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 120,
                      left: 8,
                      right: 8,
                      height: 50,
                      background: MULE.warnFill,
                      border: `1px solid ${MULE.warn}`,
                      borderRadius: 8,
                      padding: 8,
                      fontFamily: SANS,
                      fontSize: 16,
                      color: MULE.warn,
                    }}
                  >
                    Deadline
                  </div>
                )}
                {c === 4 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 60,
                      left: 8,
                      right: 8,
                      height: 56,
                      background: `${MULE.ok}22`,
                      border: `1px solid ${MULE.ok}`,
                      borderRadius: 8,
                      padding: 8,
                      fontFamily: SANS,
                      fontSize: 16,
                      color: MULE.ok,
                    }}
                  >
                    Signing
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      );
    case 7: // Intake
      return (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[
              ["New", MULE.indigoHi],
              ["Reviewed", MULE.warn],
              ["Converted", MULE.ok],
              ["Archived", MULE.mid],
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  fontFamily: SANS,
                  fontSize: 22,
                  fontWeight: 700,
                  color: t[1] as string,
                  padding: "10px 18px",
                  borderBottom: i === 0 ? `3px solid ${t[1]}` : "none",
                }}
              >
                {t[0]}
              </div>
            ))}
          </div>
          {[
            ["New buyer lead — 312 Pine St.", "2m ago"],
            ["Refinance inquiry — Park Ave.", "1h ago"],
            ["Seller intake — Birch Ct.", "3h ago"],
          ].map((r, i) => (
            <Card
              key={i}
              style={{
                padding: "20px 24px",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{ fontFamily: SANS, fontSize: 24, color: MULE.text }}
              >
                {r[0]}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 20, color: MULE.mid }}>
                {r[1]}
              </span>
            </Card>
          ))}
        </>
      );
    case 8: // Trust Accounting
      return (
        <>
          <Card
            style={{
              padding: "20px 24px",
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  fontWeight: 700,
                  color: MULE.text,
                }}
              >
                IOLTA Trust ····4182
              </div>
              <div style={{ fontFamily: SANS, fontSize: 20, color: MULE.mid }}>
                First Trust Bank
              </div>
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 40,
                fontWeight: 800,
                color: MULE.ok,
              }}
            >
              $486,200
            </div>
          </Card>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              "Transactions",
              "Reconciliation",
              "Reporting",
              "Deposit Slips",
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: i === 0 ? MULE.indigoHi : MULE.mid,
                  padding: "8px 14px",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <Card style={{ overflow: "hidden" }}>
            {[
              ["Deposit — Mercer earnest", "+$25,000"],
              ["Disbursement — title", "−$1,800"],
              ["Deposit — Diaz retainer", "+$5,000"],
            ].map((r, i) => (
              <Row
                key={i}
                widths={["70%", "30%"]}
                cells={[
                  r[0],
                  <b
                    style={{
                      color: r[1].startsWith("+") ? MULE.ok : MULE.danger,
                    }}
                  >
                    {r[1]}
                  </b>,
                ]}
              />
            ))}
          </Card>
        </>
      );
    default: // 0 Dashboard
      return (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {kpi("Unbilled", "$48,200")}
            {kpi("Unpaid", "$112,750", MULE.warn)}
            {kpi("Overdue", "$19,400", MULE.danger)}
            {kpi("Collected", "$284,900", MULE.indigoHi)}
          </div>
          <Card style={{ padding: 22, marginBottom: 18 }}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 20,
                fontWeight: 800,
                color: MULE.mid,
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              REVENUE — LAST 12 MONTHS
            </div>
            <svg
              width={MAINW - 44}
              height={160}
              style={{ overflow: "visible" }}
            >
              <polyline
                points={[20, 26, 24, 32, 40, 38, 47, 54, 60, 68, 76, 90]
                  .map(
                    (v, i, a) =>
                      `${(i / (a.length - 1)) * (MAINW - 44)},${150 - (v / 100) * 130}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={MULE.indigoHi}
                strokeWidth="5"
                style={{ filter: `drop-shadow(0 0 10px ${MULE.indigo})` }}
              />
            </svg>
          </Card>
          <div style={{ display: "flex", gap: 16 }}>
            <Card style={{ flex: 1, padding: 20 }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: MULE.mid,
                }}
              >
                Alerts (3)
              </div>
              {[0, 1].map((k) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                    fontFamily: SANS,
                    fontSize: 20,
                    color: MULE.text,
                  }}
                >
                  <span style={{ color: MULE.danger }}>●</span> Invoice 8 days
                  overdue
                </div>
              ))}
            </Card>
            <Card style={{ flex: 1, padding: 20 }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: MULE.mid,
                }}
              >
                My Tasks (6)
              </div>
              {[0, 1].map((k) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                    fontFamily: SANS,
                    fontSize: 20,
                    color: MULE.text,
                  }}
                >
                  <span style={{ color: MULE.ok }}>☐</span> Send disclosures
                </div>
              ))}
            </Card>
          </div>
        </>
      );
  }
};

// ── cursor helper: place arrow TIP exactly on (tx, ty) ───────────────────────
const TipCursor: React.FC<{ tx: number; ty: number; click?: number }> = ({
  tx,
  ty,
  click = 0,
}) => <Cursor x={tx - 4} y={ty - 2} click={click} />;

// ════════════════════════════════════════════════════════════════════════════
//  SCENES
// ════════════════════════════════════════════════════════════════════════════

// 0 — PROOF FLASH cold open: the real contract-AI result, honest + eye-catching
const ProofFlash: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const rows = [
    { tag: "OK", t: "3 parties matched", c: MULE.ok, bg: MULE.okFill },
    { tag: "OK", t: "Signatures 6 of 6", c: MULE.ok, bg: MULE.okFill },
    {
      tag: "VERIFY",
      t: "Closing date: confirm",
      c: MULE.warn,
      bg: MULE.warnFill,
    },
    {
      tag: "ACTION",
      t: "Earnest money: missing",
      c: MULE.danger,
      bg: MULE.dangerFill,
    },
  ];
  const outBlur = ipl(bi.localF, bi.durF - 4, bi.durF, 0, 14);
  return (
    <AbsoluteFill
      style={{
        background: MULE.canvas,
        alignItems: "center",
        justifyContent: "center",
        filter: `blur(${outBlur}px)`,
      }}
    >
      <DotGrid color={MULE.indigo} opacity={0.3} frame={frame} />
      <Bloom color="rgba(99,102,241,0.4)" />
      <div style={{ width: 760, opacity: ipl(bi.localF, 0, 5, 0, 1) }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 800,
            color: MULE.indigoHi,
            marginBottom: 14,
          }}
        >
          📄 Contract analyzed
        </div>
        <Card style={{ padding: 30 }}>
          {rows.map((r, i) => {
            const a = ipl(bi.localF, 4 + i * 4, 4 + i * 4 + 6, 0, 1, ease);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                  opacity: a,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 20,
                    fontWeight: 800,
                    color: r.c,
                    background: r.bg,
                    borderRadius: 8,
                    padding: "6px 12px",
                    width: 110,
                    textAlign: "center",
                  }}
                >
                  {r.tag}
                </span>
                <span style={{ fontFamily: SANS, fontSize: 34, color: "#fff" }}>
                  {r.t}
                </span>
              </div>
            );
          })}
          <div
            style={{
              fontFamily: MONO,
              fontSize: 20,
              color: MULE.mid,
              marginTop: 8,
            }}
          >
            $0.04 · AWS Bedrock · 28s
          </div>
        </Card>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 360,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 52,
          fontWeight: 800,
          color: "#fff",
          padding: "0 70px",
          opacity: ipl(bi.localF, 6, 12, 0, 1),
          textShadow: `0 0 30px ${MULE.indigo}`,
        }}
      >
        AI read this whole contract in{" "}
        <span style={{ color: MULE.indigoHi }}>30 seconds.</span>
      </div>
    </AbsoluteFill>
  );
};

// 4 — LAW_TOUR: open on dashboard, cursor clicks down the real sidebar
const TOUR = [1, 2, 3, 4, 5, 6, 7, 8]; // Matters … Trust (Dashboard = initial)
const LawTour: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const n = TOUR.length;
  const clickL = TOUR.map((_, k) => bi.durF * (0.14 + 0.102 * k));
  let nextK = 0;
  while (nextK < n && bi.localF >= clickL[nextK]) nextK++;
  let activeIdx = 0;
  for (let k = 0; k < n; k++) if (bi.localF >= clickL[k]) activeIdx = TOUR[k];
  const fromIdx = nextK === 0 ? 0 : TOUR[nextK - 1];
  const toIdx = nextK < n ? TOUR[nextK] : TOUR[n - 1];
  const segStart = nextK === 0 ? 0 : clickL[nextK - 1];
  const segEnd = nextK < n ? clickL[nextK] : bi.durF;
  const moveP = ipl(
    bi.localF,
    segStart,
    Math.max(segStart + 1, segEnd - 2),
    0,
    1,
    easeInOut,
  );
  const from = navCenter(fromIdx);
  const to = navCenter(toIdx);
  const cxx = from.x + (to.x - from.x) * moveP;
  const cyy = from.y + (to.y - from.y) * moveP;
  // click ring: pulse right after the most recent click
  let clickAmt = 0;
  for (let k = 0; k < n; k++) {
    const d = bi.localF - clickL[k];
    if (d >= 0 && d < 9) clickAmt = Math.max(clickAmt, 1 - d / 9);
  }
  const titles = [
    "Dashboard",
    "Matters",
    "Contacts",
    "Invoices",
    "Time & Fees",
    "Tasks",
    "Calendar",
    "Intake",
    "Trust Accounting",
  ];
  return (
    <>
      <MuleChrome activeIdx={activeIdx} frame={frame} title={titles[activeIdx]}>
        <ModulePane module={activeIdx} frame={frame} />
      </MuleChrome>
      <TipCursor tx={cxx} ty={cyy} click={clickAmt} />
    </>
  );
};

// helper for an AI scene: chrome + main + a click on one action button
const ACTION_BTN = { x: MAINX + 150, y: 980, w: 300, h: 84 }; // shared rect

// 5 — LAW_PDF: contract analyzer (click Scan → checklist)
const LawPdf: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const enter = ipl(bi.localF, 0, 10, 0, 1, ease);
  const cursorP = ipl(
    bi.localF,
    bi.durF * 0.18,
    bi.durF * 0.34,
    0,
    1,
    easeInOut,
  );
  const click = ipl(bi.localF, bi.durF * 0.32, bi.durF * 0.42, 1, 0);
  const scanned = bi.localF > bi.durF * 0.4;
  const btnCx = ACTION_BTN.x + ACTION_BTN.w / 2;
  const btnCy = ACTION_BTN.y + ACTION_BTN.h / 2;
  const fromX = MAINX + 500,
    fromY = 1300;
  const cxx = fromX + (btnCx - fromX) * cursorP;
  const cyy = fromY + (btnCy - fromY) * cursorP;
  const rows = [
    {
      tag: "OK",
      t: "Form: Multi-Board 8.0 detected",
      c: MULE.ok,
      bg: MULE.okFill,
    },
    { tag: "OK", t: "Parties: 3 matched", c: MULE.ok, bg: MULE.okFill },
    {
      tag: "OK",
      t: "Signatures & initials: 6 of 6",
      c: MULE.ok,
      bg: MULE.okFill,
    },
    {
      tag: "VERIFY",
      t: "Financing: Conventional — confirm date",
      c: MULE.warn,
      bg: MULE.warnFill,
    },
    {
      tag: "ACTION",
      t: "Earnest money receipt: missing",
      c: MULE.danger,
      bg: MULE.dangerFill,
    },
  ];
  return (
    <>
      <MuleChrome activeIdx={9} frame={frame} title="Contract Analyzer">
        {!scanned ? (
          <div style={{ opacity: enter }}>
            <div
              style={{
                height: 560,
                border: `3px dashed ${MULE.border}`,
                borderRadius: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                background: MULE.sunken,
              }}
            >
              <div style={{ fontSize: 80 }}>📄</div>
              <div style={{ fontFamily: SANS, fontSize: 30, color: MULE.mid }}>
                purchase_agreement.pdf
              </div>
            </div>
          </div>
        ) : (
          <Card
            style={{
              padding: 30,
              opacity: ipl(bi.localF, bi.durF * 0.4, bi.durF * 0.5, 0, 1),
            }}
          >
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              {badge("3 OK", MULE.ok, MULE.okFill)}
              {badge("1 VERIFY", MULE.warn, MULE.warnFill)}
              {badge("1 ACTION", MULE.danger, MULE.dangerFill)}
            </div>
            {rows.map((r, i) => {
              const a = ipl(
                bi.localF,
                bi.durF * 0.46 + i * 4,
                bi.durF * 0.46 + i * 4 + 6,
                0,
                1,
                ease,
              );
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 14,
                    opacity: a,
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 18,
                      fontWeight: 800,
                      color: r.c,
                      background: r.bg,
                      borderRadius: 8,
                      padding: "5px 10px",
                      width: 110,
                      textAlign: "center",
                    }}
                  >
                    {r.tag}
                  </span>
                  <span
                    style={{ fontFamily: SANS, fontSize: 28, color: "#fff" }}
                  >
                    {r.t}
                  </span>
                </div>
              );
            })}
            <div
              style={{
                fontFamily: MONO,
                fontSize: 20,
                color: MULE.mid,
                marginTop: 10,
              }}
            >
              $0.04 · AWS Bedrock · 28s
            </div>
          </Card>
        )}
        {/* the Scan button (rect-aligned with the cursor) */}
        {!scanned && (
          <div
            style={{
              position: "absolute",
              left: ACTION_BTN.x - MAINX,
              top: ACTION_BTN.y - 150,
              width: ACTION_BTN.w,
              height: ACTION_BTN.h,
              background: MULE.indigo,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              transform: `scale(${click > 0 ? 0.96 : 1})`,
              boxShadow: `0 0 28px ${MULE.indigo}88`,
            }}
          >
            Scan Contract
          </div>
        )}
      </MuleChrome>
      {!scanned && <TipCursor tx={cxx} ty={cyy} click={click} />}
    </>
  );
};

// 6 — LAW_HOME: property records lookup (public records, $0)
const LawHome: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const enter = ipl(bi.localF, 0, 10, 0, 1, ease);
  const cursorP = ipl(
    bi.localF,
    bi.durF * 0.16,
    bi.durF * 0.32,
    0,
    1,
    easeInOut,
  );
  const click = ipl(bi.localF, bi.durF * 0.3, bi.durF * 0.4, 1, 0);
  const got = bi.localF > bi.durF * 0.38;
  const BTN = { rx: MAINW - 192, ry: 0, w: 184, h: 70 }; // children-relative rect
  const btnCx = MAINX + BTN.rx + BTN.w / 2,
    btnCy = 150 + BTN.ry + BTN.h / 2;
  const fromX = MAINX + 300,
    fromY = 1100;
  const cxx = fromX + (btnCx - fromX) * cursorP,
    cyy = fromY + (btnCy - fromY) * cursorP;
  const fields = [
    ["Owner", "Robert & Lisa Mercer"],
    ["PIN", "05-21-407-018-0000"],
    ["Assessed value", "$612,400"],
    ["Annual tax", "$11,240"],
    ["Built", "1998 · 4 bd / 3 ba"],
    ["Last sale", "2019 · $540,000"],
  ];
  return (
    <>
      <MuleChrome activeIdx={10} frame={frame} title="Property Records">
        <div
          style={{
            position: "relative",
            height: 70,
            marginBottom: 22,
            opacity: enter,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: MAINW - 208,
              height: 70,
              background: MULE.sunken,
              border: `1px solid ${MULE.border}`,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              padding: "0 22px",
              fontFamily: SANS,
              fontSize: 26,
              color: MULE.text,
              boxSizing: "border-box",
            }}
          >
            🔍 14 Oak St, Wheaton, DuPage
          </div>
          <div
            style={{
              position: "absolute",
              left: BTN.rx,
              top: BTN.ry,
              width: BTN.w,
              height: BTN.h,
              background: MULE.indigo,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              transform: `scale(${click > 0 ? 0.96 : 1})`,
              boxShadow: `0 0 24px ${MULE.indigo}88`,
            }}
          >
            Look up
          </div>
        </div>
        {got && (
          <Card
            style={{
              padding: 30,
              opacity: ipl(bi.localF, bi.durF * 0.38, bi.durF * 0.5, 0, 1),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                14 Oak St., Wheaton
              </div>
              {badge("✓ Public records", MULE.ok, MULE.okFill)}
              {badge("$0.00", MULE.ok, MULE.okFill)}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px 40px",
              }}
            >
              {fields.map((f, i) => (
                <div
                  key={i}
                  style={{
                    opacity: ipl(
                      bi.localF,
                      bi.durF * 0.46 + i * 3,
                      bi.durF * 0.46 + i * 3 + 6,
                      0,
                      1,
                      ease,
                    ),
                  }}
                >
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: MULE.mid,
                      textTransform: "uppercase",
                    }}
                  >
                    {f[0]}
                  </div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 30,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {f[1]}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </MuleChrome>
      {!got && <TipCursor tx={cxx} ty={cyy} click={click} />}
    </>
  );
};

// 7 — LAW_EMAIL: email → contacts (human approves with a click)
const LawEmail: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const enter = ipl(bi.localF, 0, 10, 0, 1, ease);
  const cursorP = ipl(
    bi.localF,
    bi.durF * 0.45,
    bi.durF * 0.62,
    0,
    1,
    easeInOut,
  );
  const click = ipl(bi.localF, bi.durF * 0.6, bi.durF * 0.7, 1, 0);
  const done = bi.localF > bi.durF * 0.66;
  const btn = { x: MAINX + 150, y: 1010, w: 360, h: 84 };
  const btnCx = btn.x + btn.w / 2,
    btnCy = btn.y + btn.h / 2;
  const fromX = MAINX + 600,
    fromY = 600;
  const cxx = fromX + (btnCx - fromX) * cursorP,
    cyy = fromY + (btnCy - fromY) * cursorP;
  const people = [
    ["Sarah Diaz", "buyer", "sdiaz@gmail.com"],
    ["Tom Reilly", "buyer's agent", "tom@kw.com"],
    ["Wheaton Title", "title co.", "ops@wht.com"],
    ["First Trust", "lender", "loans@ftb.com"],
  ];
  return (
    <>
      <MuleChrome activeIdx={11} frame={frame} title="Email → Contacts">
        <div
          style={{
            fontFamily: SANS,
            fontSize: 26,
            color: MULE.mid,
            marginBottom: 18,
            opacity: enter,
          }}
        >
          Scanned today's inbox · {done ? "4 added" : "4 new people found"}
        </div>
        <Card style={{ overflow: "hidden", opacity: enter }}>
          {people.map((p, i) => {
            const a = ipl(bi.localF, 8 + i * 5, 8 + i * 5 + 8, 0, 1, ease);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "20px 24px",
                  borderBottom: `1px solid ${MULE.border}`,
                  opacity: a,
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: `${MULE.indigo}33`,
                    color: MULE.indigoHi,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 20,
                  }}
                >
                  {p[0][0]}
                </span>
                <span
                  style={{
                    width: "30%",
                    fontFamily: SANS,
                    fontSize: 26,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {p[0]}
                </span>
                <span style={{ width: "26%" }}>
                  {badge(p[1], MULE.indigoHi, `${MULE.indigo}22`)}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: MONO,
                    fontSize: 22,
                    color: MULE.mid,
                  }}
                >
                  {p[2]}
                </span>
                <span
                  style={{ fontSize: 28, color: done ? MULE.ok : MULE.mid }}
                >
                  {done ? "✓" : "☑"}
                </span>
              </div>
            );
          })}
        </Card>
        <div
          style={{
            position: "absolute",
            left: btn.x - MAINX,
            top: btn.y - 150,
            width: btn.w,
            height: btn.h,
            background: done ? MULE.okFill : MULE.indigo,
            border: done ? `2px solid ${MULE.ok}` : "none",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 800,
            color: done ? MULE.ok : "#fff",
            transform: `scale(${click > 0 ? 0.96 : 1})`,
            boxShadow: done ? "none" : `0 0 28px ${MULE.indigo}88`,
          }}
        >
          {done ? "✓ 4 contacts added" : "Create 4 contacts"}
        </div>
      </MuleChrome>
      {!done && <TipCursor tx={cxx} ty={cyy} click={click} />}
    </>
  );
};

// 5 — PIVOT (two opposite worlds)
const Pivot: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const wipe = ipl(bi.localF, 4, bi.durF * 0.5, 0, 1, ease);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          right: "50%",
          background: `linear-gradient(180deg,${LAW.bg2},${LAW.bg})`,
          borderRight: `2px solid ${LAW.indigo}`,
        }}
      >
        <DotGrid color={LAW.indigo} opacity={0.4} frame={frame} />
        <Bloom color="rgba(99,102,241,0.4)" />
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 92 }}>⚖️</div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 34,
              fontWeight: 800,
              color: LAW.indigoHi,
              marginTop: 12,
            }}
          >
            LAW FIRM
          </div>
          <div style={{ fontFamily: SANS, fontSize: 24, color: LAW.soft }}>
            cases & documents
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          left: "50%",
          background: `linear-gradient(180deg,${FIRE.bg2},${FIRE.bg})`,
          borderLeft: `2px solid ${FIRE.copper}`,
          transform: `translateX(${(1 - wipe) * 100}%)`,
        }}
      >
        <DotGrid color={FIRE.copper} opacity={0.4} frame={frame} />
        <Bloom color="rgba(240,116,42,0.4)" />
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 92 }}>🦺💧</div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 34,
              fontWeight: 800,
              color: FIRE.copperHi,
              marginTop: 12,
            }}
          >
            FIRE & WATER REPAIR
          </div>
          <div style={{ fontFamily: SANS, fontSize: 24, color: FIRE.soft }}>
            jobs & dollars
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${wipe * 50}%`,
          width: 8,
          background: "#fff",
          filter: "blur(3px)",
          opacity: wipe < 1 ? 1 : 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 360,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 40,
          fontWeight: 800,
          color: "#fff",
          opacity: ipl(bi.localF, bi.durF * 0.5, bi.durF * 0.65, 0, 1),
          textShadow: "0 4px 20px #000",
        }}
      >
        Same builder.
      </div>
    </AbsoluteFill>
  );
};

// 6 — RESTO money (money is the hero)
const RestoMoney: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const tilt = ipl(bi.localF, 0, bi.durF * 0.4, 10, 0, easeInOut);
  const push = 1 + ipl(bi.localF, 0, bi.durF * 0.5, 0.0, 0.14);
  const num = countUp(frame, bi.sF + 4, bi.durF * 0.55, 612480);
  const glow = 0.7 + 0.3 * Math.abs(Math.sin(bi.localF / 7));
  const kpiA = (i: number) =>
    ipl(
      bi.localF,
      bi.durF * 0.55 + i * 4,
      bi.durF * 0.55 + i * 4 + 12,
      0,
      1,
      ease,
    );
  const sweep = ipl(bi.localF, bi.durF * 0.5, bi.durF * 0.72, 0, 1);
  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${FIRE.bg2}, ${FIRE.bg})` }}
    >
      <DotGrid color={FIRE.copper} opacity={0.3} frame={frame} speed={0.22} />
      <Bloom color="rgba(240,116,42,0.42)" />
      <Stage tilt={tilt} scale={push}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: FIRE.soft,
            }}
          >
            Jobs sold this year
          </div>
          <div
            style={{
              position: "relative",
              fontFamily: SANS,
              fontSize: 220,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              color: FIRE.copperHi,
              textShadow: `0 0 ${70 * glow}px ${FIRE.copper}`,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {fmtMoney(num)}
            <LightSweep p={sweep} />
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 50 }}>
            {[
              { l: "Jobs won", v: "38" },
              { l: "Average job", v: "$16,100" },
              { l: "New customers", v: "52" },
            ].map((k, i) => (
              <div
                key={i}
                style={{
                  background: FIRE.card,
                  border: `1px solid ${FIRE.border}`,
                  borderRadius: 18,
                  padding: "22px 30px",
                  opacity: kpiA(i),
                  transform: `translateY(${(1 - kpiA(i)) * 26}px)`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 22,
                    fontWeight: 700,
                    color: FIRE.soft,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {k.l}
                </div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 50,
                    fontWeight: 800,
                    color: FIRE.text,
                  }}
                >
                  {k.v}
                </div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 22,
                    fontWeight: 700,
                    color: FIRE.emerald,
                  }}
                >
                  ▲ up 22%
                </div>
              </div>
            ))}
          </div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

// 7 — RESTO pipeline (customer card travels across 4 plain columns)
const RestoPipe: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const cols = [
    "New call",
    "We followed up",
    "We sent a price",
    "Got the job 💰",
  ];
  const colW = 232;
  const gap = 20;
  const enter = ipl(bi.localF, 0, 12, 0, 1, ease);
  const travel = ipl(
    bi.localF,
    bi.durF * 0.18,
    bi.durF * 0.82,
    0,
    3,
    easeInOut,
  );
  const stageIdx = Math.min(3, Math.round(travel));
  const cardX = 60 + travel * (colW + gap);
  const stamped = ipl(bi.localF, bi.durF * 0.78, bi.durF * 0.9, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${FIRE.bg2}, ${FIRE.bg})` }}
    >
      <DotGrid color={FIRE.copper} opacity={0.26} frame={frame} />
      <Bloom color="rgba(240,116,42,0.36)" />
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 44,
          fontWeight: 800,
          color: FIRE.text,
          opacity: enter,
        }}
      >
        Watch a customer become a paid job
      </div>
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 60,
          right: 60,
          display: "flex",
          gap,
        }}
      >
        {cols.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background:
                i === stageIdx ? `${FIRE.copper}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${i === stageIdx ? FIRE.copper : FIRE.border}`,
              borderRadius: 18,
              padding: "18px 14px",
              minHeight: 520,
              boxShadow: i === stageIdx ? `0 0 30px ${FIRE.copper}55` : "none",
              opacity: enter,
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontSize: 24,
                fontWeight: 700,
                color: i === 3 ? FIRE.emerald : FIRE.soft,
                textAlign: "center",
              }}
            >
              {c}
            </div>
          </div>
        ))}
      </div>
      {/* traveling customer card */}
      <div
        style={{
          position: "absolute",
          top: 640,
          left: cardX,
          width: colW - 14,
          background: "#1c130c",
          border: `2px solid ${stageIdx === 3 ? FIRE.emerald : FIRE.copper}`,
          borderRadius: 16,
          padding: 20,
          boxShadow: `0 18px 50px rgba(0,0,0,0.6), 0 0 30px ${FIRE.copper}66`,
          opacity: enter,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 30,
            color: FIRE.text,
          }}
        >
          John Smith
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <span
            style={{
              background: `${FIRE.info}33`,
              color: FIRE.info,
              borderRadius: 8,
              padding: "5px 12px",
              fontFamily: SANS,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            💧 Water
          </span>
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 20,
            color: FIRE.soft,
            marginTop: 10,
          }}
        >
          Flooded basement
        </div>
        {stamped > 0 && (
          <div
            style={{
              marginTop: 16,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 40,
              color: FIRE.emerald,
              opacity: stamped,
              transform: `scale(${0.8 + stamped * 0.2})`,
              textShadow: `0 0 20px ${FIRE.emerald}`,
            }}
          >
            $14,200
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// 8 — AI beat (the Jarvis moment): messy text → scan → tokens → clean card
const AiText: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const enter = ipl(bi.localF, 0, 12, 0, 1, ease);
  const msg =
    "hey its john my basement flooded last night 312-555-1234 can someone come look thurs?";
  const typeP = ipl(bi.localF, 8, bi.durF * 0.28, 0, 1);
  const shown = msg.slice(0, Math.floor(msg.length * typeP));
  const scanY = ipl(bi.localF, bi.durF * 0.34, bi.durF * 0.52, 360, 620);
  const scanOn = bi.localF > bi.durF * 0.34 && bi.localF < bi.durF * 0.56;
  const tokens = [
    { label: "Name", val: "John Smith", t: 0.5 },
    { label: "Phone", val: "312-555-1234", t: 0.56 },
    { label: "Job", val: "Water damage – basement", t: 0.62 },
  ];
  const cardAssemble = ipl(
    bi.localF,
    bi.durF * 0.48,
    bi.durF * 0.66,
    0,
    1,
    ease,
  );
  const saved = ipl(bi.localF, bi.durF * 0.78, bi.durF * 0.9, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background: "#070A10",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={FIRE.copper} opacity={0.18} frame={frame} />
      <Bloom color="rgba(240,116,42,0.3)" />
      {/* full-screen phone */}
      <div
        style={{
          width: 880,
          height: 1680,
          borderRadius: 78,
          background: "#0E1621",
          border: "12px solid #1b2a3a",
          boxShadow: "0 40px 140px rgba(0,0,0,0.8)",
          overflow: "hidden",
          position: "relative",
          opacity: enter,
        }}
      >
        <div
          style={{
            height: 130,
            background: "#17212B",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: "50%",
              background: FIRE.copper,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            🤖
          </div>
          <div>
            <div
              style={{
                fontFamily: SANS,
                color: "#fff",
                fontWeight: 700,
                fontSize: 32,
              }}
            >
              Auto-assistant
            </div>
            <div
              style={{ fontFamily: SANS, color: FIRE.emerald, fontSize: 22 }}
            >
              ● working 24/7
            </div>
          </div>
        </div>
        {/* messy incoming text */}
        <div style={{ position: "relative", padding: 36 }}>
          <div
            style={{
              maxWidth: "88%",
              background: "#2B5278",
              color: "#fff",
              borderRadius: "26px 26px 26px 6px",
              padding: "26px 30px",
              fontFamily: SANS,
              fontSize: 34,
              lineHeight: 1.42,
              opacity: typeP > 0 ? 1 : 0,
            }}
          >
            {shown}
            {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
          </div>
          {/* scan line */}
          {scanOn && (
            <div
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                top: scanY,
                height: 6,
                background: `linear-gradient(90deg, transparent, ${FIRE.copperHi}, transparent)`,
                boxShadow: `0 0 26px ${FIRE.copper}`,
                borderRadius: 3,
              }}
            />
          )}
          {/* clean card assembling */}
          {cardAssemble > 0 && (
            <div
              style={{
                marginTop: 40,
                background: "#101722",
                border: `2px solid ${saved > 0 ? FIRE.emerald : FIRE.copper}`,
                borderRadius: 24,
                padding: 34,
                opacity: cardAssemble,
                boxShadow: `0 0 50px ${FIRE.copper}55`,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  fontWeight: 800,
                  color: saved > 0 ? FIRE.emerald : FIRE.copperHi,
                  marginBottom: 18,
                  letterSpacing: "0.06em",
                }}
              >
                {saved > 0 ? "✓ NEW JOB SAVED" : "READING…"}
              </div>
              {tokens.map((tk, i) => {
                const fieldIn = ipl(
                  bi.localF,
                  bi.durF * tk.t,
                  bi.durF * tk.t + 8,
                  0,
                  1,
                  ease,
                );
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 16,
                      marginBottom: 16,
                      opacity: fieldIn,
                      alignItems: "baseline",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: SANS,
                        fontSize: 26,
                        fontWeight: 700,
                        color: FIRE.soft,
                        width: 130,
                      }}
                    >
                      {tk.label}:
                    </div>
                    <div
                      style={{
                        fontFamily: i === 1 ? MONO : SANS,
                        fontSize: 34,
                        fontWeight: 700,
                        color: "#fff",
                        textShadow: `0 0 14px ${FIRE.copper}88`,
                      }}
                    >
                      {tk.val}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 9 — PROOF → YOURS (two HUD cards morph into "your business")
const ProofTurn: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const inP = ipl(bi.localF, 0, 14, 0, 1, ease);
  const morph = ipl(bi.localF, bi.durF * 0.55, bi.durF * 0.78, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0b0d16 0%, #050609 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.2} frame={frame} />
      <div style={{ display: "flex", gap: 40, opacity: inP }}>
        {/* law card */}
        <div
          style={{
            width: 380,
            height: 540,
            background: LAW.bg2,
            borderRadius: 28,
            border: `2px solid ${LAW.indigo}88`,
            boxShadow: `0 0 60px ${LAW.indigo}55`,
            padding: 30,
            opacity: 1 - morph * 0.6,
            transform: `translateX(${-morph * 60}px) scale(${1 - morph * 0.1})`,
          }}
        >
          <div style={{ fontSize: 64 }}>⚖️</div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 38,
              color: "#fff",
              marginTop: 16,
            }}
          >
            A law firm
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 26,
              color: LAW.indigoHi,
              marginTop: 8,
            }}
          >
            Every case in one place
          </div>
        </div>
        {/* restoration → your business card */}
        <div
          style={{
            width: 380,
            height: 540,
            background: morph > 0.5 ? "rgba(255,255,255,0.04)" : FIRE.bg2,
            borderRadius: 28,
            border: `2px ${morph > 0.5 ? "dashed" : "solid"} ${morph > 0.5 ? "#fff" : FIRE.copper}88`,
            boxShadow: `0 0 60px ${morph > 0.5 ? "rgba(255,255,255,0.3)" : FIRE.copper + "55"}`,
            padding: 30,
          }}
        >
          {morph < 0.5 ? (
            <>
              <div style={{ fontSize: 64 }}>🦺💧</div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 38,
                  color: "#fff",
                  marginTop: 16,
                }}
              >
                A repair company
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  color: FIRE.copperHi,
                  marginTop: 8,
                }}
              >
                $612k in jobs tracked
              </div>
            </>
          ) : (
            <div style={{ opacity: morph }}>
              <div style={{ fontSize: 64 }}>✨</div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 40,
                  color: "#fff",
                  marginTop: 16,
                }}
              >
                YOUR business
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  color: "#fff",
                  marginTop: 18,
                  lineHeight: 1.7,
                }}
              >
                YOUR jobs
                <br />
                YOUR customers
                <br />
                YOUR money
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 430,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: inP,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 38,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          Two real businesses. One person built both.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 600,
            color: LAW.indigoHi,
            marginTop: 12,
            opacity: morph,
          }}
        >
          Whatever you do, I build the software that runs it.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 10 — CLOSE / CTA (slowed: wordmark held, then phone held)
const CloseCta: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
  brand: string;
  phone: string;
  logoUrl: string;
}> = ({ frame, fps, bi, brand, phone, logoUrl }) => {
  const logoSpring = spring({
    frame: bi.localF,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.8 },
  });
  const sweep = ipl(bi.localF, 8, 30, -1, 2);
  // phase 2: phone number hero, starts ~35% in
  const phoneStart = bi.durF * 0.34;
  const wordUp = ipl(bi.localF, phoneStart - 6, phoneStart + 8, 0, 1, ease); // wordmark moves up
  const phoneIn = ipl(bi.localF, phoneStart, phoneStart + 12, 0, 1, ease);
  const pulse = 1 + 0.03 * Math.sin(bi.localF / 6);
  const lineIn = ipl(bi.localF, phoneStart + 14, phoneStart + 26, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, #0c1020 0%, #050608 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.24} frame={frame} />
      <Bloom color="rgba(99,102,241,0.3)" />
      <div
        style={{
          textAlign: "center",
          transform: `translateY(${-wordUp * 360}px)`,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            transform: `scale(${0.7 + logoSpring * 0.3})`,
            opacity: logoSpring,
          }}
        >
          {logoUrl ? (
            <Img src={logoUrl} style={{ height: 150, objectFit: "contain" }} />
          ) : (
            <div
              style={{
                position: "relative",
                fontFamily: SANS,
                fontSize: 108,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#fff",
              }}
            >
              Simply Scaled
              <LightSweep p={sweep} />
            </div>
          )}
          <div
            style={{
              height: 8,
              borderRadius: 4,
              marginTop: 16,
              background: "linear-gradient(90deg, #6366F1, #F0742A)",
              opacity: logoSpring,
            }}
          />
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.8)",
            marginTop: 26,
            opacity: logoSpring,
          }}
        >
          Custom software + AI for local businesses
        </div>
      </div>
      {/* phone hero */}
      <div
        style={{
          position: "absolute",
          top: "46%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: phoneIn,
          transform: `scale(${pulse})`,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 120,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.01em",
            textShadow: `0 0 50px ${LAW.indigo}`,
          }}
        >
          📞 {phone}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 38,
            fontWeight: 700,
            color: LAW.indigoHi,
            marginTop: 10,
          }}
        >
          Call or text
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 360,
          left: 80,
          right: 80,
          textAlign: "center",
          opacity: lineIn,
          fontFamily: SANS,
          fontSize: 36,
          fontWeight: 600,
          color: "rgba(255,255,255,0.9)",
          lineHeight: 1.4,
        }}
      >
        Free 15-minute call. I'll tell you exactly what to automate first. No
        pitch.
      </div>
    </AbsoluteFill>
  );
};

// Smooth screen-to-screen transition: a quick scale + crossfade so every cut
// reads as a motivated camera move, not a hard slideshow jump. `last` keeps the
// final CTA from fading out at the end.
const Trans: React.FC<{
  bi: BeatInfo;
  last?: boolean;
  children: React.ReactNode;
}> = ({ bi, last, children }) => {
  const inP = ipl(bi.localF, 0, 8, 0, 1, ease);
  const outP = last ? 0 : ipl(bi.localF, bi.durF - 6, bi.durF, 0, 1);
  const op = Math.min(inP, 1 - outP);
  const scale = 1 + (1 - inP) * 0.05 + outP * 0.03;
  return (
    <AbsoluteFill
      style={{
        opacity: op,
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════════════
export const SimplyScaledReel: React.FC<SimplyScaledReelProps> = ({
  beats,
  brand = "Simply Scaled",
  phone = "(847) 212-2142",
  logoUrl = "",
  lite = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bts = beats && beats.length ? beats : buildDefaultBeats();
  const b = useBeats(bts, fps, frame);
  const activeKey = bts.find(
    (x) =>
      frame >= Math.round(x.start * fps) &&
      frame < Math.round((x.start + x.dur) * fps),
  )?.key;
  const fireKeys = ["RESTO_MONEY", "RESTO_PIPE", "AI_TEXT"];
  const accent =
    activeKey && fireKeys.includes(activeKey) ? FIRE.copper : LAW.indigo;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {b.PROOF_FLASH.visible && (
        <Trans bi={b.PROOF_FLASH}>
          <ProofFlash frame={frame} fps={fps} bi={b.PROOF_FLASH} />
        </Trans>
      )}
      {b.HOOK.visible && (
        <Trans bi={b.HOOK}>
          <HookScene frame={frame} fps={fps} bi={b.HOOK} />
        </Trans>
      )}
      {b.BRIDGE.visible && (
        <Trans bi={b.BRIDGE}>
          <BridgeScene frame={frame} fps={fps} bi={b.BRIDGE} />
        </Trans>
      )}
      {b.LAW_TOUR.visible && (
        <Trans bi={b.LAW_TOUR}>
          <LawTour frame={frame} fps={fps} bi={b.LAW_TOUR} />
        </Trans>
      )}
      {b.LAW_PDF.visible && (
        <Trans bi={b.LAW_PDF}>
          <LawPdf frame={frame} fps={fps} bi={b.LAW_PDF} />
        </Trans>
      )}
      {b.LAW_HOME.visible && (
        <Trans bi={b.LAW_HOME}>
          <LawHome frame={frame} fps={fps} bi={b.LAW_HOME} />
        </Trans>
      )}
      {b.LAW_EMAIL.visible && (
        <Trans bi={b.LAW_EMAIL}>
          <LawEmail frame={frame} fps={fps} bi={b.LAW_EMAIL} />
        </Trans>
      )}
      {b.PIVOT.visible && (
        <Trans bi={b.PIVOT}>
          <Pivot frame={frame} fps={fps} bi={b.PIVOT} />
        </Trans>
      )}
      {b.RESTO_MONEY.visible && (
        <Trans bi={b.RESTO_MONEY}>
          <RestoMoney frame={frame} fps={fps} bi={b.RESTO_MONEY} />
        </Trans>
      )}
      {b.RESTO_PIPE.visible && (
        <Trans bi={b.RESTO_PIPE}>
          <RestoPipe frame={frame} fps={fps} bi={b.RESTO_PIPE} />
        </Trans>
      )}
      {b.AI_TEXT.visible && (
        <Trans bi={b.AI_TEXT}>
          <AiText frame={frame} fps={fps} bi={b.AI_TEXT} />
        </Trans>
      )}
      {b.PROOF_TURN.visible && (
        <Trans bi={b.PROOF_TURN}>
          <ProofTurn frame={frame} fps={fps} bi={b.PROOF_TURN} />
        </Trans>
      )}
      {b.CLOSE_CTA.visible && (
        <Trans bi={b.CLOSE_CTA} last>
          <CloseCta
            frame={frame}
            fps={fps}
            bi={b.CLOSE_CTA}
            brand={brand}
            phone={phone}
            logoUrl={logoUrl}
          />
        </Trans>
      )}

      {/* small persistent wordmark (hidden during close) */}
      {activeKey !== "CLOSE_CTA" && (
        <div
          style={{
            position: "absolute",
            top: 58,
            right: 54,
            fontFamily: SANS,
            fontSize: 24,
            fontWeight: 800,
            color: "rgba(255,255,255,0.55)",
            zIndex: 7600,
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}
        >
          {brand}
        </div>
      )}

      {activeKey && CAPTIONS[activeKey] && (
        <Caption
          text={CAPTIONS[activeKey]}
          localF={b[activeKey].localF}
          durF={b[activeKey].durF}
          fps={fps}
          accent={accent}
          big={activeKey === "HOOK"}
        />
      )}

      <Vignette />
      {!lite && <Grain />}
    </AbsoluteFill>
  );
};
