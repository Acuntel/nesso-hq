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
  { key: "HOOK", dur: 7 },
  { key: "BRIDGE", dur: 4 },
  { key: "LAW_FULL", dur: 6 },
  { key: "LAW_MONEY", dur: 5 },
  { key: "PIVOT", dur: 4 },
  { key: "RESTO_MONEY", dur: 6 },
  { key: "RESTO_PIPE", dur: 6 },
  { key: "AI_TEXT", dur: 8 },
  { key: "PROOF_TURN", dur: 6 },
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
  BRIDGE: "IMAGINE A COMPUTER JUST… DOES THEM FOR YOU.",
  LAW_FULL: "A LAW FIRM: EVERY CASE, FILE & DOCUMENT — ONE PLACE.",
  LAW_MONEY: "SEE WHAT YOU EARNED — AND WHAT YOU'RE STILL OWED.",
  PIVOT: "SAME BUILDER. A COMPLETELY DIFFERENT BUSINESS.",
  RESTO_MONEY: "A FIRE & WATER REPAIR CO. — $612,480 IN JOBS SOLD.",
  RESTO_PIPE: "EVERY CUSTOMER — FROM FIRST CALL TO PAID JOB.",
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

// 2 — BRIDGE (problems funnel into one device, green checks)
const BridgeScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const conv = ipl(bi.localF, 0, bi.durF * 0.55, 0, 1, ease);
  const lock = ipl(bi.localF, bi.durF * 0.5, bi.durF * 0.62, 0, 1, ease);
  const bloom = ipl(bi.localF, bi.durF * 0.55, bi.durF * 0.7, 0, 1);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0c1020 0%, #05060a 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.3} frame={frame} />
      <Bloom color={`rgba(99,102,241,${0.4 * bloom})`} />
      {/* converging pain rows */}
      {PAINS.map((p, i) => {
        const ang = (i / PAINS.length) * Math.PI * 2;
        const r = (1 - conv) * 520;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r - 40;
        const checked = lock > 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(${x - 40}px, ${y - 40}px) scale(${0.6 + 0.4 * (1 - conv)})`,
              opacity: conv < 0.95 ? 1 : 1 - lock,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: checked
                ? "rgba(52,211,153,0.16)"
                : "rgba(244,71,95,0.14)",
              border: `1px solid ${checked ? FIRE.emerald : RED}`,
              borderRadius: 12,
              padding: "8px 12px",
              fontFamily: SANS,
              fontSize: 22,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            {checked ? "✓" : p.icon} {p.t}
          </div>
        );
      })}
      {/* the device */}
      <div
        style={{
          width: 280,
          height: 340,
          borderRadius: 32,
          background: "linear-gradient(160deg,#1a2440,#0e1424)",
          border: `2px solid ${LAW.indigoHi}`,
          boxShadow: `0 0 ${80 * bloom}px ${LAW.indigo}`,
          transform: `scale(${0.6 + lock * 0.5})`,
          opacity: conv,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 90,
        }}
      >
        ⚡
      </div>
      <div
        style={{
          position: "absolute",
          top: 360,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 50,
          fontWeight: 800,
          color: "#fff",
          opacity: lock,
          padding: "0 80px",
          textShadow: `0 0 30px ${LAW.indigo}`,
        }}
      >
        Now imagine a computer just…{" "}
        <span style={{ color: LAW.indigoHi }}>does them for you.</span>
      </div>
    </AbsoluteFill>
  );
};

// 3 — LAW vault: cases + client file + document flip (full screen)
const LawFull: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const enter = ipl(bi.localF, 0, 14, 0, 1, ease);
  const tilt = ipl(bi.localF, 0, bi.durF * 0.55, -13, 0, easeInOut); // settle to flat
  const push = 1 + ipl(bi.localF, bi.durF * 0.45, bi.durF, 0, 0.16); // Z push into doc
  const flip = ipl(bi.localF, bi.durF * 0.42, bi.durF * 0.72, 0, 1, ease);
  const cursorP = ipl(bi.localF, bi.durF * 0.25, bi.durF * 0.42, 0, 1, ease);
  const click = ipl(bi.localF, bi.durF * 0.4, bi.durF * 0.5, 1, 0);
  const cx = 540 + (1 - cursorP) * 260;
  const cy = 1180 + (1 - cursorP) * 160;
  const cases = [
    { n: "Johnson — 14 Oak St.", t: "Home Purchase" },
    { n: "Mercer Estate", t: "Estate Plan" },
    { n: "Diaz v. Whitfield", t: "Litigation" },
  ];
  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${LAW.bg2}, ${LAW.bg})` }}
    >
      <DotGrid color={LAW.indigo} opacity={0.28} frame={frame} />
      <Bloom color="rgba(99,102,241,0.32)" />
      <Stage tilt={tilt} scale={push} shadow="rgba(0,0,0,0.5)">
        <div
          style={{ position: "absolute", inset: "120px 60px", opacity: enter }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: LAW.indigoHi,
            }}
          >
            CLIENTS · DOCUMENTS · CASES
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 56,
              fontWeight: 800,
              color: LAW.text,
              marginTop: 8,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Every case & file,
            <br />
            in one place.
          </div>
          {/* cases list */}
          <div
            style={{
              marginTop: 40,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {cases.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  background: LAW.card,
                  border: `1px solid ${LAW.border}`,
                  borderRadius: 18,
                  padding: "24px 28px",
                  opacity: ipl(
                    bi.localF,
                    8 + i * 5,
                    8 + i * 5 + 12,
                    0,
                    1,
                    ease,
                  ),
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 12,
                    background: `${LAW.indigo}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                  }}
                >
                  📁
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: 34,
                      color: LAW.text,
                    }}
                  >
                    {c.n}
                  </div>
                  <div
                    style={{ fontFamily: SANS, fontSize: 24, color: LAW.soft }}
                  >
                    {c.t}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 22,
                    fontWeight: 700,
                    color: LAW.indigoHi,
                    background: `${LAW.indigo}22`,
                    borderRadius: 999,
                    padding: "6px 16px",
                  }}
                >
                  Open
                </div>
              </div>
            ))}
          </div>
          {/* document that flips open */}
          <div
            style={{
              marginTop: 40,
              position: "relative",
              height: 520,
              perspective: 1400,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#F4F1EA",
                borderRadius: 16,
                transformOrigin: "left center",
                transform: `rotateY(${-(1 - flip) * 78}deg)`,
                boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
                overflow: "hidden",
                padding: "44px 50px",
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 30,
                  color: "#1a1a1a",
                }}
              >
                PURCHASE AGREEMENT
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  color: "#555",
                  marginTop: 6,
                }}
              >
                Johnson — 14 Oak St.
              </div>
              {[0, 1, 2, 3, 4].map((k) => (
                <div
                  key={k}
                  style={{
                    height: 12,
                    borderRadius: 3,
                    background: "#d8d4ca",
                    marginTop: 20,
                    width: `${92 - k * 9}%`,
                  }}
                />
              ))}
              <div
                style={{
                  marginTop: 46,
                  fontFamily: "'Brush Script MT', cursive",
                  fontSize: 44,
                  color: "#1f3a8a",
                  borderBottom: "2px solid #999",
                  display: "inline-block",
                  paddingBottom: 4,
                  opacity: flip,
                }}
              >
                signed
              </div>
              {flip > 0.6 && (
                <LightSweep
                  p={ipl(bi.localF, bi.durF * 0.72, bi.durF * 0.9, 0, 1)}
                />
              )}
            </div>
          </div>
        </div>
      </Stage>
      <Cursor x={cx} y={cy} click={click} />
    </AbsoluteFill>
  );
};

// 4 — LAW money (single clean line + count-up)
const LawMoney: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const draw = ipl(bi.localF, 6, bi.durF * 0.7, 0, 1, ease);
  const num = countUp(frame, bi.sF + bi.durF * 0.45, bi.durF * 0.45, 284900);
  const owed = countUp(frame, bi.sF + bi.durF * 0.55, bi.durF * 0.4, 112750);
  const numIn = ipl(bi.localF, bi.durF * 0.45, bi.durF * 0.6, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${LAW.bg2}, ${LAW.bg})`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.22} frame={frame} />
      <Bloom color="rgba(99,102,241,0.3)" />
      <div style={{ width: 920, textAlign: "center" }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: LAW.indigoHi,
            marginBottom: 24,
          }}
        >
          FEES COLLECTED — MONTH BY MONTH
        </div>
        <LineChart
          draw={Math.max(0.001, draw)}
          color={LAW.sky}
          glow={LAW.indigo}
          width={920}
          height={360}
          data={[20, 26, 24, 32, 38, 36, 46, 54, 60, 68, 76, 90]}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 80,
            marginTop: 36,
            opacity: numIn,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 26,
                fontWeight: 700,
                color: LAW.soft,
              }}
            >
              Earned this month
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 84,
                fontWeight: 800,
                color: "#fff",
                textShadow: `0 0 36px ${LAW.indigo}`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtMoney(num)}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 26,
                fontWeight: 700,
                color: LAW.soft,
              }}
            >
              Still owed to you
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 84,
                fontWeight: 800,
                color: LAW.indigoHi,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtMoney(owed)}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
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
        Free 15-minute call — I'll tell you exactly what to automate first. No
        pitch.
      </div>
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
      {b.HOOK.visible && <HookScene frame={frame} fps={fps} bi={b.HOOK} />}
      {b.BRIDGE.visible && (
        <BridgeScene frame={frame} fps={fps} bi={b.BRIDGE} />
      )}
      {b.LAW_FULL.visible && (
        <LawFull frame={frame} fps={fps} bi={b.LAW_FULL} />
      )}
      {b.LAW_MONEY.visible && (
        <LawMoney frame={frame} fps={fps} bi={b.LAW_MONEY} />
      )}
      {b.PIVOT.visible && <Pivot frame={frame} fps={fps} bi={b.PIVOT} />}
      {b.RESTO_MONEY.visible && (
        <RestoMoney frame={frame} fps={fps} bi={b.RESTO_MONEY} />
      )}
      {b.RESTO_PIPE.visible && (
        <RestoPipe frame={frame} fps={fps} bi={b.RESTO_PIPE} />
      )}
      {b.AI_TEXT.visible && <AiText frame={frame} fps={fps} bi={b.AI_TEXT} />}
      {b.PROOF_TURN.visible && (
        <ProofTurn frame={frame} fps={fps} bi={b.PROOF_TURN} />
      )}
      {b.CLOSE_CTA.visible && (
        <CloseCta
          frame={frame}
          fps={fps}
          bi={b.CLOSE_CTA}
          brand={brand}
          phone={phone}
          logoUrl={logoUrl}
        />
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
