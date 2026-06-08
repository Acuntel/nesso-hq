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
  { key: "PAIN_OPEN_DESK", dur: 1.8 },
  { key: "PAIN_CONTRACT", dur: 2.2 },
  { key: "PAIN_COUNTY", dur: 2 },
  { key: "PAIN_INBOX", dur: 1.9 },
  { key: "PAIN_STICKY", dur: 1.6 },
  { key: "PAIN_PEAK", dur: 1.2 },
  { key: "TURN_TO_PROOF", dur: 1.6 },
  { key: "LAW_TOUR", dur: 9 },
  { key: "LAW_PDF", dur: 6 },
  { key: "LAW_HOME", dur: 5.5 },
  { key: "LAW_EMAIL", dur: 5 },
  { key: "MORPH", dur: 2 },
  { key: "RESTO_TEXT", dur: 3 },
  { key: "RESTO_NUMBER", dur: 2.5 },
  { key: "RESTO_LEAD", dur: 3 },
  { key: "RESTO_PIPE", dur: 5 },
  { key: "RESTO_MONEY", dur: 3.5 },
  { key: "PROOF_TURN", dur: 4.6 },
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
  // pain + morph + turn scenes carry their own in-scene text → no global caption
  PAIN_OPEN_DESK: "",
  PAIN_CONTRACT: "",
  PAIN_COUNTY: "",
  PAIN_INBOX: "",
  PAIN_STICKY: "",
  PAIN_PEAK: "",
  TURN_TO_PROOF: "",
  LAW_TOUR: "ONE SYSTEM RUNS THE WHOLE FIRM.",
  LAW_PDF: "AI READS A CONTRACT IN ABOUT 30 SECONDS.",
  LAW_HOME: "FULL PROPERTY RECORDS. ZERO COST.",
  LAW_EMAIL: "A DAY OF EMAIL, INTO READY-TO-SAVE CONTACTS.",
  MORPH: "",
  RESTO_TEXT: "A REAL CUSTOMER TEXTS IN.",
  RESTO_NUMBER: "THE NUMBER IS THE THREAD.",
  RESTO_LEAD: "ONE CLEAN LEAD.",
  RESTO_PIPE: "ONE LEAD. PIPELINE, CONTACTS, MONEY, ALL CONNECTED.",
  RESTO_MONEY: "",
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
// ════════════════════════════════════════════════════════════════════════════
//  PAIN-FIRST OPENING (v7): the manual grind, foreshadowing each built tool.
//  Dim, desaturated "analog" world → silence → turn into the product.
// ════════════════════════════════════════════════════════════════════════════
const PAPER = "#ece7db";
const PAINBG = "radial-gradient(ellipse at 50% 40%, #14110d 0%, #070605 100%)";

const PainVignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      boxShadow: "inset 0 0 340px 90px rgba(0,0,0,0.78)",
      pointerEvents: "none",
      zIndex: 50,
    }}
  />
);
const PainCaption: React.FC<{
  text: string;
  localF: number;
  durF: number;
  fps: number;
}> = ({ text, localF, durF, fps }) => {
  if (!text) return null;
  const op = Math.min(
    ipl(localF, 0, fps * 0.3, 0, 1, ease),
    ipl(localF, durF - fps * 0.25, durF, 1, 0),
  );
  return (
    <div
      style={{
        position: "absolute",
        bottom: 250,
        left: 60,
        right: 60,
        textAlign: "center",
        opacity: op,
        zIndex: 60,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 46,
          letterSpacing: "0.02em",
          color: "rgba(255,255,255,0.92)",
          textShadow: "0 4px 24px rgba(0,0,0,0.9)",
        }}
      >
        {text}
      </span>
    </div>
  );
};

// 1 — desk establish
const PainOpenDesk: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const push = 1 + ipl(bi.localF, 0, bi.durF, 0, 0.05);
  const buzz = Math.sin(bi.localF * 1.1) * (bi.localF % 20 < 6 ? 2 : 0);
  return (
    <AbsoluteFill style={{ background: PAINBG }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${push})`,
          transformOrigin: "50% 45%",
          filter: "saturate(0.5) brightness(0.85)",
        }}
      >
        {/* paper contract */}
        <div
          style={{
            position: "absolute",
            top: 360,
            left: 120,
            width: 420,
            height: 540,
            background: PAPER,
            borderRadius: 6,
            transform: "rotate(-5deg)",
            boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
            padding: 30,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 24,
              color: "#2a2a2a",
            }}
          >
            AGREEMENT
          </div>
          {Array.from({ length: 9 }).map((_, k) => (
            <div
              key={k}
              style={{
                height: 9,
                background: "#c8c2b4",
                borderRadius: 2,
                marginTop: 16,
                width: `${90 - (k % 3) * 12}%`,
              }}
            />
          ))}
        </div>
        {/* sticky notes */}
        <div
          style={{
            position: "absolute",
            top: 300,
            left: 470,
            width: 180,
            height: 180,
            background: "#d9c84a",
            transform: "rotate(8deg)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
            fontFamily: "'Comic Sans MS',cursive",
            fontSize: 30,
            fontWeight: 700,
            color: "#4a4208",
            padding: 18,
          }}
        >
          call back!!
        </div>
        <div
          style={{
            position: "absolute",
            top: 980,
            left: 150,
            width: 150,
            height: 150,
            background: "#cbb a3a",
            transform: "rotate(-12deg)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
          }}
        />
        {/* laptop with tabs */}
        <div
          style={{
            position: "absolute",
            top: 560,
            right: 110,
            width: 520,
            height: 360,
            background: "#0c0f15",
            borderRadius: 12,
            border: "8px solid #1a1a1a",
            boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 8,
              background: "#15181f",
            }}
          >
            {[0, 1, 2, 3, 4].map((t) => (
              <div
                key={t}
                style={{
                  flex: 1,
                  height: 26,
                  background: t === 0 ? "#272b34" : "#1b1e25",
                  borderRadius: 6,
                }}
              />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, k) => (
            <div
              key={k}
              style={{
                height: 10,
                background: "#262a33",
                borderRadius: 2,
                margin: "16px 20px",
              }}
            />
          ))}
        </div>
        {/* phone buzzing */}
        <div
          style={{
            position: "absolute",
            top: 1020,
            right: 200,
            width: 220,
            height: 440,
            background: "#0a0a0c",
            borderRadius: 34,
            border: "6px solid #222",
            transform: `rotate(6deg) translate(${buzz}px,0)`,
            boxShadow: "0 24px 50px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              margin: "60px auto 0",
              width: 130,
              height: 60,
              background: "rgba(52,211,153,0.18)",
              border: "1px solid rgba(52,211,153,0.5)",
              borderRadius: 10,
            }}
          />
        </div>
      </div>
      <PainVignette />
      <PainCaption
        text="this is the actual job."
        localF={bi.localF}
        durF={bi.durF}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

// 2 — contract (manual review) → foreshadows the contract analyzer
const PainContract: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const hl = ipl(bi.localF, 8, bi.durF * 0.6, 0, 1);
  const pageNo = 12 + Math.floor(ipl(bi.localF, 0, bi.durF, 0, 19));
  return (
    <AbsoluteFill style={{ background: PAINBG }}>
      <div
        style={{
          position: "absolute",
          inset: "120px 120px 260px",
          background: PAPER,
          borderRadius: 8,
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
          padding: 56,
          filter: "saturate(0.6)",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 34,
            color: "#222",
          }}
        >
          PURCHASE AGREEMENT
        </div>
        {Array.from({ length: 12 }).map((_, k) => (
          <div
            key={k}
            style={{
              position: "relative",
              height: 12,
              marginTop: 22,
              width: `${92 - (k % 4) * 8}%`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#cdc6b6",
                borderRadius: 2,
              }}
            />
            {k === 5 && (
              <div
                style={{
                  position: "absolute",
                  top: -6,
                  left: 0,
                  height: 24,
                  width: `${hl * 80}%`,
                  background: "rgba(240,210,60,0.6)",
                  borderRadius: 3,
                }}
              />
            )}
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 220,
            fontFamily: "'Comic Sans MS',cursive",
            fontSize: 40,
            fontWeight: 800,
            color: "#b23",
            transform: "rotate(-8deg)",
            opacity: ipl(bi.localF, bi.durF * 0.5, bi.durF * 0.65, 0, 1),
          }}
        >
          ?
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 30,
            right: 40,
            fontFamily: SANS,
            fontSize: 22,
            color: "#888",
          }}
        >
          p. {pageNo} / 40
        </div>
      </div>
      <PainVignette />
      <PainCaption
        text="40 pages. by hand."
        localF={bi.localF}
        durF={bi.durF}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

// 3 — county sites (manual lookup) → foreshadows property records
const PainCounty: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const err = bi.localF > bi.durF * 0.5;
  return (
    <AbsoluteFill style={{ background: PAINBG }}>
      <div style={{ position: "absolute", inset: "150px 110px 260px" }}>
        {[2, 1, 0].map((z) => (
          <div
            key={z}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${z * 26}px, ${z * 26}px)`,
              background: "#e8eef2",
              borderRadius: 10,
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              overflow: "hidden",
              filter: "saturate(0.7)",
            }}
          >
            <div
              style={{
                height: 56,
                background: "#2b4a6b",
                display: "flex",
                alignItems: "center",
                paddingLeft: 20,
                fontFamily: "Georgia,serif",
                fontSize: 22,
                color: "#fff",
              }}
            >
              County Assessor — Records Search
            </div>
            {z === 0 && (
              <div style={{ padding: 30 }}>
                <div
                  style={{
                    height: 48,
                    width: "70%",
                    background: "#fff",
                    border: "2px solid #99a",
                    borderRadius: 4,
                    marginBottom: 16,
                  }}
                />
                <div
                  style={{
                    height: 44,
                    width: 160,
                    background: "#9aa",
                    borderRadius: 4,
                  }}
                />
                {err && (
                  <div
                    style={{
                      marginTop: 26,
                      padding: "16px 20px",
                      background: "#fde2e2",
                      border: "2px solid #c33",
                      borderRadius: 6,
                      fontFamily: SANS,
                      fontSize: 26,
                      color: "#a11",
                      fontWeight: 700,
                    }}
                  >
                    ⚠ No records found.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <PainVignette />
      <PainCaption
        text="3 sites. one address."
        localF={bi.localF}
        durF={bi.durF}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

// 4 — inbox retyping (manual data entry) → foreshadows email-to-contacts
const PainInbox: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const unread = 47 + Math.floor(ipl(bi.localF, 0, bi.durF, 0, 12));
  const typed = "Sarah Diaz".slice(
    0,
    Math.floor(ipl(bi.localF, bi.durF * 0.3, bi.durF * 0.8, 0, 10)),
  );
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: PAINBG }}>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 110,
          right: 110,
          height: 520,
          background: "#11141b",
          borderRadius: 10,
          border: "1px solid #222",
          overflow: "hidden",
          filter: "saturate(0.7)",
        }}
      >
        <div
          style={{
            height: 56,
            background: "#181c24",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 22px",
            fontFamily: SANS,
            fontSize: 24,
            color: "#cdd",
          }}
        >
          <span>📥 Inbox</span>
          <span style={{ color: "#f87171", fontWeight: 800 }}>
            {unread} unread
          </span>
        </div>
        {Array.from({ length: 5 }).map((_, k) => (
          <div
            key={k}
            style={{
              display: "flex",
              gap: 14,
              padding: "18px 22px",
              borderBottom: "1px solid #1c1f27",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: k < 2 ? "#60a5fa" : "#333",
              }}
            />
            <div
              style={{
                flex: 1,
                height: 12,
                background: "#262b34",
                borderRadius: 2,
              }}
            />
          </div>
        ))}
      </div>
      {/* separate contact form being typed into */}
      <div
        style={{
          position: "absolute",
          top: 720,
          left: 110,
          right: 110,
          height: 220,
          background: "#0e1117",
          borderRadius: 10,
          border: "1px solid #2a2f3a",
          padding: 28,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 22,
            color: "#889",
            marginBottom: 14,
          }}
        >
          New contact (other app)
        </div>
        <div
          style={{
            height: 60,
            background: "#070a11",
            border: "2px solid #3a4150",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            fontFamily: SANS,
            fontSize: 30,
            color: "#fff",
          }}
        >
          {typed}
          {caret ? "▋" : ""}
        </div>
      </div>
      <PainVignette />
      <PainCaption
        text="copy. paste. repeat."
        localF={bi.localF}
        durF={bi.durF}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

// 5 — the sticky-note follow-up that slips → foreshadows the restoration lead flow
const PainSticky: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const fall = ipl(
    bi.localF,
    bi.durF * 0.4,
    bi.durF * 0.85,
    0,
    1,
    Easing.in(Easing.quad),
  );
  const glow = 0.4 + 0.4 * Math.abs(Math.sin(bi.localF / 7));
  return (
    <AbsoluteFill style={{ background: PAINBG }}>
      {/* phone with glowing lead text */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          height: 680,
          background: "#0a0a0c",
          borderRadius: 44,
          border: "8px solid #222",
          boxShadow: `0 0 ${50 * glow}px rgba(52,211,153,${0.3 * glow})`,
        }}
      >
        <div
          style={{
            margin: "120px 30px 0",
            background: "rgba(52,211,153,0.14)",
            border: "1px solid rgba(52,211,153,0.5)",
            borderRadius: 16,
            padding: 22,
            fontFamily: SANS,
            fontSize: 26,
            color: "#dffaef",
          }}
        >
          hey my basement flooded, can someone come out?? 312-555-1234
        </div>
      </div>
      {/* sticky note falling off */}
      <div
        style={{
          position: "absolute",
          top: 620 + fall * 760,
          left: 720 + fall * 60,
          width: 190,
          height: 190,
          background: "#d9c84a",
          transform: `rotate(${8 + fall * 40}deg)`,
          boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
          fontFamily: "'Comic Sans MS',cursive",
          fontSize: 32,
          fontWeight: 700,
          color: "#4a4208",
          padding: 20,
          opacity: 1 - fall * 0.3,
        }}
      >
        CALL BACK
      </div>
      <PainVignette />
      <PainCaption
        text="the lead that slipped."
        localF={bi.localF}
        durF={bi.durF}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

// 6 — peak → silence
const PainPeak: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const pull = ipl(bi.localF, bi.durF * 0.3, bi.durF, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background: "#040406",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: ipl(pull, 0, 1, 200, 760),
          height: 3,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)",
          opacity: ipl(bi.localF, 0, 8, 0, 1),
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 250,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 50,
          color: "#fff",
          opacity: ipl(bi.localF, bi.durF * 0.4, bi.durF * 0.7, 0, 1),
        }}
      >
        You don't need more hours.
      </div>
    </AbsoluteFill>
  );
};

// 7 — turn into the product
const TurnToProof: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const snap = ipl(bi.localF, 4, 16, 0, 1, ease);
  const icons = ["📄", "🏠", "✉", "📥"];
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0c1020 0%, #05060a 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.2 * snap} frame={frame} />
      <div
        style={{
          width: 760,
          height: 460,
          background: LAW.bg2,
          borderRadius: 22,
          border: `1.5px solid ${LAW.indigo}66`,
          boxShadow: `0 0 70px ${LAW.indigo}44`,
          opacity: snap,
          transform: `scale(${0.82 + snap * 0.18})`,
          padding: 30,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((k) => (
            <div
              key={k}
              style={{
                flex: 1,
                height: 70,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${LAW.indigo}33`,
                borderRadius: 12,
              }}
            />
          ))}
        </div>
        <div
          style={{
            height: 180,
            background: `linear-gradient(180deg, ${LAW.indigo}22, transparent)`,
            borderRadius: 12,
          }}
        />
      </div>
      {/* the 4 pain props become 4 icons sliding toward the app */}
      {icons.map((ic, i) => {
        const p = ipl(
          bi.localF,
          bi.durF * 0.55 + i * 2,
          bi.durF * 0.55 + i * 2 + 10,
          0,
          1,
          ease,
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ipl(p, 0, 1, 150 + i * 220, 520),
              top: ipl(p, 0, 1, 1300, 760),
              fontSize: 50,
              opacity: (1 - p) * snap,
            }}
          >
            {ic}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          bottom: 250,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 50,
          color: "#fff",
          opacity: snap,
          textShadow: `0 0 26px ${LAW.indigo}`,
        }}
      >
        You need the right tools.{" "}
        <span style={{ color: LAW.indigoHi }}>So I built them.</span>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  PRACTICE OS app (accurate recreation): cursor + elements share one rect
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
        ◆
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
        Practice OS
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
// ════════════════════════════════════════════════════════════════════════════
//  MORPH (v7) — the SAME app re-skins indigo→copper & relabels in place.
//  Replaces the old hard split-wipe PIVOT. Reuses the Practice-OS chrome geometry.
// ════════════════════════════════════════════════════════════════════════════
const lerpHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
const REST_NAV = [
  { label: "Leads", icon: "📥" },
  { label: "Pipeline", icon: "▦" },
  { label: "Contacts", icon: "👥" },
  { label: "Dashboard", icon: "📊" },
];

const Morph: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const m = ipl(bi.localF, 0, bi.durF * 0.85, 0, 1, easeInOut);
  const c = lerpHex("#6366F1", "#F0742A", m);
  const lawOut = ipl(m, 0.15, 0.5, 1, 0);
  const restIn = ipl(m, 0.3, 0.7, 0, 1);
  return (
    <AbsoluteFill style={{ background: lerpHex("#0a0e17", "#0b0805", m) }}>
      <DotGrid color={c} opacity={0.18} frame={frame} />
      {/* sidebar — stays mounted, recolors + relabels in place */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDE_W,
          background: lerpHex("#070a11", "#0e0805", m),
          borderRight: `1px solid ${c}33`,
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
              background: c,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 22,
              boxShadow: `0 0 18px ${c}88`,
            }}
          >
            ◆
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 26,
              color: "#fff",
            }}
          >
            Practice OS
          </div>
        </div>
        {/* rows 0-3: crossfade law→restoration label in place */}
        {NAV.slice(0, 4).map((n, i) => {
          const y = navRowY(i);
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
                background: i === 0 ? `${c}26` : "transparent",
                fontFamily: SANS,
                fontSize: 22,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  opacity: lawOut,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {n.icon} {n.label}
              </span>
              <span
                style={{
                  position: "absolute",
                  opacity: restIn,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {REST_NAV[i].icon} {REST_NAV[i].label}
              </span>
            </div>
          );
        })}
        {/* rows 4-11 collapse away */}
        {NAV.slice(4).map((n, i) => {
          const idx = i + 4;
          const h = ipl(m, 0.2, 0.7, ROW_H - 8, 0);
          const op = ipl(m, 0.2, 0.6, 0.6, 0);
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: 12,
                top: navRowY(idx),
                width: SIDE_W - 24,
                height: h,
                opacity: op,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 16px",
                fontFamily: SANS,
                fontSize: 22,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {n.icon} {n.label}
            </div>
          );
        })}
      </div>
      {/* topbar */}
      <div
        style={{
          position: "absolute",
          left: SIDE_W,
          right: 0,
          top: 0,
          height: 110,
          borderBottom: `1px solid ${c}33`,
          display: "flex",
          alignItems: "center",
          padding: "0 44px",
        }}
      >
        <span
          style={{
            position: "absolute",
            opacity: lawOut,
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 800,
            color: "#e6eaf2",
          }}
        >
          Email → Contacts
        </span>
        <span
          style={{
            position: "absolute",
            opacity: restIn,
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 800,
            color: "#FFF3EA",
          }}
        >
          Leads
        </span>
      </div>
      {/* content: law pane slides up/out; restoration canvas pushes in behind */}
      <div
        style={{
          position: "absolute",
          left: SIDE_W + 44,
          top: 150,
          right: 44,
          bottom: 40,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg,#150d06,#0b0805)",
            borderRadius: 16,
            opacity: restIn,
            transform: `scale(${ipl(m, 0.3, 1, 0.94, 1)})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${ipl(m, 0.1, 0.6, 0, -700)}px)`,
            opacity: lawOut,
          }}
        >
          {[0, 1, 2, 3].map((k) => (
            <div
              key={k}
              style={{
                height: 70,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                marginBottom: 14,
              }}
            />
          ))}
        </div>
      </div>
      {/* continuity anchor (matches the global wordmark position) + thesis line */}
      <div
        style={{
          position: "absolute",
          bottom: 250,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 46,
          color: "#fff",
          opacity: ipl(m, 0.4, 0.7, 0, 1),
          textShadow: `0 0 24px ${c}`,
        }}
      >
        Same software. Different business.
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  RESTORATION (v7) — LEAD-FIRST. text → number → one clean lead → that lead
//  connected across pipeline + contacts + dashboard → money as the payoff.
//  A persistent copper "thread" follows the lead so you SEE it's one record.
// ════════════════════════════════════════════════════════════════════════════
const RPhone: React.FC<{ frame: number; children: React.ReactNode }> = ({
  frame,
  children,
}) => (
  <AbsoluteFill
    style={{
      background: "#0A0E14",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <DotGrid color={FIRE.copper} opacity={0.18} frame={frame} />
    <Bloom color="rgba(240,116,42,0.28)" />
    <div
      style={{
        width: 820,
        height: 1560,
        borderRadius: 74,
        background: "#0E1621",
        border: "12px solid #1b2a3a",
        boxShadow: "0 40px 130px rgba(0,0,0,0.8)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          height: 128,
          background: "#17212B",
          display: "flex",
          alignItems: "center",
          padding: "0 38px",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: FIRE.copper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
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
          <div style={{ fontFamily: SANS, color: FIRE.emerald, fontSize: 22 }}>
            ● live
          </div>
        </div>
      </div>
      <div style={{ padding: 36, position: "relative" }}>{children}</div>
    </div>
  </AbsoluteFill>
);
const MSG =
  "hey its john my basement flooded last nite 312-555-1234 can someone come thurs??";

// 1 — text arrives
const RestoText: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const typeP = ipl(bi.localF, 8, bi.durF * 0.78, 0, 1);
  return (
    <RPhone frame={frame}>
      <div
        style={{
          maxWidth: "90%",
          background: "#2B5278",
          color: "#fff",
          borderRadius: "26px 26px 26px 6px",
          padding: "26px 30px",
          fontFamily: SANS,
          fontSize: 34,
          lineHeight: 1.4,
        }}
      >
        {MSG.slice(0, Math.floor(MSG.length * typeP))}
        {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
      </div>
    </RPhone>
  );
};

// 2 — the number is the thread (highlight + lift as a copper chip)
const RestoNumber: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const scanY = ipl(bi.localF, 4, bi.durF * 0.6, 150, 320);
  const lift = ipl(bi.localF, bi.durF * 0.45, bi.durF * 0.85, 0, 1, ease);
  return (
    <RPhone frame={frame}>
      <div
        style={{
          maxWidth: "90%",
          background: "#2B5278",
          color: "#fff",
          borderRadius: "26px 26px 26px 6px",
          padding: "26px 30px",
          fontFamily: SANS,
          fontSize: 34,
          lineHeight: 1.4,
          position: "relative",
        }}
      >
        hey its john my basement flooded last nite{" "}
        <span
          style={{
            background: `rgba(240,116,42,${0.4 * (1 - lift)})`,
            borderRadius: 6,
            padding: "0 4px",
            opacity: 1 - lift,
          }}
        >
          312-555-1234
        </span>{" "}
        can someone come thurs??
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: scanY,
            height: 4,
            background: `linear-gradient(90deg,transparent,${FIRE.copperHi},transparent)`,
            boxShadow: `0 0 22px ${FIRE.copper}`,
            opacity: bi.localF < bi.durF * 0.6 ? 1 : 0,
          }}
        />
      </div>
      {/* the lifted number chip floating toward the (future) lead card */}
      <div
        style={{
          position: "absolute",
          left: 60 + lift * 200,
          top: 360 - lift * 60,
          fontFamily: MONO,
          fontSize: 40,
          fontWeight: 800,
          color: "#fff",
          background: FIRE.copper,
          borderRadius: 12,
          padding: "10px 20px",
          opacity: lift,
          boxShadow: `0 0 26px ${FIRE.copper}`,
          transform: `scale(${0.8 + lift * 0.2})`,
        }}
      >
        📞 312-555-1234
      </div>
    </RPhone>
  );
};

// 3 — one clean lead (thread node born)
const RestoLead: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const a = ipl(bi.localF, 4, 18, 0, 1, ease);
  const fields = [
    ["Name", "John S."],
    ["Phone", "312-555-1234"],
    ["Job", "💧 Water — flooded basement"],
    ["When", "Thursday"],
  ];
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(bi.localF / 6));
  return (
    <RPhone frame={frame}>
      <div
        style={{
          maxWidth: "90%",
          background: "#1f2c39",
          borderRadius: "26px 26px 26px 6px",
          padding: "20px 26px",
          fontFamily: SANS,
          fontSize: 26,
          color: FIRE.copperHi,
          marginBottom: 26,
        }}
      >
        read it… handled
      </div>
      <div
        style={{
          background: "#101722",
          border: `2px solid ${FIRE.copper}`,
          borderRadius: 24,
          padding: 34,
          opacity: a,
          transform: `scale(${0.92 + a * 0.08})`,
          boxShadow: `0 0 ${40 * pulse}px ${FIRE.copper}66`,
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 24,
            fontWeight: 800,
            color: FIRE.emerald,
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          ✓ NEW LEAD
        </div>
        {fields.map((f, i) => {
          const fa = ipl(bi.localF, 8 + i * 5, 8 + i * 5 + 8, 0, 1, ease);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 14,
                opacity: fa,
              }}
            >
              <div
                style={{
                  width: 110,
                  fontFamily: SANS,
                  fontSize: 24,
                  color: FIRE.soft,
                }}
              >
                {f[0]}
              </div>
              <div
                style={{
                  fontFamily: i === 1 ? MONO : SANS,
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {f[1]}
              </div>
            </div>
          );
        })}
        {/* the thread node is born */}
        <div
          style={{
            position: "absolute",
            right: -10,
            top: "50%",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: FIRE.copper,
            boxShadow: `0 0 ${20 * pulse}px ${FIRE.copper}`,
            opacity: a,
          }}
        />
      </div>
    </RPhone>
  );
};

// 4 — HERO: one lead connected across pipeline + contacts + dashboard
const RestoPipe: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const cols = ["New call", "Followed up", "Sent a price", "Got the job"];
  const colW = 232,
    gap = 18,
    x0 = 70,
    topY = 250;
  const travel = ipl(bi.localF, 0.18 * bi.durF, 0.8 * bi.durF, 0, 3, easeInOut);
  const stage = Math.min(3, Math.round(travel));
  const cardX = x0 + travel * (colW + gap);
  const cardY = topY + 70;
  const won = ipl(bi.localF, 0.78 * bi.durF, 0.9 * bi.durF, 0, 1, ease);
  const threadC = won > 0.3 ? FIRE.emerald : FIRE.copper;
  const enter = ipl(bi.localF, 0, 12, 0, 1, ease);
  // connection endpoints
  const contactsPt = { x: 960, y: 470 };
  const dashPt = { x: 540, y: 1160 };
  const cardPt = { x: cardX + (colW - 28) / 2, y: cardY + 60 };
  return (
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg,#150d06,#0b0805)" }}
    >
      <DotGrid color={FIRE.copper} opacity={0.22} frame={frame} />
      {/* board */}
      <div
        style={{
          position: "absolute",
          top: topY,
          left: x0,
          display: "flex",
          gap,
          opacity: enter,
        }}
      >
        {cols.map((c, i) => (
          <div
            key={i}
            style={{
              width: colW,
              minHeight: 420,
              background:
                i === stage ? `${FIRE.copper}1f` : "rgba(255,255,255,0.03)",
              border: `1px solid ${i === stage ? FIRE.copper : FIRE.border}`,
              borderRadius: 16,
              padding: 14,
              boxShadow: i === stage ? `0 0 26px ${FIRE.copper}44` : "none",
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontSize: 22,
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
      {/* contacts chip (right) */}
      <div
        style={{
          position: "absolute",
          left: contactsPt.x - 6,
          top: contactsPt.y - 50,
          width: 110,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${won > 0.3 ? FIRE.emerald : FIRE.copper}`,
          borderRadius: 14,
          padding: 14,
          textAlign: "center",
          opacity: enter,
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 16, color: FIRE.soft }}>
          Contacts
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `${FIRE.copper}33`,
            color: FIRE.copperHi,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "8px auto",
            fontFamily: SANS,
            fontWeight: 800,
          }}
        >
          J
        </div>
        <div style={{ fontFamily: SANS, fontSize: 16, color: "#fff" }}>
          John S. {won > 0.3 ? "✓" : ""}
        </div>
      </div>
      {/* dashboard counter (bottom) */}
      <div
        style={{
          position: "absolute",
          left: dashPt.x - 150,
          top: dashPt.y - 30,
          width: 300,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${FIRE.border}`,
          borderRadius: 14,
          padding: "14px 20px",
          textAlign: "center",
          opacity: enter,
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 16, color: FIRE.soft }}>
          Dashboard · jobs
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 800,
            color: won > 0.3 ? FIRE.emerald : "#fff",
          }}
        >
          {38 + (won > 0.3 ? 1 : 0)}
        </div>
      </div>
      {/* the persistent copper THREAD: card → contacts, card → dashboard */}
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <path
          d={`M ${cardPt.x} ${cardPt.y} Q ${(cardPt.x + contactsPt.x) / 2} ${cardPt.y - 80} ${contactsPt.x} ${contactsPt.y}`}
          fill="none"
          stroke={threadC}
          strokeWidth="3"
          opacity={enter * 0.8}
          style={{ filter: `drop-shadow(0 0 6px ${threadC})` }}
        />
        <path
          d={`M ${cardPt.x} ${cardPt.y} Q ${cardPt.x} ${(cardPt.y + dashPt.y) / 2} ${dashPt.x} ${dashPt.y}`}
          fill="none"
          stroke={threadC}
          strokeWidth="3"
          opacity={enter * 0.8}
          style={{ filter: `drop-shadow(0 0 6px ${threadC})` }}
        />
      </svg>
      {/* John's travelling lead card */}
      <div
        style={{
          position: "absolute",
          left: cardX,
          top: cardY,
          width: colW - 28,
          background: "#1c130c",
          border: `2px solid ${threadC}`,
          borderRadius: 14,
          padding: 16,
          boxShadow: `0 0 26px ${threadC}77`,
          opacity: enter,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 26,
            color: "#fff",
          }}
        >
          John S.
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 16,
            color: FIRE.soft,
            marginTop: 4,
          }}
        >
          312-555-1234
        </div>
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              background: `${FIRE.info}33`,
              color: FIRE.info,
              borderRadius: 8,
              padding: "4px 10px",
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            💧 Water
          </span>
        </div>
        {won > 0 && (
          <div
            style={{
              marginTop: 10,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 30,
              color: FIRE.emerald,
              opacity: won,
            }}
          >
            $14,200
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// 5 — PAYOFF: the money is the sum of leads like John
const RestoMoney: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const num = (function () {
    const p = ipl(bi.localF, 6, bi.durF * 0.7, 0, 1, ease);
    return Math.round(612480 * p);
  })();
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
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg,#150d06,#0b0805)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={FIRE.copper} opacity={0.26} frame={frame} />
      <Bloom color="rgba(240,116,42,0.4)" />
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 700,
            color: FIRE.soft,
          }}
        >
          Jobs sold this year
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 190,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: FIRE.copperHi,
            textShadow: `0 0 ${70 * glow}px ${FIRE.copper}`,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {"$" + num.toLocaleString("en-US")}
        </div>
        <div
          style={{
            display: "flex",
            gap: 22,
            marginTop: 44,
            justifyContent: "center",
          }}
        >
          {[
            ["Jobs won", "38"],
            ["Avg job", "$16,100"],
            ["New customers", "52"],
          ].map((k, i) => (
            <div
              key={i}
              style={{
                background: FIRE.card,
                border: `1px solid ${FIRE.border}`,
                borderRadius: 18,
                padding: "20px 28px",
                opacity: kpiA(i),
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: FIRE.soft,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {k[0]}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 46,
                  fontWeight: 800,
                  color: FIRE.text,
                }}
              >
                {k[1]}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: SANS,
            fontSize: 28,
            fontWeight: 600,
            color: FIRE.copperHi,
            opacity: ipl(bi.localF, bi.durF * 0.7, bi.durF * 0.85, 0, 1),
          }}
        >
          every dollar started as one text.
        </div>
      </div>
    </AbsoluteFill>
  );
};

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
  const fireKeys = [
    "MORPH",
    "RESTO_TEXT",
    "RESTO_NUMBER",
    "RESTO_LEAD",
    "RESTO_PIPE",
    "RESTO_MONEY",
  ];
  const accent =
    activeKey && fireKeys.includes(activeKey) ? FIRE.copper : LAW.indigo;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {b.PAIN_OPEN_DESK.visible && (
        <Trans bi={b.PAIN_OPEN_DESK}>
          <PainOpenDesk frame={frame} fps={fps} bi={b.PAIN_OPEN_DESK} />
        </Trans>
      )}
      {b.PAIN_CONTRACT.visible && (
        <Trans bi={b.PAIN_CONTRACT}>
          <PainContract frame={frame} fps={fps} bi={b.PAIN_CONTRACT} />
        </Trans>
      )}
      {b.PAIN_COUNTY.visible && (
        <Trans bi={b.PAIN_COUNTY}>
          <PainCounty frame={frame} fps={fps} bi={b.PAIN_COUNTY} />
        </Trans>
      )}
      {b.PAIN_INBOX.visible && (
        <Trans bi={b.PAIN_INBOX}>
          <PainInbox frame={frame} fps={fps} bi={b.PAIN_INBOX} />
        </Trans>
      )}
      {b.PAIN_STICKY.visible && (
        <Trans bi={b.PAIN_STICKY}>
          <PainSticky frame={frame} fps={fps} bi={b.PAIN_STICKY} />
        </Trans>
      )}
      {b.PAIN_PEAK.visible && (
        <Trans bi={b.PAIN_PEAK}>
          <PainPeak frame={frame} fps={fps} bi={b.PAIN_PEAK} />
        </Trans>
      )}
      {b.TURN_TO_PROOF.visible && (
        <Trans bi={b.TURN_TO_PROOF}>
          <TurnToProof frame={frame} fps={fps} bi={b.TURN_TO_PROOF} />
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
      {b.MORPH.visible && (
        <Trans bi={b.MORPH}>
          <Morph frame={frame} fps={fps} bi={b.MORPH} />
        </Trans>
      )}
      {b.RESTO_TEXT.visible && (
        <Trans bi={b.RESTO_TEXT}>
          <RestoText frame={frame} fps={fps} bi={b.RESTO_TEXT} />
        </Trans>
      )}
      {b.RESTO_NUMBER.visible && (
        <Trans bi={b.RESTO_NUMBER}>
          <RestoNumber frame={frame} fps={fps} bi={b.RESTO_NUMBER} />
        </Trans>
      )}
      {b.RESTO_LEAD.visible && (
        <Trans bi={b.RESTO_LEAD}>
          <RestoLead frame={frame} fps={fps} bi={b.RESTO_LEAD} />
        </Trans>
      )}
      {b.RESTO_PIPE.visible && (
        <Trans bi={b.RESTO_PIPE}>
          <RestoPipe frame={frame} fps={fps} bi={b.RESTO_PIPE} />
        </Trans>
      )}
      {b.RESTO_MONEY.visible && (
        <Trans bi={b.RESTO_MONEY}>
          <RestoMoney frame={frame} fps={fps} bi={b.RESTO_MONEY} />
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
