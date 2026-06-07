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
//  SIMPLY SCALED — 60s vertical sales reel  v2
//  "What are the 5 things you waste the most time on?" → the full products I built:
//    • Stolen Mule (law firm — The REAL Law Group): full app, 30+ tools + AI
//    • Restoration One (restoration crew): dashboard + pipeline + CRM + AI intake
//  Named real businesses, full-screen Telegram demo, Jarvis proof slider,
//  tight ~9s contact close. Timing is data-driven (beats prop ← real VO).
// ════════════════════════════════════════════════════════════════════════════

export type ReelBeat = { key: string; start: number; dur: number };

export type SimplyScaledReelProps = {
  beats?: ReelBeat[];
  brand?: string;
  phone?: string;
  email?: string;
  offer?: string;
  logoUrl?: string;
  founderPhotoUrl?: string;
  lite?: boolean;
};

const DEFAULT_DURS: { key: string; dur: number }[] = [
  { key: "HOOK", dur: 4.6 },
  { key: "BRIDGE", dur: 2.4 },
  { key: "SM_TOOLS", dur: 6.0 },
  { key: "SM_MONEY", dur: 5.2 },
  { key: "PIVOT", dur: 3.0 },
  { key: "RO_HEAD", dur: 5.2 },
  { key: "RO_CRM", dur: 6.0 },
  { key: "TG_DEMO", dur: 6.8 },
  { key: "PROOF", dur: 5.6 },
  { key: "TURN", dur: 2.4 },
  { key: "CLOSE", dur: 4.0 },
  { key: "CTA", dur: 8.8 },
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
  HOOK: "WHAT EATS YOUR TIME EVERY DAY?",
  BRIDGE: "NOW IMAGINE IT ALL — HANDLED.",
  SM_TOOLS: "STOLEN MULE · 30+ TOOLS + AI",
  SM_MONEY: "EVERY DOLLAR. WATCH IT GROW.",
  PIVOT: "NOW — A COMPLETELY DIFFERENT BUSINESS.",
  RO_HEAD: "RESTORATION ONE · UPDATING LIVE",
  RO_CRM: "PIPELINE · CRM · REAL CONTACTS",
  TG_DEMO: "MESSY TEXT → CLEAN LEAD. NOTHING MISSED.",
  PROOF: "REAL BUSINESSES. ONE DEVELOPER.",
  TURN: "IMAGINE YOURS.",
  CLOSE: "FREE 15-MIN TEARDOWN — NO PITCH.",
  CTA: "CALL / TEXT (847) 212-2142",
};

const SM = {
  canvas: "#0A0E17",
  sidebar: "#0C1019",
  indigo: "#6366F1",
  indigoLite: "#818CF8",
  sky: "#52A9FF",
  amber: "#FBBF24",
  danger: "#F43F5E",
  emerald: "#34D399",
  text: "#E6EAF2",
  textSoft: "rgba(230,234,242,0.55)",
  tile: "rgba(255,255,255,0.035)",
  tileBorder: "rgba(255,255,255,0.08)",
};
const RO = {
  canvas: "#0B0E11",
  card: "#14181D",
  sidebar: "#0E1216",
  copper: "#F0742A",
  copperHi: "#FF8A45",
  teal: "#1FB6A6",
  emerald: "#34D399",
  rose: "#F43F5E",
  amber: "#F5B945",
  info: "#60A5FA",
  text: "#F4F6F8",
  textSoft: "#9BA6B2",
  border: "rgba(255,255,255,0.08)",
};

const SANS =
  "'SF Pro Display','SF Pro Text','Helvetica Neue','Inter','Arial',sans-serif";
const MONO = "'SF Mono','Roboto Mono','Menlo',monospace";
const W = 1080;
const H = 1920;

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
    const localF = frame - sF;
    map[b.key] = {
      active: frame >= sF && frame < eF,
      visible: frame >= sF - 6 && frame < eF + 2,
      sF,
      eF,
      durF,
      localF,
      p: Math.max(0, Math.min(1, localF / durF)),
    };
  }
  return map;
}

const ease = Easing.bezier(0.16, 1, 0.3, 1);

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function countUp(
  frame: number,
  startF: number,
  durF: number,
  to: number,
  from = 0,
): number {
  const p = interpolate(frame, [startF, startF + durF], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return from + (to - from) * p;
}

const clampI = (
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

// ─── atmosphere ─────────────────────────────────────────────────────────────
const DotGrid: React.FC<{ color: string; opacity?: number; frame: number }> = ({
  color,
  opacity = 1,
  frame,
}) => {
  const drift = (frame * 0.15) % 38;
  return (
    <div
      style={{
        position: "absolute",
        inset: -40,
        opacity,
        backgroundImage: `radial-gradient(${color} 1.4px, transparent 1.4px)`,
        backgroundSize: "38px 38px",
        backgroundPosition: `${drift}px ${drift * 0.6}px`,
        maskImage:
          "radial-gradient(ellipse 80% 70% at 50% 45%, black 40%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 70% at 50% 45%, black 40%, transparent 100%)",
      }}
    />
  );
};

const HorizonBloom: React.FC<{ color: string; intensity?: number }> = ({
  color,
  intensity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(120% 60% at 50% 108%, ${color} 0%, transparent 60%)`,
      opacity: 0.5 * intensity,
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
      opacity: 0.06,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      zIndex: 9000,
    }}
  >
    <filter id="grain">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.9"
        numOctaves="2"
        stitchTiles="stitch"
      />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      boxShadow: "inset 0 0 320px 70px rgba(0,0,0,0.6)",
      pointerEvents: "none",
      zIndex: 8000,
    }}
  />
);

const Scanlines: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 2px, transparent 4px)",
      opacity,
      pointerEvents: "none",
      mixBlendMode: "overlay",
    }}
  />
);

// ─── caption ────────────────────────────────────────────────────────────────
const Caption: React.FC<{
  text: string;
  localF: number;
  durF: number;
  fps: number;
  accent?: string;
  big?: boolean;
}> = ({ text, localF, durF, fps, accent = "#FFFFFF", big = false }) => {
  if (localF < 0) return null;
  const inP = clampI(localF, 0, Math.round(fps * 0.22), 0, 1, ease);
  const outP = clampI(localF, durF - Math.round(fps * 0.25), durF, 1, 0);
  const op = Math.min(inP, outP);
  const y = (1 - inP) * 34;
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 250,
        textAlign: "center",
        opacity: op,
        transform: `translateY(${y}px)`,
        zIndex: 7000,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: big ? 72 : 56,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          textShadow: `0 4px 30px rgba(0,0,0,0.9), 0 0 22px ${accent}66`,
          display: "inline-block",
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ─── dashboard primitives ───────────────────────────────────────────────────
const KpiTile: React.FC<{
  label: string;
  value: string;
  accent?: string;
  hero?: boolean;
  delta?: string;
  appear: number;
  compact?: boolean;
}> = ({ label, value, accent = SM.text, hero, delta, appear, compact }) => (
  <div
    style={{
      background: hero
        ? "linear-gradient(160deg, rgba(99,102,241,0.18), rgba(99,102,241,0.04))"
        : SM.tile,
      border: `1px solid ${hero ? "rgba(99,102,241,0.5)" : SM.tileBorder}`,
      borderRadius: 22,
      padding: compact ? "16px 18px" : "24px 26px",
      opacity: appear,
      transform: `translateY(${(1 - appear) * 36}px)`,
      boxShadow: hero
        ? `0 0 50px ${SM.indigo}50`
        : "0 8px 24px rgba(0,0,0,0.4)",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        fontFamily: SANS,
        fontSize: compact ? 16 : 20,
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: SM.textSoft,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: SANS,
        fontSize: hero ? 64 : compact ? 40 : 54,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: accent,
        marginTop: 6,
        textShadow: hero ? `0 0 30px ${SM.indigo}aa` : "none",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    {delta && (
      <div
        style={{
          display: "inline-block",
          marginTop: 10,
          fontFamily: SANS,
          fontSize: 22,
          fontWeight: 700,
          color: "#04150E",
          background: SM.emerald,
          borderRadius: 999,
          padding: "3px 12px",
        }}
      >
        ▲ {delta}
      </div>
    )}
  </div>
);

const RevenueChart: React.FC<{
  draw: number;
  scrub: number;
  area: string;
  glow: string;
  width: number;
  height: number;
  data?: number[];
}> = ({
  draw,
  scrub,
  area,
  glow,
  width,
  height,
  data = [22, 28, 26, 34, 40, 38, 47, 52, 58, 64, 71, 84, 92],
}) => {
  const n = data.length;
  const max = Math.max(...data) * 1.12;
  const padB = 22;
  const xs = (i: number) => (i / (n - 1)) * width;
  const ys = (v: number) => height - padB - (v / max) * (height - padB - 14);
  const pts = data.map((v, i) => [xs(i), ys(v)] as const);
  const linePath = pts
    .map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1])
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height - padB} L 0 ${height - padB} Z`;
  const billed = data.map((v) => v * 1.16);
  const billedPath = billed
    .map((v, i) => (i ? "L" : "M") + xs(i) + " " + ys(v))
    .join(" ");
  const brushX = scrub * width;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={area} stopOpacity="0.55" />
          <stop offset="100%" stopColor={area} stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id="bg2" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.35" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <clipPath id="dc">
          <rect x="0" y="0" width={width * draw} height={height} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="url(#bg2)" />
      <g clipPath="url(#dc)">
        <path d={areaPath} fill="url(#ag)" />
        <path
          d={linePath}
          fill="none"
          stroke={area}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 12px ${glow})` }}
        />
        <path
          d={billedPath}
          fill="none"
          stroke={SM.amber}
          strokeWidth={4}
          strokeDasharray="10 9"
          strokeLinecap="round"
          opacity={0.85}
        />
      </g>
      {scrub > 0 && (
        <g>
          <rect
            x={brushX - 3}
            y={0}
            width={6}
            height={height - padB}
            fill={glow}
            opacity={0.8}
            style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
          />
          <circle
            cx={brushX}
            cy={height - padB}
            r={11}
            fill={glow}
            style={{ filter: `drop-shadow(0 0 14px ${glow})` }}
          />
        </g>
      )}
    </svg>
  );
};

const ARAging: React.FC<{ appear: number; label: string }> = ({
  appear,
  label,
}) => {
  const segs = [
    { w: 34, c: SM.sky },
    { w: 26, c: "#3E82C8" },
    { w: 22, c: SM.amber },
    { w: 18, c: SM.danger },
  ];
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: SM.danger,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          height: 38,
          borderRadius: 12,
          overflow: "hidden",
          gap: 3,
        }}
      >
        {segs.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${s.w * appear}%`,
              background: s.c,
              opacity: 0.9,
              boxShadow: i === 3 ? `0 0 18px ${SM.danger}` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const Funnel: React.FC<{ appear: number }> = ({ appear }) => {
  const steps = [
    { label: "Leads", w: 100, drop: "" },
    { label: "Responded", w: 74, drop: "−26%" },
    { label: "Estimate Sent", w: 48, drop: "−35%", leak: true },
    { label: "Won", w: 31, drop: "−35%" },
  ];
  return (
    <div style={{ width: "100%" }}>
      {steps.map((s, i) => {
        const a = clampI(appear, i * 0.14, i * 0.14 + 0.4, 0, 1, ease);
        return (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", marginBottom: 12 }}
          >
            <div
              style={{
                height: 48,
                width: `${s.w * a}%`,
                background: s.leak
                  ? `linear-gradient(90deg, ${RO.copper}, ${RO.amber})`
                  : `linear-gradient(90deg, ${RO.copper}, ${RO.copperHi})`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                paddingLeft: 18,
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 24,
                color: "#fff",
                boxShadow: s.leak ? `0 0 24px ${RO.amber}88` : "none",
              }}
            >
              {s.label}
            </div>
            {s.drop && (
              <div
                style={{
                  marginLeft: 14,
                  fontFamily: MONO,
                  fontSize: 22,
                  fontWeight: 700,
                  color: s.leak ? RO.amber : RO.textSoft,
                  opacity: a,
                }}
              >
                {s.drop}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── App shell sidebar ──────────────────────────────────────────────────────
type NavItem = { label: string; icon: string; ai?: boolean };

const Sidebar: React.FC<{
  brandName: string;
  brandSub?: string;
  accent: string;
  bg: string;
  items: NavItem[];
  activeIdx: number;
  glowIdx: number;
  extra?: string;
}> = ({
  brandName,
  brandSub,
  accent,
  bg,
  items,
  activeIdx,
  glowIdx,
  extra,
}) => (
  <div
    style={{
      width: 330,
      height: "100%",
      background: bg,
      borderRight: `1px solid ${accent}22`,
      padding: "30px 18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      flexShrink: 0,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
        padding: "0 8px",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 22,
          boxShadow: `0 0 20px ${accent}88`,
        }}
      >
        {brandName[0]}
      </div>
      <div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 24,
            color: "#fff",
            letterSpacing: "-0.01em",
          }}
        >
          {brandName}
        </div>
        {brandSub && (
          <div
            style={{
              fontFamily: SANS,
              fontSize: 14,
              color: accent,
              fontWeight: 600,
            }}
          >
            {brandSub}
          </div>
        )}
      </div>
    </div>
    {items.map((it, i) => {
      const active = i === activeIdx;
      const glow = i === glowIdx;
      return (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 12,
            background: active
              ? `${accent}26`
              : glow
                ? `${accent}18`
                : "transparent",
            boxShadow: glow
              ? `0 0 22px ${accent}66, inset 0 0 0 1px ${accent}55`
              : "none",
            fontFamily: SANS,
            fontSize: 20,
            fontWeight: active || glow ? 700 : 500,
            color: active || glow ? "#fff" : "rgba(255,255,255,0.62)",
          }}
        >
          <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>
            {it.icon}
          </span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.ai && (
            <span
              style={{
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 800,
                color: "#04150E",
                background: accent,
                borderRadius: 6,
                padding: "2px 7px",
                letterSpacing: "0.06em",
              }}
            >
              AI
            </span>
          )}
        </div>
      );
    })}
    {extra && (
      <div
        style={{
          marginTop: "auto",
          fontFamily: SANS,
          fontSize: 18,
          fontWeight: 600,
          color: accent,
          padding: "10px 14px",
        }}
      >
        {extra}
      </div>
    )}
  </div>
);

const SM_NAV: NavItem[] = [
  { label: "Dashboard", icon: "▦" },
  { label: "Matters", icon: "⚖" },
  { label: "Contacts", icon: "👥" },
  { label: "Invoices", icon: "🧾" },
  { label: "Trust / IOLTA", icon: "🏦" },
  { label: "Calendar", icon: "📅" },
  { label: "Time & Fees", icon: "⏱" },
  { label: "Tasks", icon: "✓" },
  { label: "Closings", icon: "🔑" },
  { label: "Intake", icon: "📥" },
  { label: "AI Email Scrape", icon: "✉", ai: true },
  { label: "AI PDF Scanner", icon: "📄", ai: true },
  { label: "AI Doc Drafter", icon: "✍", ai: true },
  { label: "AI Summarizer", icon: "✨", ai: true },
];

const RO_NAV: NavItem[] = [
  { label: "Dashboard", icon: "▦" },
  { label: "Pipeline", icon: "🗂" },
  { label: "Contacts", icon: "👥" },
  { label: "Jobs", icon: "🛠" },
  { label: "Calendar", icon: "📅" },
  { label: "Estimates", icon: "💲" },
  { label: "Reports", icon: "📊" },
  { label: "AI Lead Intake", icon: "🤖", ai: true },
  { label: "AI Follow-up", icon: "✨", ai: true },
];

// ─── Restoration contacts (CRM) ─────────────────────────────────────────────
const RO_CONTACTS = [
  { n: "John Smith", p: "(312) 555-1234", s: "Water", st: "New", c: RO.info },
  {
    n: "Maria Alvarez",
    p: "(773) 555-8890",
    s: "Fire",
    st: "Estimate",
    c: RO.copper,
  },
  { n: "David Chen", p: "(847) 555-2201", s: "Mold", st: "Won", c: RO.emerald },
  {
    n: "Sarah Johnson",
    p: "(630) 555-7745",
    s: "Water",
    st: "Follow-up",
    c: RO.amber,
  },
  { n: "Mike Rossi", p: "(312) 555-9012", s: "Remodel", st: "New", c: RO.info },
  { n: "Linda Park", p: "(708) 555-3367", s: "Fire", st: "Won", c: RO.emerald },
];

const ContactsList: React.FC<{ appear: number }> = ({ appear }) => (
  <div style={{ width: "100%" }}>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 26,
        fontWeight: 800,
        color: RO.text,
        marginBottom: 4,
      }}
    >
      Contacts
    </div>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 18,
        color: RO.textSoft,
        marginBottom: 18,
      }}
    >
      905 in your book of business
    </div>
    {RO_CONTACTS.map((c, i) => {
      const a = clampI(appear, i * 0.08, i * 0.08 + 0.3, 0, 1, ease);
      return (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: RO.card,
            border: `1px solid ${RO.border}`,
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 12,
            opacity: a,
            transform: `translateX(${(1 - a) * 30}px)`,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: `${c.c}33`,
              color: c.c,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            {c.n[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 24,
                color: RO.text,
              }}
            >
              {c.n}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 18, color: RO.textSoft }}>
              {c.p}
            </div>
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 700,
              color: c.c,
              background: `${c.c}22`,
              borderRadius: 8,
              padding: "5px 12px",
            }}
          >
            {c.s}
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 700,
              color: RO.textSoft,
            }}
          >
            {c.st}
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Kanban (Restoration pipeline) ──────────────────────────────────────────
const KanbanBoard: React.FC<{ cardAppear: number }> = ({ cardAppear }) => {
  const cols = ["Initial Inquiry", "Follow-up", "Estimate", "Closed Won"];
  const colW = 210;
  const gap = 14;
  return (
    <div style={{ display: "flex", gap, position: "relative" }}>
      {cols.map((c, i) => (
        <div
          key={i}
          style={{
            width: colW,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${RO.border}`,
            borderRadius: 16,
            padding: 12,
            minHeight: 300,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 17,
              fontWeight: 700,
              color: i === 3 ? RO.emerald : RO.textSoft,
              marginBottom: 12,
            }}
          >
            {c}
          </div>
          {[0, 1].map((k) => (
            <div
              key={k}
              style={{
                background: RO.card,
                border: `1px solid ${RO.border}`,
                borderRadius: 12,
                height: 58,
                marginBottom: 10,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ))}
      {cardAppear > 0 && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 12,
            width: colW - 24,
            background: RO.card,
            border: `1px solid ${RO.copper}`,
            borderRadius: 12,
            padding: 13,
            opacity: cardAppear,
            transform: `scale(${0.9 + 0.1 * cardAppear})`,
            boxShadow: `0 0 26px ${RO.copper}66`,
            zIndex: 50,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 20,
              color: RO.text,
            }}
          >
            John Smith
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 15,
              color: RO.textSoft,
              marginTop: 3,
            }}
          >
            (312) 555-1234
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <span
              style={{
                background: `${RO.info}33`,
                color: RO.info,
                borderRadius: 8,
                padding: "3px 9px",
                fontFamily: SANS,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              💧 Water
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              top: -12,
              right: -8,
              background: RO.emerald,
              color: "#04150E",
              borderRadius: 999,
              padding: "3px 10px",
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 800,
              boxShadow: `0 0 16px ${RO.emerald}`,
            }}
          >
            ● LIVE
          </div>
        </div>
      )}
    </div>
  );
};

// ─── persistent chip ────────────────────────────────────────────────────────
const PersistentChip: React.FC<{
  show: boolean;
  phone: string;
  brand: string;
}> = ({ show, phone, brand }) => {
  if (!show) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 999,
        padding: "10px 22px",
        fontFamily: SANS,
        fontSize: 24,
        fontWeight: 700,
        color: "#fff",
        zIndex: 7500,
      }}
    >
      {brand} · {phone}
    </div>
  );
};

const CameraRig: React.FC<{
  scale: number;
  x?: number;
  y?: number;
  children: React.ReactNode;
}> = ({ scale, x = 0, y = 0, children }) => (
  <AbsoluteFill
    style={{
      transform: `translate(${x}px, ${y}px) scale(${scale})`,
      transformOrigin: "50% 45%",
      willChange: "transform",
    }}
  >
    {children}
  </AbsoluteFill>
);

// ════════════════════════════════════════════════════════════════════════════
//  SCENES
// ════════════════════════════════════════════════════════════════════════════

// 1 — HOOK: the 5 things you waste time on
const PAINS = [
  { icon: "📞", t: "Chasing missed calls & leads" },
  { icon: "🧾", t: "Hunting down unpaid invoices" },
  { icon: "⌨️", t: "Typing the same data twice" },
  { icon: "📅", t: "Scheduling & follow-ups" },
  { icon: "🗂️", t: "Drowning in paperwork" },
];

const FiveThingsHook: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const wipe = clampI(
    bi.localF,
    bi.durF - Math.round(fps * 0.5),
    bi.durF,
    0,
    1,
    ease,
  );
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, #1a1014 0%, #07060a 100%)",
      }}
    >
      <DotGrid color="#F43F5E" opacity={0.25} frame={frame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 30%, rgba(244,63,94,${0.1 + 0.06 * Math.abs(Math.sin(bi.localF / 6))}) 0%, transparent 55%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 700,
            color: SM.textSoft,
            letterSpacing: "0.02em",
          }}
        >
          Running a business?
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 58,
            fontWeight: 800,
            color: "#fff",
            marginTop: 10,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            padding: "0 60px",
          }}
        >
          The 5 things eating
          <br />
          your day:
        </div>
      </div>
      <div style={{ position: "absolute", top: 470, left: 80, right: 80 }}>
        {PAINS.map((p, i) => {
          const start = 8 + i * 7;
          const a = clampI(bi.localF, start, start + 9, 0, 1, ease);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: 16,
                padding: "20px 26px",
                marginBottom: 16,
                opacity: a,
                transform: `translateX(${(1 - a) * -40}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 34,
                  color: SM.danger,
                  width: 44,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 38 }}>{p.icon}</div>
              <div
                style={{
                  flex: 1,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 34,
                  color: "#fff",
                  position: "relative",
                }}
              >
                {p.t}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: 0,
                    height: 4,
                    background: SM.emerald,
                    width: `${wipe * 100}%`,
                    borderRadius: 2,
                    boxShadow: `0 0 12px ${SM.emerald}`,
                  }}
                />
              </div>
              {wipe > 0.3 && (
                <div style={{ fontSize: 34, color: SM.emerald, opacity: wipe }}>
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// 2 — BRIDGE
const BridgeScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const flash = clampI(bi.localF, bi.durF - 5, bi.durF, 0, 0.85);
  const gather = clampI(bi.localF, 0, bi.durF * 0.7, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background: SM.canvas,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.4 * gather} frame={frame} />
      <HorizonBloom color="rgba(99,102,241,0.5)" intensity={gather} />
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 62,
          color: "#fff",
          textAlign: "center",
          padding: "0 80px",
          opacity: gather,
          transform: `scale(${0.9 + gather * 0.1})`,
          textShadow: `0 0 40px ${SM.indigo}`,
        }}
      >
        Now imagine every one of them…
        <br />
        <span style={{ color: SM.indigoLite }}>handled.</span>
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// 3+4 — Stolen Mule full app
const StolenMuleApp: React.FC<{
  frame: number;
  fps: number;
  b: Record<string, BeatInfo>;
}> = ({ frame, fps, b }) => {
  const t = b.SM_TOOLS;
  const m = b.SM_MONEY;
  const glowIdx = 10 + Math.floor(clampI(frame, t.sF + 10, t.eF - 6, 0, 3.99));
  // Populate the dashboard DURING the tools/sidebar beat so the "full product"
  // shot is complete (sidebar + live data), then SM_MONEY pushes in + scrubs.
  const kpiA = (i: number) =>
    clampI(frame, t.sF + 20 + i * 5, t.sF + 20 + i * 5 + 14, 0, 1, ease);
  const collected = countUp(frame, t.sF + 20, t.durF * 0.5, 284900);
  const unbilled = countUp(frame, t.sF + 20, t.durF * 0.5, 48200);
  const unpaid = countUp(frame, t.sF + 22, t.durF * 0.5, 112750);
  const overdue = countUp(frame, t.sF + 24, t.durF * 0.5, 19400);
  const chartDraw = clampI(frame, t.sF + 55, t.sF + 130, 0, 1, ease);
  const scrub = clampI(
    frame,
    m.sF + m.durF * 0.5,
    m.eF,
    0,
    1,
    Easing.inOut(Easing.cubic),
  );

  return (
    <AbsoluteFill
      style={{ background: SM.canvas, display: "flex", flexDirection: "row" }}
    >
      <Sidebar
        brandName="Stolen Mule"
        brandSub="The REAL Law Group"
        accent={SM.indigo}
        bg={SM.sidebar}
        items={SM_NAV}
        activeIdx={0}
        glowIdx={glowIdx}
        extra="+16 more tools"
      />
      <div
        style={{
          flex: 1,
          position: "relative",
          padding: "30px 36px",
          overflow: "hidden",
        }}
      >
        <DotGrid color="#6366F1" opacity={0.35} frame={frame} />
        <HorizonBloom color="rgba(99,102,241,0.4)" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 40,
                fontWeight: 800,
                color: SM.text,
              }}
            >
              Command Deck
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 20,
                color: SM.indigoLite,
                fontWeight: 600,
              }}
            >
              The REAL Law Group
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: SANS,
              fontSize: 20,
              color: SM.indigoLite,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: SM.indigo,
                boxShadow: `0 0 12px ${SM.indigo}`,
              }}
            />{" "}
            Live
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 22,
          }}
        >
          <KpiTile
            label="Unbilled"
            value={fmtMoney(unbilled)}
            appear={kpiA(0)}
            compact
          />
          <KpiTile
            label="Unpaid"
            value={fmtMoney(unpaid)}
            appear={kpiA(1)}
            compact
          />
          <KpiTile
            label="Overdue"
            value={fmtMoney(overdue)}
            accent={SM.danger}
            appear={kpiA(2)}
            compact
          />
          <KpiTile
            label="Collected / mo"
            value={fmtMoney(collected)}
            accent={SM.indigoLite}
            hero
            delta="18%"
            appear={kpiA(3)}
          />
        </div>
        <div
          style={{
            background: SM.tile,
            border: `1px solid ${SM.tileBorder}`,
            borderRadius: 22,
            padding: 22,
            marginBottom: 20,
            opacity: clampI(frame, t.sF + 45, t.sF + 60, 0.3, 1),
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: SM.sky,
              marginBottom: 12,
            }}
          >
            REVENUE — MONTH BY MONTH
          </div>
          <RevenueChart
            draw={Math.max(0.001, chartDraw)}
            scrub={scrub}
            area={SM.sky}
            glow={SM.indigo}
            width={640}
            height={220}
          />
        </div>
        <div
          style={{
            background: SM.tile,
            border: `1px solid ${SM.tileBorder}`,
            borderRadius: 22,
            padding: 22,
            opacity: clampI(frame, t.sF + 90, t.sF + 110, 0, 1),
          }}
        >
          <ARAging
            appear={clampI(frame, t.sF + 95, t.sF + 125, 0, 1, ease)}
            label="MONEY OWED TO YOU"
          />
        </div>
        {t.active && (
          <div
            style={{
              position: "absolute",
              bottom: 30,
              right: 36,
              fontFamily: SANS,
              fontSize: 22,
              fontWeight: 800,
              color: SM.indigoLite,
              opacity: clampI(t.localF, 6, 18, 0, 1),
            }}
          >
            30+ tools · 4 AI engines
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// 5 — PIVOT
const PivotLabel: React.FC<{ text: string; sub: string; color: string }> = ({
  text,
  sub,
  color,
}) => (
  <div
    style={{
      position: "absolute",
      top: "42%",
      left: 0,
      right: 0,
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontFamily: SANS,
        fontSize: 38,
        fontWeight: 800,
        letterSpacing: "0.08em",
        color,
        textShadow: `0 0 22px ${color}`,
      }}
    >
      {text}
    </div>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 22,
        fontWeight: 600,
        color: "rgba(255,255,255,0.6)",
        marginTop: 8,
      }}
    >
      {sub}
    </div>
  </div>
);
const PivotScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const split = clampI(bi.localF, 0, bi.durF * 0.5, 0, 1, ease);
  const seam = clampI(bi.localF, bi.durF * 0.4, bi.durF * 0.55, 0, 1);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          right: "50%",
          background: SM.canvas,
          transform: `translateX(${-(1 - split) * 100}%)`,
          borderRight: `2px solid ${SM.indigo}`,
        }}
      >
        <DotGrid color="#6366F1" opacity={0.5} frame={frame} />
        <HorizonBloom color="rgba(99,102,241,0.5)" />
        <PivotLabel text="LAW FIRM" sub="Stolen Mule" color={SM.indigoLite} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          left: "50%",
          background: RO.canvas,
          transform: `translateX(${(1 - split) * 100}%)`,
          borderLeft: `2px solid ${RO.copper}`,
        }}
      >
        <DotGrid color="#F0742A" opacity={0.45} frame={frame} />
        <HorizonBloom color="rgba(240,116,42,0.45)" />
        <PivotLabel
          text="RESTORATION"
          sub="Restoration One"
          color={RO.copperHi}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 8,
          transform: "translateX(-50%)",
          background: "#fff",
          opacity: seam * (1 - seam) * 4,
          filter: "blur(4px)",
        }}
      />
    </AbsoluteFill>
  );
};

// 6+7 — Restoration full app (dashboard → pipeline → contacts swiper)
const RestorationApp: React.FC<{
  frame: number;
  fps: number;
  b: Record<string, BeatInfo>;
}> = ({ frame, fps, b }) => {
  const h = b.RO_HEAD;
  const crm = b.RO_CRM;
  const panel = clampI(frame, crm.sF + 6, crm.eF - 10, 0, 2, ease);
  const stripX = -panel * 744;

  const revenue = countUp(frame, h.sF, h.durF * 0.8, 612480);
  const headGlow = clampI(frame, h.sF, h.sF + 10, 0, 1);
  const kpiA = (i: number) =>
    clampI(frame, h.sF + 16 + i * 5, h.sF + 16 + i * 5 + 14, 0, 1, ease);
  const chartDraw = clampI(frame, h.sF + 20, h.eF, 0, 1, ease);
  const funnelA = clampI(frame, crm.sF, crm.sF + 20, 0, 1);
  const kanbanAppear = clampI(frame, crm.sF + 10, crm.sF + 26, 0, 1);
  const contactsA = clampI(frame, crm.sF + crm.durF * 0.55, crm.eF, 0, 1);

  return (
    <AbsoluteFill
      style={{ background: RO.canvas, display: "flex", flexDirection: "row" }}
    >
      <Sidebar
        brandName="Restoration One"
        accent={RO.copper}
        bg={RO.sidebar}
        items={RO_NAV}
        activeIdx={Math.round(panel)}
        glowIdx={Math.round(panel)}
        extra="Chicago · live"
      />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <DotGrid color="#F0742A" opacity={0.3} frame={frame} />
        <HorizonBloom color="rgba(240,116,42,0.4)" />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            display: "flex",
            transform: `translateX(${stripX}px)`,
            willChange: "transform",
          }}
        >
          {/* panel 0: dashboard */}
          <div style={{ width: 744, padding: "30px 34px", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: RO.textSoft,
                textTransform: "uppercase",
              }}
            >
              Revenue Sold · June 2026
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 100,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: RO.copperHi,
                textShadow: `0 0 ${40 + headGlow * 40}px ${RO.copper}`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtMoney(revenue)}
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {["▲ 22% MoM", "▲ 41% YoY"].map((d, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: SANS,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#04150E",
                    background: RO.emerald,
                    borderRadius: 999,
                    padding: "5px 14px",
                    opacity: headGlow,
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {[
                { l: "Jobs", v: "38" },
                { l: "Close Rate", v: "31%" },
                { l: "Avg Job", v: "$16.1k" },
                { l: "Leads In", v: "52" },
              ].map((k, i) => (
                <div
                  key={i}
                  style={{
                    background: RO.card,
                    border: `1px solid ${RO.border}`,
                    borderRadius: 16,
                    padding: "16px 18px",
                    opacity: kpiA(i),
                    transform: `translateY(${(1 - kpiA(i)) * 26}px)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: RO.textSoft,
                      textTransform: "uppercase",
                    }}
                  >
                    {k.l}
                  </div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 44,
                      fontWeight: 800,
                      color: RO.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {k.v}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                background: RO.card,
                border: `1px solid ${RO.border}`,
                borderRadius: 20,
                padding: 22,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: RO.copperHi,
                  marginBottom: 12,
                }}
              >
                13-MONTH REVENUE
              </div>
              <RevenueChart
                draw={Math.max(0.001, chartDraw)}
                scrub={0}
                area={RO.copper}
                glow={RO.copper}
                width={650}
                height={180}
                data={[28, 31, 30, 38, 44, 41, 52, 49, 58, 66, 72, 80, 92]}
              />
            </div>
          </div>
          {/* panel 1: pipeline */}
          <div style={{ width: 744, padding: "30px 30px", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 30,
                fontWeight: 800,
                color: RO.text,
                marginBottom: 4,
              }}
            >
              Pipeline
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 18,
                color: RO.textSoft,
                marginBottom: 18,
              }}
            >
              Week 23 · drag to move · revenue updates live
            </div>
            <KanbanBoard cardAppear={kanbanAppear} />
            <div style={{ marginTop: 22 }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: RO.amber,
                  marginBottom: 14,
                }}
              >
                WHERE LEADS GO COLD
              </div>
              <Funnel appear={funnelA} />
            </div>
          </div>
          {/* panel 2: contacts */}
          <div style={{ width: 744, padding: "30px 34px", flexShrink: 0 }}>
            <ContactsList appear={contactsA} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 8 — Full-screen Telegram demo
const PhoneFull: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const msg = "John Smith | 312-555-1234 | water damage, quote by Friday";
  const typeP = clampI(bi.localF, 6, bi.durF * 0.34, 0, 1);
  const sent = bi.localF > bi.durF * 0.36;
  const reading = clampI(bi.localF, bi.durF * 0.4, bi.durF * 0.52, 0, 1);
  const cardIn = clampI(bi.localF, bi.durF * 0.58, bi.durF * 0.74, 0, 1, ease);
  const shown = msg.slice(0, Math.floor(msg.length * typeP));
  return (
    <AbsoluteFill
      style={{
        background: "#0A0E14",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#F0742A" opacity={0.2} frame={frame} />
      <div
        style={{
          width: 860,
          height: 1640,
          borderRadius: 76,
          background: "#0E1621",
          border: "12px solid #1b2a3a",
          boxShadow: "0 40px 140px rgba(0,0,0,0.8)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 132,
            background: "#17212B",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: RO.copper,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontWeight: 800,
              color: "#fff",
              fontSize: 32,
            }}
          >
            R1
          </div>
          <div>
            <div
              style={{
                fontFamily: SANS,
                color: "#fff",
                fontWeight: 700,
                fontSize: 34,
              }}
            >
              Restoration One · Leads
            </div>
            <div style={{ fontFamily: SANS, color: "#5b6b7b", fontSize: 24 }}>
              AI intake bot · online
            </div>
          </div>
        </div>
        <div
          style={{
            padding: 40,
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              marginLeft: "auto",
              maxWidth: "84%",
              background: "#2B5278",
              color: "#fff",
              borderRadius: "26px 26px 6px 26px",
              padding: "26px 30px",
              fontFamily: SANS,
              fontSize: 34,
              lineHeight: 1.4,
              opacity: typeP > 0 ? 1 : 0,
              transform: sent ? "translateY(-4px)" : "none",
            }}
          >
            {shown}
            {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
          </div>
          {reading > 0 && (
            <div
              style={{
                maxWidth: "60%",
                background: "#1f2c39",
                borderRadius: "26px 26px 26px 6px",
                padding: "22px 28px",
                fontFamily: SANS,
                fontSize: 30,
                color: RO.copperHi,
                opacity: reading,
              }}
            >
              reading lead… ✨
            </div>
          )}
          {cardIn > 0 && (
            <div
              style={{
                background: "#101722",
                border: `2px solid ${RO.copper}`,
                borderRadius: 24,
                padding: 32,
                opacity: cardIn,
                transform: `scale(${0.9 + cardIn * 0.1})`,
                boxShadow: `0 0 50px ${RO.copper}66`,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  fontWeight: 700,
                  color: RO.copperHi,
                  marginBottom: 14,
                  letterSpacing: "0.04em",
                }}
              >
                ✓ ADDED TO PIPELINE
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 46,
                  color: "#fff",
                }}
              >
                John Smith
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 30,
                  color: "#9BA6B2",
                  marginTop: 8,
                }}
              >
                (312) 555-1234
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 18,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: `${RO.info}33`,
                    color: RO.info,
                    borderRadius: 12,
                    padding: "8px 18px",
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 28,
                  }}
                >
                  💧 Water
                </span>
                <span
                  style={{
                    background: `${RO.amber}33`,
                    color: RO.amber,
                    borderRadius: 12,
                    padding: "8px 18px",
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 28,
                  }}
                >
                  by Fri
                </span>
                <span
                  style={{
                    background: RO.emerald,
                    color: "#04150E",
                    borderRadius: 999,
                    padding: "8px 16px",
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 24,
                    boxShadow: `0 0 20px ${RO.emerald}`,
                  }}
                >
                  ● LIVE
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 9 — PROOF: Jarvis sliding HUD of real businesses
const PROOF_CARDS = [
  {
    brand: "Stolen Mule",
    client: "The REAL Law Group",
    tag: "LAW FIRM",
    accent: SM.indigo,
    accentHi: SM.indigoLite,
    bg: SM.canvas,
  },
  {
    brand: "Restoration One",
    client: "Restoration crew · Chicago",
    tag: "RESTORATION",
    accent: RO.copper,
    accentHi: RO.copperHi,
    bg: RO.canvas,
  },
];

const JarvisProof: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const inP = clampI(bi.localF, 0, 16, 0, 1, ease);
  const drift = Math.sin(bi.localF / 24) * 18;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0b0d14 0%, #050608 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.22} frame={frame} />
      <Scanlines opacity={0.06} />
      <div
        style={{
          position: "absolute",
          top: 230,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: inP,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            letterSpacing: "0.3em",
            color: SM.indigoLite,
          }}
        >
          // REAL BUSINESSES · REAL PEOPLE
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 40,
          transform: `translateX(${drift}px)`,
          opacity: inP,
        }}
      >
        {PROOF_CARDS.map((c, i) => {
          const cardIn = clampI(
            bi.localF,
            6 + i * 8,
            6 + i * 8 + 16,
            0,
            1,
            ease,
          );
          return (
            <div
              key={i}
              style={{
                width: 420,
                height: 820,
                background: c.bg,
                borderRadius: 30,
                border: `2px solid ${c.accent}88`,
                boxShadow: `0 0 70px ${c.accent}66`,
                padding: 30,
                position: "relative",
                overflow: "hidden",
                opacity: cardIn,
                transform: `translateY(${(1 - cardIn) * 60}px) perspective(1400px) rotateY(${(i === 0 ? 8 : -8) * (1 - cardIn)}deg)`,
              }}
            >
              <HorizonBloom color={`${c.accent}55`} />
              <Scanlines opacity={0.05} />
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 20,
                  letterSpacing: "0.2em",
                  color: c.accentHi,
                }}
              >
                {c.tag}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 44,
                  color: "#fff",
                  marginTop: 8,
                }}
              >
                {c.brand}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 24,
                  color: c.accentHi,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {c.client}
              </div>
              {[0, 1, 2, 3].map((k) => (
                <div
                  key={k}
                  style={{
                    marginTop: k === 0 ? 30 : 16,
                    height: 70,
                    borderRadius: 14,
                    background: `${c.accent}1f`,
                    border: `1px solid ${c.accent}40`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${40 + 50 * Math.abs(Math.sin(bi.localF / 12 + k))}%`,
                      background: `linear-gradient(90deg, ${c.accent}, ${c.accentHi})`,
                      opacity: 0.5,
                    }}
                  />
                </div>
              ))}
              <div
                style={{
                  marginTop: 26,
                  height: 150,
                  borderRadius: 16,
                  background: `linear-gradient(180deg, ${c.accent}40, transparent)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 26,
                  left: 30,
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 800,
                  color: c.accentHi,
                }}
              >
                ● LIVE & IN USE
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 470,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 32,
          fontWeight: 700,
          color: "#fff",
          opacity: inP,
        }}
      >
        Two industries. One developer. Built from scratch.
      </div>
    </AbsoluteFill>
  );
};

// 10 — TURN (brief)
const TurnScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const inP = clampI(bi.localF, 0, 12, 0, 1, ease);
  const glow = 0.6 + 0.4 * Math.abs(Math.sin(bi.localF / 7));
  return (
    <AbsoluteFill
      style={{
        background: "#05060a",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.2} frame={frame} />
      <div
        style={{
          width: 760,
          height: 360,
          borderRadius: 26,
          border: "2px dashed rgba(255,255,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${70 * glow}px rgba(99,102,241,${0.4 * glow})`,
          opacity: inP,
          transform: `scale(${0.94 + inP * 0.06})`,
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontSize: 50,
            fontWeight: 800,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          YOUR BUSINESS
        </span>
      </div>
    </AbsoluteFill>
  );
};

// 11+12 — Clean close
const CleanClose: React.FC<{
  frame: number;
  fps: number;
  b: Record<string, BeatInfo>;
  brand: string;
  phone: string;
  email: string;
  offer: string;
  logoUrl: string;
}> = ({ frame, fps, b, brand, phone, email, offer, logoUrl }) => {
  const s = b.CLOSE.sF;
  const logoSpring = spring({
    frame: frame - s,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });
  const sweep = clampI(frame, s + 6, s + 24, -1, 2);
  const offerIn = clampI(frame, s + 14, s + 28, 0, 1, ease);
  const phoneIn = clampI(frame, b.CTA.sF - 6, b.CTA.sF + 10, 0, 1, ease);
  const phonePulse = b.CTA.active
    ? 1 + 0.04 * Math.sin((frame - b.CTA.sF) / 5)
    : 1;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, #0c0f1a 0%, #050608 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.25} frame={frame} />
      <HorizonBloom color="rgba(99,102,241,0.3)" />
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            transform: `scale(${0.7 + logoSpring * 0.3})`,
            opacity: logoSpring,
            position: "relative",
            display: "inline-block",
          }}
        >
          {logoUrl ? (
            <Img src={logoUrl} style={{ height: 150, objectFit: "contain" }} />
          ) : (
            <div
              style={{
                fontFamily: SANS,
                fontSize: 100,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#fff",
                position: "relative",
              }}
            >
              Simply Scaled
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.85) 50%, transparent 60%)",
                  transform: `translateX(${sweep * 100}%)`,
                  mixBlendMode: "overlay",
                }}
              />
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
            marginTop: 44,
            fontFamily: SANS,
            fontSize: 36,
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            opacity: offerIn,
            maxWidth: 840,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.3,
          }}
        >
          {offer}
        </div>
        <div
          style={{
            marginTop: 46,
            opacity: Math.max(offerIn, phoneIn),
            transform: `scale(${phonePulse})`,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 96,
              fontWeight: 800,
              color: "#fff",
              textShadow: b.CTA.active ? `0 0 40px ${SM.indigo}` : "none",
            }}
          >
            📞 {phone}
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 34,
              fontWeight: 700,
              color: SM.indigoLite,
              marginTop: 6,
            }}
          >
            Call or text
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 32,
              color: "rgba(255,255,255,0.78)",
              marginTop: 16,
            }}
          >
            {email}
          </div>
        </div>
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
  email = "bradyschwartz25@gmail.com",
  offer = "Free 15-min teardown of where your money's leaking — no pitch.",
  logoUrl = "",
  founderPhotoUrl = "",
  lite = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bts = beats && beats.length ? beats : buildDefaultBeats();
  const b = useBeats(bts, fps, frame);

  const smCam = 1.0 + clampI(frame, b.SM_TOOLS.sF, b.SM_MONEY.eF, 0.04, -0.03);
  const roCam = 1.0 + clampI(frame, b.RO_HEAD.sF, b.RO_CRM.eF, 0.05, -0.02);

  const showChip = frame >= b.RO_HEAD.sF && frame < b.PROOF.sF;
  const activeKey = bts.find(
    (x) =>
      frame >= Math.round(x.start * fps) &&
      frame < Math.round((x.start + x.dur) * fps),
  )?.key;
  const roAccentKeys = ["RO_HEAD", "RO_CRM", "TG_DEMO"];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {b.HOOK.visible && <FiveThingsHook frame={frame} fps={fps} bi={b.HOOK} />}
      {b.BRIDGE.visible && (
        <BridgeScene frame={frame} fps={fps} bi={b.BRIDGE} />
      )}

      {(b.SM_TOOLS.visible || b.SM_MONEY.visible) && (
        <CameraRig scale={smCam}>
          <StolenMuleApp frame={frame} fps={fps} b={b} />
        </CameraRig>
      )}

      {b.PIVOT.visible && <PivotScene frame={frame} fps={fps} bi={b.PIVOT} />}

      {(b.RO_HEAD.visible || b.RO_CRM.visible) && (
        <CameraRig scale={roCam}>
          <RestorationApp frame={frame} fps={fps} b={b} />
        </CameraRig>
      )}

      {b.TG_DEMO.visible && (
        <PhoneFull frame={frame} fps={fps} bi={b.TG_DEMO} />
      )}
      {b.PROOF.visible && <JarvisProof frame={frame} fps={fps} bi={b.PROOF} />}
      {b.TURN.visible && <TurnScene frame={frame} fps={fps} bi={b.TURN} />}
      {(b.CLOSE.visible || b.CTA.visible) && (
        <CleanClose
          frame={frame}
          fps={fps}
          b={b}
          brand={brand}
          phone={phone}
          email={email}
          offer={offer}
          logoUrl={logoUrl}
        />
      )}

      <PersistentChip show={showChip} phone={phone} brand={brand} />

      {frame < b.PROOF.sF && (
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 54,
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.5)",
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
          big={activeKey === "HOOK" || activeKey === "TURN"}
          accent={roAccentKeys.includes(activeKey) ? RO.copper : SM.indigo}
        />
      )}

      <Vignette />
      {!lite && <Grain />}
    </AbsoluteFill>
  );
};
