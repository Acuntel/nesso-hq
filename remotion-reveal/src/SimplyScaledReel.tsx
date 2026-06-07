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
//  SIMPLY SCALED — 60s vertical sales reel ("One Builder. Any Business.")
//  Cinematic recreation of two real dashboards Brady built:
//    • Stolen Mule  — law-firm "Command Deck"  (indigo / near-black)
//    • Restoration One — restoration "$20k dashboard" (copper / black)
//  Jarvis/Higgsfield product-cinema: weightless camera, glow blooms, count-ups,
//  charts that draw themselves, a Telegram-text→live-lead miracle, founder close.
//
//  Timing is DATA-DRIVEN: pass `beats` (per-beat start+dur in seconds, derived
//  from the real ElevenLabs VO) so visuals lock to the voiceover. Defaults sum
//  to exactly 60.0s so the comp renders standalone in Remotion Studio.
// ════════════════════════════════════════════════════════════════════════════

export type ReelBeat = { key: string; start: number; dur: number };

export type SimplyScaledReelProps = {
  beats?: ReelBeat[];
  brand?: string;
  phone?: string; // display form, e.g. "(847) 212-2142"
  email?: string;
  offer?: string;
  logoUrl?: string; // optional brand PNG
  founderPhotoUrl?: string; // optional headshot for the human beat
  lite?: boolean; // Railway/low-mem mode: skip the most expensive per-frame FX
};

// ─── Default beat durations (seconds). Sum = 60.0 ───────────────────────────
const DEFAULT_DURS: { key: string; dur: number }[] = [
  { key: "HOOK", dur: 1.5 },
  { key: "CHAOS", dur: 2.5 },
  { key: "SNAP", dur: 2.0 },
  { key: "SM_KPI", dur: 3.0 },
  { key: "SM_MONEY", dur: 4.0 },
  { key: "SM_STUCK", dur: 4.0 },
  { key: "PIVOT", dur: 3.0 },
  { key: "RO_HEAD", dur: 4.0 },
  { key: "RO_CHARTS", dur: 4.0 },
  { key: "DEMO_TEXT", dur: 5.0 },
  { key: "DEMO_WON", dur: 4.0 },
  { key: "PROOF", dur: 4.0 },
  { key: "HUMAN", dur: 4.0 },
  { key: "TURN", dur: 4.0 },
  { key: "CLOSE", dur: 5.0 },
  { key: "CTA", dur: 6.0 },
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
  HOOK: "A MESSY TEXT → A $9,000 JOB. IN 4 SECONDS.",
  CHAOS: "THIS IS HOW MOST BUSINESSES STILL RUN.",
  SNAP: "UNTIL YOU SEE IT BUILT RIGHT.",
  SM_KPI: "ONE SCREEN. EVERY DOLLAR EARNED & OWED.",
  SM_MONEY: "WATCH IT GROW. NO GUESSING.",
  SM_STUCK: "SEE WHAT'S STUCK — GO GET IT.",
  PIVOT: "WHATEVER YOUR BUSINESS IS — WATCH ME DO IT AGAIN.",
  RO_HEAD: "EVERY JOB. EVERY LEAD. LIVE.",
  RO_CHARTS: "WHERE LEADS SLIP. WHERE MONEY STICKS.",
  DEMO_TEXT: "MESSY TEXT IN → CLEAN LEAD OUT. NOTHING MISSED.",
  DEMO_WON: "WIN A JOB → REVENUE UPDATES ITSELF.",
  PROOF: "TWO INDUSTRIES. ONE DEVELOPER. BUILT BY ME.",
  HUMAN: "WHATEVER YOU RUN — I'LL BUILD THE SYSTEM THAT RUNS IT.",
  TURN: "IMAGINE YOURS.",
  CLOSE: "FREE 15-MIN TEARDOWN — NO PITCH.",
  CTA: "CALL / TEXT (847) 212-2142",
};

// ─── Palettes (exact hexes pulled from the live repos) ──────────────────────
const SM = {
  canvas: "#0A0E17",
  grid: "rgba(99,102,241,0.06)",
  indigo: "#6366F1",
  indigoLite: "#818CF8",
  sky: "#52A9FF",
  amber: "#FBBF24",
  danger: "#F43F5E",
  text: "#E6EAF2",
  textSoft: "rgba(230,234,242,0.55)",
  tile: "rgba(255,255,255,0.035)",
  tileBorder: "rgba(255,255,255,0.08)",
};
const RO = {
  canvas: "#0B0E11",
  card: "#14181D",
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

// ════════════════════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════════════════════

type BeatInfo = {
  active: boolean;
  visible: boolean; // active + small lead/tail pad
  sF: number;
  eF: number;
  durF: number;
  localF: number;
  p: number; // 0..1 progress across the beat
};

function useBeats(beats: ReelBeat[], fps: number, frame: number) {
  const map: Record<string, BeatInfo> = {};
  for (const b of beats) {
    const sF = Math.round(b.start * fps);
    const durF = Math.max(1, Math.round(b.dur * fps));
    const eF = sF + durF;
    const localF = frame - sF;
    const active = frame >= sF && frame < eF;
    const visible = frame >= sF - 6 && frame < eF + 2;
    map[b.key] = {
      active,
      visible,
      sF,
      eF,
      durF,
      localF,
      p: Math.max(0, Math.min(1, localF / durF)),
    };
  }
  return map;
}

const ease = Easing.bezier(0.16, 1, 0.3, 1); // smooth "weightless settle"

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Count-up that eases to a target across a window
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

// ════════════════════════════════════════════════════════════════════════════
//  Global atmosphere: dot-grid, horizon bloom, grain, vignette, chroma bloom
// ════════════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════════════
//  Caption stamp (bold, muted-viewer legible, per beat)
// ════════════════════════════════════════════════════════════════════════════

const Caption: React.FC<{
  text: string;
  localF: number;
  durF: number;
  fps: number;
  accent?: string;
  big?: boolean;
}> = ({ text, localF, durF, fps, accent = "#FFFFFF", big = false }) => {
  if (localF < 0) return null;
  const inP = interpolate(localF, [0, Math.round(fps * 0.22)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const outP = interpolate(
    localF,
    [durF - Math.round(fps * 0.25), durF],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
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
          fontSize: big ? 70 : 56,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          textShadow: `0 4px 30px rgba(0,0,0,0.85), 0 0 22px ${accent}55`,
          padding: "0 8px",
          display: "inline-block",
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  Reusable dashboard pieces
// ════════════════════════════════════════════════════════════════════════════

const KpiTile: React.FC<{
  label: string;
  value: string;
  accent?: string;
  hero?: boolean;
  delta?: string;
  appear: number; // 0..1
  glanceLabel?: string;
}> = ({ label, value, accent = SM.text, hero, delta, appear, glanceLabel }) => {
  const y = (1 - appear) * 40;
  return (
    <div
      style={{
        background: hero
          ? "linear-gradient(160deg, rgba(99,102,241,0.18), rgba(99,102,241,0.04))"
          : SM.tile,
        border: `1px solid ${hero ? "rgba(99,102,241,0.5)" : SM.tileBorder}`,
        borderRadius: 26,
        padding: "26px 28px",
        opacity: appear,
        transform: `translateY(${y}px)`,
        boxShadow: hero
          ? `0 0 60px ${SM.indigo}55, inset 0 0 0 1px ${SM.indigo}33`
          : "0 10px 30px rgba(0,0,0,0.4)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: SM.textSoft,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: hero ? 76 : 58,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: accent,
          marginTop: 8,
          textShadow: hero ? `0 0 36px ${SM.indigo}aa` : "none",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {delta && (
        <div
          style={{
            display: "inline-block",
            marginTop: 12,
            fontFamily: SANS,
            fontSize: 24,
            fontWeight: 700,
            color: SM.canvas,
            background: "#34D399",
            borderRadius: 999,
            padding: "4px 14px",
          }}
        >
          ▲ {delta}
        </div>
      )}
      {glanceLabel && (
        <div
          style={{
            marginTop: 10,
            fontFamily: SANS,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: SM.indigoLite,
          }}
        >
          {glanceLabel}
        </div>
      )}
    </div>
  );
};

// Animated revenue area chart with dashed comparison line + glowing brush
const RevenueChart: React.FC<{
  draw: number; // 0..1 how much of the line is drawn
  scrub: number; // 0..1 brush position
  area: string;
  line: string;
  glow: string;
  width: number;
  height: number;
  data?: number[];
}> = ({
  draw,
  scrub,
  area,
  line,
  glow,
  width,
  height,
  data = [22, 28, 26, 34, 40, 38, 47, 52, 58, 64, 71, 84, 92],
}) => {
  const n = data.length;
  const max = Math.max(...data) * 1.12;
  const padB = 26;
  const xs = (i: number) => (i / (n - 1)) * width;
  const ys = (v: number) => height - padB - (v / max) * (height - padB - 16);
  // smooth-ish polyline
  const pts = data.map((v, i) => [xs(i), ys(v)] as const);
  const linePath = pts
    .map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1])
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height - padB} L 0 ${height - padB} Z`;
  const billed = data.map((v) => v * 1.18);
  const billedPath = billed
    .map((v, i) => (i ? "L" : "M") + xs(i) + " " + ys(v))
    .join(" ");
  const totalLen = 2600;
  const dashOffset = (1 - draw) * totalLen;
  const brushX = scrub * width;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={area} stopOpacity="0.55" />
          <stop offset="100%" stopColor={area} stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id="bloomGrad" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.35" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <clipPath id="drawClip">
          <rect x="0" y="0" width={width * draw} height={height} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="url(#bloomGrad)" />
      <g clipPath="url(#drawClip)">
        <path d={areaPath} fill="url(#areaGrad)" />
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
      {/* "now" marker */}
      <line
        x1={width}
        y1={8}
        x2={width}
        y2={height - padB}
        stroke={glow}
        strokeWidth={2}
        opacity={0.35 * draw}
      />
      {/* glowing brush traveller */}
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
            r={12}
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
    { w: 34, c: SM.sky, t: "0–30" },
    { w: 26, c: "#3E82C8", t: "31–60" },
    { w: 22, c: SM.amber, t: "61–90" },
    { w: 18, c: SM.danger, t: "90+" },
  ];
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "0.14em",
          color: SM.danger,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          height: 42,
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
              transition: "none",
              boxShadow: i === 3 ? `0 0 18px ${SM.danger}` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const RadialGauge: React.FC<{ p: number; accent: string; label: string }> = ({
  p,
  accent,
  label,
}) => {
  const r = 58;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <svg width={150} height={150}>
        <circle
          cx={75}
          cy={75}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={12}
        />
        <circle
          cx={75}
          cy={75}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 75 75)"
          style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
        />
        <text
          x={75}
          y={86}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize={40}
          fontWeight={800}
          fill={SM.text}
        >
          {Math.round(p * 100)}%
        </text>
      </svg>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: SM.textSoft,
          textTransform: "uppercase",
        }}
      >
        {label}
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
        const a = interpolate(appear, [i * 0.14, i * 0.14 + 0.4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        });
        return (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", marginBottom: 14 }}
          >
            <div
              style={{
                height: 56,
                width: `${s.w * a}%`,
                background: s.leak
                  ? `linear-gradient(90deg, ${RO.copper}, ${RO.amber})`
                  : `linear-gradient(90deg, ${RO.copper}, ${RO.copperHi})`,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                paddingLeft: 22,
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 26,
                color: "#fff",
                boxShadow: s.leak ? `0 0 24px ${RO.amber}88` : "none",
              }}
            >
              {s.label}
            </div>
            {s.drop && (
              <div
                style={{
                  marginLeft: 16,
                  fontFamily: MONO,
                  fontSize: 24,
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

// Kanban board (Restoration One) with a card that can be highlighted / dragged
const KanbanBoard: React.FC<{
  cardAppear: number; // 0..1 new card materializes in col 0
  dragP: number; // 0..1 drag from col0 to "Won"
  wonFlash: number; // 0..1 flash on drop
}> = ({ cardAppear, dragP, wonFlash }) => {
  const cols = ["Initial Inquiry", "Follow-up", "Estimate", "Closed Won"];
  const colW = 232;
  const gap = 18;
  const startX = 0;
  const endX = (cols.length - 1) * (colW + gap);
  const dragX = startX + (endX - startX) * dragP;
  const dragY = dragP > 0 ? 0 : 0;
  return (
    <div style={{ display: "flex", gap, position: "relative" }}>
      {cols.map((c, i) => (
        <div
          key={i}
          style={{
            width: colW,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${RO.border}`,
            borderRadius: 18,
            padding: 14,
            minHeight: 360,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 19,
              fontWeight: 700,
              color: i === 3 ? RO.emerald : RO.textSoft,
              marginBottom: 12,
              letterSpacing: "0.02em",
            }}
          >
            {c}
          </div>
          {/* static filler cards */}
          {[0, 1].map((k) => (
            <div
              key={k}
              style={{
                background: RO.card,
                border: `1px solid ${RO.border}`,
                borderRadius: 12,
                height: 70,
                marginBottom: 10,
                opacity: 0.5,
              }}
            />
          ))}
          {i === 3 && wonFlash > 0 && (
            <div
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: 18,
                boxShadow: `0 0 0 3px ${RO.emerald}, 0 0 40px ${RO.emerald}`,
                opacity: wonFlash,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      ))}
      {/* the live John Smith card */}
      {cardAppear > 0 && (
        <div
          style={{
            position: "absolute",
            top: 50 + dragY,
            left: 14 + dragX,
            width: colW - 28,
            background: RO.card,
            border: `1px solid ${dragP > 0.9 ? RO.emerald : RO.copper}`,
            borderRadius: 12,
            padding: 14,
            opacity: cardAppear,
            transform: `scale(${0.9 + 0.1 * cardAppear})`,
            boxShadow:
              dragP > 0 && dragP < 1
                ? `0 18px 50px rgba(0,0,0,0.6)`
                : `0 0 26px ${RO.copper}66`,
            zIndex: 50,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 24,
              color: RO.text,
            }}
          >
            John Smith
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 18,
              color: RO.textSoft,
              marginTop: 4,
            }}
          >
            (312) 555-1234
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <span
              style={{
                background: `${RO.info}33`,
                color: RO.info,
                borderRadius: 8,
                padding: "3px 10px",
                fontFamily: SANS,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              💧 Water
            </span>
            <span
              style={{
                background: `${RO.amber}33`,
                color: RO.amber,
                borderRadius: 8,
                padding: "3px 10px",
                fontFamily: SANS,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              by Fri
            </span>
          </div>
          {/* LIVE badge */}
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
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
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

// Telegram phone mockup with typing + send
const PhoneMockup: React.FC<{
  typeP: number; // 0..1 typing progress of the messy text
  sendP: number; // 0..1 once sent (bubble flies + reading shimmer)
  scale?: number;
}> = ({ typeP, sendP, scale = 1 }) => {
  const msg = "John Smith | 312-555-1234 | water damage, quote by Friday";
  const shown = msg.slice(0, Math.floor(msg.length * typeP));
  return (
    <div
      style={{
        width: 460,
        height: 720,
        borderRadius: 54,
        background: "#0E1621",
        border: "8px solid #1b2a3a",
        boxShadow: "0 40px 120px rgba(0,0,0,0.7)",
        transform: `scale(${scale})`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* TG header */}
      <div
        style={{
          height: 92,
          background: "#17212B",
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: RO.copper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SANS,
            fontWeight: 800,
            color: "#fff",
            fontSize: 20,
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
              fontSize: 22,
            }}
          >
            Leads Intake
          </div>
          <div style={{ fontFamily: SANS, color: "#5b6b7b", fontSize: 16 }}>
            bot • online
          </div>
        </div>
      </div>
      {/* message bubble */}
      <div style={{ padding: 24 }}>
        <div
          style={{
            marginLeft: "auto",
            maxWidth: "82%",
            background: "#2B5278",
            color: "#fff",
            borderRadius: "18px 18px 4px 18px",
            padding: "16px 18px",
            fontFamily: SANS,
            fontSize: 22,
            lineHeight: 1.4,
            opacity: typeP > 0 ? 1 : 0,
            transform: sendP > 0 ? `translateY(${-sendP * 8}px)` : "none",
          }}
        >
          {shown}
          {typeP > 0 && typeP < 1 && <span style={{ opacity: 0.7 }}>▋</span>}
        </div>
        {/* bot reading shimmer */}
        {sendP > 0 && (
          <div
            style={{
              marginTop: 18,
              maxWidth: "70%",
              background: "#1f2c39",
              borderRadius: "18px 18px 18px 4px",
              padding: "14px 18px",
              fontFamily: SANS,
              fontSize: 20,
              color: RO.copperHi,
              opacity: interpolate(sendP, [0.1, 0.4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            reading lead… ✨
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  Persistent overlays (watermark + phone chip from RO_HEAD on)
// ════════════════════════════════════════════════════════════════════════════

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
        backdropFilter: "blur(8px)",
        zIndex: 7500,
        letterSpacing: "0.01em",
      }}
    >
      {brand} · {phone}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  Scene layers
// ════════════════════════════════════════════════════════════════════════════

// Generic "world" wrapper applying a per-beat virtual camera (scale + translate)
const CameraRig: React.FC<{
  scale: number;
  x?: number;
  y?: number;
  rotate?: number;
  children: React.ReactNode;
}> = ({ scale, x = 0, y = 0, rotate = 0, children }) => (
  <AbsoluteFill
    style={{
      transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
      transformOrigin: "50% 45%",
      willChange: "transform",
    }}
  >
    {children}
  </AbsoluteFill>
);

// Stolen Mule full deck (reused, with progressive reveal flags)
const StolenMuleDeck: React.FC<{
  frame: number;
  fps: number;
  b: Record<string, BeatInfo>;
}> = ({ frame, fps, b }) => {
  const kpiA = (i: number) =>
    interpolate(
      frame,
      [b.SM_KPI.sF + i * 4, b.SM_KPI.sF + i * 4 + 14],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
    );
  const collected = countUp(frame, b.SM_KPI.sF + 6, b.SM_KPI.durF, 284900);
  const unbilled = countUp(frame, b.SM_KPI.sF, b.SM_KPI.durF, 48200);
  const unpaid = countUp(frame, b.SM_KPI.sF + 2, b.SM_KPI.durF, 112750);
  const overdue = countUp(frame, b.SM_KPI.sF + 4, b.SM_KPI.durF, 19400);

  const chartDraw = interpolate(
    frame,
    [b.SM_MONEY.sF, b.SM_MONEY.sF + b.SM_MONEY.durF * 0.7],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
  );
  const scrub = interpolate(
    frame,
    [b.SM_MONEY.sF + b.SM_MONEY.durF * 0.5, b.SM_STUCK.sF],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const agingA = interpolate(
    frame,
    [b.SM_STUCK.sF, b.SM_STUCK.sF + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
  );
  const gaugeP = countUp(frame, b.SM_STUCK.sF + 6, 26, 0.72);

  return (
    <AbsoluteFill style={{ background: SM.canvas }}>
      <DotGrid color="#6366F1" opacity={0.5} frame={frame} />
      <HorizonBloom color="rgba(99,102,241,0.5)" />
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 44,
            fontWeight: 800,
            color: SM.text,
            letterSpacing: "-0.02em",
          }}
        >
          Command Deck
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: SANS,
            fontSize: 22,
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
              display: "inline-block",
            }}
          />
          Live
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          position: "absolute",
          top: 210,
          left: 60,
          right: 60,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
        }}
      >
        <KpiTile label="Unbilled" value={fmtMoney(unbilled)} appear={kpiA(0)} />
        <KpiTile label="Unpaid" value={fmtMoney(unpaid)} appear={kpiA(1)} />
        <KpiTile
          label="Overdue"
          value={fmtMoney(overdue)}
          accent={SM.danger}
          appear={kpiA(2)}
        />
        <KpiTile
          label="Collected this month"
          value={fmtMoney(collected)}
          accent={SM.indigoLite}
          hero
          delta="18% MoM"
          appear={kpiA(3)}
          glanceLabel="EVERY DOLLAR, ONE PLACE"
        />
      </div>

      {/* Revenue chart */}
      <div
        style={{
          position: "absolute",
          top: 640,
          left: 60,
          right: 60,
          background: SM.tile,
          border: `1px solid ${SM.tileBorder}`,
          borderRadius: 26,
          padding: 28,
          opacity:
            chartDraw > 0
              ? 1
              : interpolate(frame, [b.SM_KPI.sF + 30, b.SM_MONEY.sF], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: SM.sky,
            marginBottom: 16,
          }}
        >
          YOUR GROWTH, MONTH BY MONTH
        </div>
        <RevenueChart
          draw={Math.max(0.001, chartDraw)}
          scrub={scrub}
          area={SM.sky}
          line={SM.sky}
          glow={SM.indigo}
          width={900}
          height={300}
        />
      </div>

      {/* AR aging + gauge */}
      <div
        style={{
          position: "absolute",
          top: 1080,
          left: 60,
          right: 60,
          display: "flex",
          gap: 26,
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            background: SM.tile,
            border: `1px solid ${SM.tileBorder}`,
            borderRadius: 26,
            padding: 28,
            opacity: agingA,
          }}
        >
          <ARAging appear={agingA} label="MONEY OWED TO YOU" />
        </div>
        <div
          style={{
            background: SM.tile,
            border: `1px solid ${SM.tileBorder}`,
            borderRadius: 26,
            padding: "20px 28px",
            opacity: agingA,
          }}
        >
          <RadialGauge p={gaugeP} accent={SM.indigo} label="Closings" />
        </div>
      </div>

      {/* lower quick-view cards */}
      <div
        style={{
          position: "absolute",
          top: 1320,
          left: 60,
          right: 60,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
          opacity: agingA * 0.9,
        }}
      >
        {["Overdue Invoices (5)", "Alerts (3)"].map((t, i) => (
          <div
            key={i}
            style={{
              background: SM.tile,
              border: `1px solid ${SM.tileBorder}`,
              borderRadius: 22,
              padding: 24,
              fontFamily: SANS,
              color: SM.textSoft,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {t}
            {[0, 1, 2].map((k) => (
              <div
                key={k}
                style={{
                  height: 14,
                  marginTop: 12,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.06)",
                  width: `${90 - k * 18}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* trust lower-third during SM_STUCK */}
      {b.SM_STUCK.active && (
        <div
          style={{
            position: "absolute",
            top: 1560,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 700,
            color: SM.indigoLite,
            opacity: interpolate(
              b.SM_STUCK.localF,
              [10, 20, b.SM_STUCK.durF - 10, b.SM_STUCK.durF],
              [0, 1, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          Real software. Live for a Chicago law firm.
        </div>
      )}
    </AbsoluteFill>
  );
};

// Restoration One full deck
const RestorationDeck: React.FC<{
  frame: number;
  fps: number;
  b: Record<string, BeatInfo>;
}> = ({ frame, fps, b }) => {
  const revenue = countUp(frame, b.RO_HEAD.sF, b.RO_HEAD.durF * 0.85, 612480);
  const headGlow = interpolate(
    frame,
    [b.RO_HEAD.sF, b.RO_HEAD.sF + 10],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const kpiA = (i: number) =>
    interpolate(
      frame,
      [b.RO_HEAD.sF + 18 + i * 5, b.RO_HEAD.sF + 18 + i * 5 + 14],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
    );
  const chartDraw = interpolate(
    frame,
    [b.RO_CHARTS.sF, b.RO_CHARTS.sF + b.RO_CHARTS.durF * 0.55],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
  );
  const funnelA = interpolate(
    frame,
    [b.RO_CHARTS.sF + b.RO_CHARTS.durF * 0.35, b.RO_CHARTS.eF],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // live revenue jump on DEMO_WON
  const jump = interpolate(
    frame,
    [b.DEMO_WON.sF + 8, b.DEMO_WON.sF + 16],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    },
  );
  const liveRevenue = 621880 * jump + 612480 * (1 - jump);
  const showJump = frame >= b.DEMO_WON.sF;

  return (
    <AbsoluteFill style={{ background: RO.canvas }}>
      <DotGrid color="#F0742A" opacity={0.4} frame={frame} />
      <HorizonBloom color="rgba(240,116,42,0.42)" />
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: RO.textSoft,
            textTransform: "uppercase",
          }}
        >
          Revenue Sold · June 2026
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: RO.copperHi,
            marginTop: 6,
            textShadow: `0 0 ${40 + headGlow * 40}px ${RO.copper}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtMoney(showJump ? liveRevenue : revenue)}
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            marginTop: 14,
          }}
        >
          {["▲ 22% MoM", "▲ 41% YoY"].map((d, i) => (
            <span
              key={i}
              style={{
                fontFamily: SANS,
                fontSize: 26,
                fontWeight: 800,
                color: "#04150E",
                background: RO.emerald,
                borderRadius: 999,
                padding: "6px 18px",
                opacity: headGlow,
                boxShadow:
                  jump > 0 && i === 0 ? `0 0 24px ${RO.emerald}` : "none",
              }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div
        style={{
          position: "absolute",
          top: 480,
          left: 50,
          right: 50,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
        }}
      >
        {[
          { l: "Jobs", v: "38", s: "🟢 24 won" },
          { l: "Close Rate", v: "31%", s: "20–40% band" },
          { l: "Avg Job", v: "$16.1k", s: "▲" },
          {
            l: "Leads In",
            v: showJump ? "53" : "52",
            s: jump > 0 ? "+1 live" : "",
          },
        ].map((k, i) => (
          <div
            key={i}
            style={{
              background: RO.card,
              border: `1px solid ${RO.border}`,
              borderRadius: 18,
              padding: "18px 16px",
              opacity: kpiA(i),
              transform: `translateY(${(1 - kpiA(i)) * 30}px)`,
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
                fontSize: 46,
                fontWeight: 800,
                color: RO.text,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {k.v}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 16, color: RO.copperHi }}>
              {k.s}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue area chart */}
      <div
        style={{
          position: "absolute",
          top: 700,
          left: 50,
          right: 50,
          background: RO.card,
          border: `1px solid ${RO.border}`,
          borderRadius: 24,
          padding: 26,
          opacity: chartDraw > 0.001 ? 1 : 0,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: RO.copperHi,
            marginBottom: 14,
          }}
        >
          13-MONTH REVENUE
        </div>
        <RevenueChart
          draw={Math.max(0.001, chartDraw)}
          scrub={0}
          area={RO.copper}
          line={RO.copper}
          glow={RO.copper}
          width={920}
          height={240}
          data={[28, 31, 30, 38, 44, 41, 52, 49, 58, 66, 72, 80, 92]}
        />
      </div>

      {/* Funnel */}
      <div
        style={{
          position: "absolute",
          top: 1070,
          left: 50,
          right: 50,
          background: RO.card,
          border: `1px solid ${RO.border}`,
          borderRadius: 24,
          padding: 26,
          opacity: funnelA,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: RO.amber,
            marginBottom: 18,
          }}
        >
          WHERE LEADS GO COLD
        </div>
        <Funnel appear={funnelA} />
      </div>

      {/* Kanban (revealed during demo beats) */}
      {(b.DEMO_TEXT.visible || b.DEMO_WON.visible) && (
        <div
          style={{
            position: "absolute",
            top: 1080,
            left: 40,
            right: 40,
            opacity: interpolate(
              frame,
              [b.DEMO_TEXT.sF + 30, b.DEMO_TEXT.sF + 45],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          <KanbanBoard
            cardAppear={interpolate(
              frame,
              [
                b.DEMO_TEXT.sF + b.DEMO_TEXT.durF * 0.62,
                b.DEMO_TEXT.sF + b.DEMO_TEXT.durF * 0.78,
              ],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: ease,
              },
            )}
            dragP={interpolate(
              frame,
              [b.DEMO_WON.sF + 4, b.DEMO_WON.sF + 14],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: ease,
              },
            )}
            wonFlash={interpolate(
              frame,
              [b.DEMO_WON.sF + 13, b.DEMO_WON.sF + 18, b.DEMO_WON.sF + 30],
              [0, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  MAIN COMPOSITION
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

  // ── Camera per beat (push-ins, holds) ─────────────────────────────────────
  const smCam =
    1.0 +
    interpolate(frame, [b.SM_KPI.sF, b.SM_STUCK.eF], [0.06, -0.04], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const roCam =
    1.0 +
    interpolate(frame, [b.RO_HEAD.sF, b.RO_CHARTS.eF], [0.07, -0.03], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const showChip = frame >= b.RO_HEAD.sF && frame < b.CLOSE.sF;

  // active caption
  const activeKey = bts.find(
    (x) =>
      frame >= Math.round(x.start * fps) &&
      frame < Math.round((x.start + x.dur) * fps),
  )?.key;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* ───────── 1. HOOK — flash-forward miracle ───────── */}
      {b.HOOK.visible && <HookScene frame={frame} fps={fps} bi={b.HOOK} />}

      {/* ───────── 2. CHAOS — your Tuesday ───────── */}
      {b.CHAOS.visible && <ChaosScene frame={frame} fps={fps} bi={b.CHAOS} />}

      {/* ───────── 3. SNAP — lights on (transition) ───────── */}
      {b.SNAP.visible && <SnapScene frame={frame} fps={fps} bi={b.SNAP} />}

      {/* ───────── 4–6. STOLEN MULE deck ───────── */}
      {(b.SM_KPI.visible || b.SM_MONEY.visible || b.SM_STUCK.visible) && (
        <CameraRig scale={smCam}>
          <StolenMuleDeck frame={frame} fps={fps} b={b} />
        </CameraRig>
      )}

      {/* ───────── 7. PIVOT — split snap ───────── */}
      {b.PIVOT.visible && <PivotScene frame={frame} fps={fps} bi={b.PIVOT} />}

      {/* ───────── 8–11. RESTORATION ONE deck + demo ───────── */}
      {(b.RO_HEAD.visible ||
        b.RO_CHARTS.visible ||
        b.DEMO_TEXT.visible ||
        b.DEMO_WON.visible) && (
        <CameraRig scale={roCam}>
          <RestorationDeck frame={frame} fps={fps} b={b} />
        </CameraRig>
      )}
      {/* phone mockup overlay for the text demo */}
      {b.DEMO_TEXT.visible && (
        <PhoneOverlay frame={frame} fps={fps} bi={b.DEMO_TEXT} />
      )}

      {/* ───────── 12. PROOF — two worlds ───────── */}
      {b.PROOF.visible && <ProofScene frame={frame} fps={fps} bi={b.PROOF} />}

      {/* ───────── 13. HUMAN — founder ───────── */}
      {b.HUMAN.visible && (
        <FounderScene
          frame={frame}
          fps={fps}
          bi={b.HUMAN}
          photoUrl={founderPhotoUrl}
          brand={brand}
        />
      )}

      {/* ───────── 14. TURN — your business ───────── */}
      {b.TURN.visible && <TurnScene frame={frame} fps={fps} bi={b.TURN} />}

      {/* ───────── 15–16. CLOSE + CTA ───────── */}
      {(b.CLOSE.visible || b.CTA.visible) && (
        <CloseScene
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

      {/* persistent corner chip */}
      <PersistentChip show={showChip} phone={phone} brand={brand} />

      {/* watermark (subtle, always) */}
      {frame < b.CLOSE.sF && (
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 56,
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

      {/* captions */}
      {activeKey && CAPTIONS[activeKey] && (
        <Caption
          text={CAPTIONS[activeKey]}
          localF={b[activeKey].localF}
          durF={b[activeKey].durF}
          fps={fps}
          big={activeKey === "HOOK" || activeKey === "TURN"}
          accent={
            ["RO_HEAD", "RO_CHARTS", "DEMO_TEXT", "DEMO_WON"].includes(
              activeKey,
            )
              ? RO.copper
              : SM.indigo
          }
        />
      )}

      {/* global grade */}
      <Vignette />
      {!lite && <Grain />}
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  Individual transition / bookend scenes
// ════════════════════════════════════════════════════════════════════════════

const HookScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  // Fast, punchy: text mostly typed from frame 0, snaps to the bright card
  // early, card holds bright + glowing for the back half (the payoff).
  const typeP = interpolate(bi.localF, [0, bi.durF * 0.22], [0.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const snapP = interpolate(
    bi.localF,
    [bi.durF * 0.26, bi.durF * 0.46],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    },
  );
  const cardIn = interpolate(snapP, [0.45, 0.75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outBlur = interpolate(bi.localF, [bi.durF - 3, bi.durF], [0, 16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowPulse = 0.7 + Math.sin(bi.localF / 5) * 0.3;
  return (
    <AbsoluteFill
      style={{ background: RO.canvas, filter: `blur(${outBlur}px)` }}
    >
      <DotGrid color="#F0742A" opacity={0.45} frame={frame} />
      {/* strong central glow so frame 1 is never a void */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, rgba(240,116,42,${0.32 * glowPulse}) 0%, transparent 52%)`,
        }}
      />
      <HorizonBloom color="rgba(240,116,42,0.5)" />
      {/* messy text → clean card, centered */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginTop: -60,
        }}
      >
        {snapP < 0.5 ? (
          <div
            style={{
              maxWidth: 800,
              background: "#2B5278",
              color: "#fff",
              borderRadius: 26,
              padding: "30px 34px",
              fontFamily: SANS,
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1.32,
              transform: `scale(${1 - snapP * 0.2})`,
              opacity: 1 - snapP * 1.4,
              boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
            }}
          >
            {"John Smith | 312-555-1234 | water damage, quote by Friday".slice(
              0,
              Math.floor(58 * typeP),
            )}
            {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
          </div>
        ) : (
          <div
            style={{
              width: 640,
              background: "#1b2128",
              border: `3px solid ${RO.copper}`,
              borderRadius: 26,
              padding: 36,
              opacity: cardIn,
              transform: `scale(${0.86 + cardIn * 0.14})`,
              boxShadow: `0 0 ${70 * glowPulse}px ${RO.copper}, 0 30px 80px rgba(0,0,0,0.6)`,
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 50,
                color: "#fff",
              }}
            >
              John Smith
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 30,
                color: RO.textSoft,
                marginTop: 8,
              }}
            >
              (312) 555-1234
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 20,
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
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ChaosScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const drift = Math.sin((bi.localF / fps) * 1.4) * 8;
  const lostCounter = Math.max(0, 9 - Math.floor(bi.localF / 8));
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #1a140e 0%, #0a0806 100%)",
      }}
    >
      {/* desk macro vibe with DOF: faux blurred clutter */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "blur(2px)",
          opacity: 0.5,
          background:
            "radial-gradient(circle at 30% 70%, rgba(120,90,50,0.25), transparent 40%), radial-gradient(circle at 75% 30%, rgba(90,70,40,0.2), transparent 40%)",
        }}
      />
      {/* sticky note */}
      <div
        style={{
          position: "absolute",
          top: 560 + drift,
          left: 180,
          width: 300,
          height: 300,
          background: "#E9D84F",
          transform: "rotate(-7deg)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
          fontFamily: "'Comic Sans MS', cursive",
          fontSize: 44,
          fontWeight: 700,
          color: "#3a3208",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
        }}
      >
        CALL BACK!!
      </div>
      {/* phone */}
      <div
        style={{
          position: "absolute",
          top: 900 - drift,
          right: 150,
          width: 360,
          height: 720,
          borderRadius: 48,
          background: "#0c0c0e",
          border: "8px solid #222",
          transform: "rotate(6deg)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
          padding: 30,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 30, color: "#888" }}>
          Missed Call
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 120,
            fontWeight: 800,
            color: "#F43F5E",
          }}
        >
          (7)
        </div>
        <div
          style={{
            background: "#F43F5E",
            color: "#fff",
            borderRadius: 999,
            padding: "6px 18px",
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          23 unread
        </div>
      </div>
      {/* bleeding money number */}
      <div
        style={{
          position: "absolute",
          top: 360,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 56,
          fontWeight: 700,
          color: "#F43F5E",
          opacity: 0.8,
        }}
      >
        leads lost this week: {lostCounter}
      </div>
    </AbsoluteFill>
  );
};

const SnapScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const p = bi.p;
  const flash = interpolate(bi.localF, [0, 3, 10], [0.9, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gridIn = interpolate(p, [0.1, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: SM.canvas }}>
      <DotGrid color="#6366F1" opacity={gridIn * 0.6} frame={frame} />
      <HorizonBloom color="rgba(99,102,241,0.6)" intensity={gridIn} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

const PivotScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const split = interpolate(bi.localF, [0, bi.durF * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const seam = interpolate(bi.localF, [bi.durF * 0.4, bi.durF * 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* left indigo */}
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
        <Label text="LAW FIRM" color={SM.indigoLite} />
      </div>
      {/* right copper */}
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
        <Label text="RESTORATION CO." color={RO.copperHi} />
      </div>
      {/* seam flash */}
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

const Label: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div
    style={{
      position: "absolute",
      top: "44%",
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: SANS,
      fontSize: 40,
      fontWeight: 800,
      letterSpacing: "0.1em",
      color,
      textShadow: `0 0 22px ${color}`,
    }}
  >
    {text}
  </div>
);

const PhoneOverlay: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const typeP = interpolate(bi.localF, [4, bi.durF * 0.42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sendP = interpolate(
    bi.localF,
    [bi.durF * 0.45, bi.durF * 0.62],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  // phone shrinks to corner as the card materializes on the board
  const dock = interpolate(bi.localF, [bi.durF * 0.6, bi.durF * 0.78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const scale = 1 - dock * 0.55;
  const x = dock * 320;
  const y = dock * 480;
  const op = interpolate(
    bi.localF,
    [0, 6, bi.durF - 4, bi.durF],
    [0, 1, 1, 0.4],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        zIndex: 6000,
        opacity: op,
      }}
    >
      <div style={{ transform: `translate(${x}px, ${y}px)` }}>
        <PhoneMockup typeP={typeP} sendP={sendP} scale={scale} />
      </div>
    </AbsoluteFill>
  );
};

const ProofScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const inP = interpolate(bi.localF, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const rot = interpolate(bi.localF, [0, bi.durF], [-6, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "#05060A",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.25} frame={frame} />
      <div
        style={{
          display: "flex",
          gap: 40,
          transform: `perspective(1400px) rotateY(${rot}deg) scale(${0.8 + inP * 0.2})`,
          opacity: inP,
        }}
      >
        {/* mini indigo deck */}
        <MiniDeck
          color={SM.indigo}
          bg={SM.canvas}
          label="LAW FIRM"
          frame={frame}
        />
        {/* mini copper deck */}
        <MiniDeck
          color={RO.copper}
          bg={RO.canvas}
          label="RESTORATION"
          frame={frame}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 470,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 34,
          fontWeight: 700,
          color: "#fff",
          opacity: inP,
        }}
      >
        Two industries. One developer. Built from scratch — by me.
      </div>
    </AbsoluteFill>
  );
};

const MiniDeck: React.FC<{
  color: string;
  bg: string;
  label: string;
  frame: number;
}> = ({ color, bg, label, frame }) => {
  const pulse = 0.9 + Math.sin(frame / 8) * 0.1;
  return (
    <div
      style={{
        width: 380,
        height: 760,
        background: bg,
        borderRadius: 28,
        border: `1px solid ${color}66`,
        boxShadow: `0 0 60px ${color}55`,
        padding: 26,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <HorizonBloom color={`${color}55`} />
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, color }}>
        {label}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            marginTop: 18,
            height: 90,
            borderRadius: 16,
            background: `${color}1a`,
            border: `1px solid ${color}33`,
            opacity: pulse,
          }}
        />
      ))}
      <div
        style={{
          marginTop: 18,
          height: 200,
          borderRadius: 16,
          background: `linear-gradient(180deg, ${color}33, transparent)`,
        }}
      />
    </div>
  );
};

const FounderScene: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
  photoUrl: string;
  brand: string;
}> = ({ frame, fps, bi, photoUrl, brand }) => {
  const inP = interpolate(bi.localF, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const push = 1 + inP * 0.04;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #11131c 0%, #05060a 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.18} frame={frame} />
      <div
        style={{
          transform: `scale(${push})`,
          textAlign: "center",
          opacity: inP,
        }}
      >
        {/* photo slot or monogram */}
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            margin: "0 auto",
            overflow: "hidden",
            border: `3px solid ${SM.indigo}`,
            boxShadow: `0 0 60px ${SM.indigo}88`,
            background: "linear-gradient(160deg, #6366F1, #F0742A)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photoUrl ? (
            <Img
              src={photoUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 130,
                color: "#fff",
              }}
            >
              B
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: SANS,
            fontSize: 44,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          Brady · {brand}
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 600,
            color: SM.indigoLite,
          }}
        >
          I build these myself.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TurnScene: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const glow = 0.6 + Math.sin(bi.localF / 6) * 0.4;
  const cursor = Math.floor(frame / 12) % 2 === 0;
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
          width: 620,
          height: 360,
          borderRadius: 24,
          border: "2px dashed rgba(255,255,255,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${60 * glow}px rgba(99,102,241,${0.4 * glow})`,
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          YOUR BUSINESS{cursor ? " ▋" : ""}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const CloseScene: React.FC<{
  frame: number;
  fps: number;
  b: Record<string, BeatInfo>;
  brand: string;
  phone: string;
  email: string;
  offer: string;
  logoUrl: string;
}> = ({ frame, fps, b, brand, phone, email, offer, logoUrl }) => {
  const logoSpring = spring({
    frame: frame - b.CLOSE.sF,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });
  const sweep = interpolate(frame, [b.CLOSE.sF + 6, b.CLOSE.sF + 24], [-1, 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const offerIn = interpolate(
    frame,
    [b.CLOSE.sF + 16, b.CLOSE.sF + 30],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    },
  );
  const ctaIn = interpolate(frame, [b.CTA.sF, b.CTA.sF + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const phonePulse = b.CTA.active
    ? 1 + Math.sin((frame - b.CTA.sF) / 5) * 0.04
    : 1;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #0c0f1a 0%, #050608 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color="#6366F1" opacity={0.25} frame={frame} />
      <div style={{ textAlign: "center", marginTop: -120 }}>
        {/* wordmark / logo */}
        <div
          style={{
            transform: `scale(${0.6 + logoSpring * 0.4})`,
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
                fontSize: 96,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#fff",
                position: "relative",
              }}
            >
              Simply Scaled
              {/* light sweep */}
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
          {/* fusion gradient underline */}
          <div
            style={{
              height: 8,
              borderRadius: 4,
              marginTop: 14,
              background: "linear-gradient(90deg, #6366F1, #F0742A)",
              opacity: logoSpring,
            }}
          />
        </div>

        {/* offer line */}
        <div
          style={{
            marginTop: 50,
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            opacity: offerIn,
            maxWidth: 880,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.3,
          }}
        >
          {offer}
        </div>

        {/* phone (the focal CTA) */}
        <div
          style={{
            marginTop: 48,
            opacity: Math.max(offerIn, ctaIn),
            transform: `scale(${phonePulse})`,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: "-0.01em",
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
              marginTop: 8,
            }}
          >
            Call or text
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 30,
              color: "rgba(255,255,255,0.7)",
              marginTop: 18,
            }}
          >
            {email}
          </div>
          {b.CTA.active && (
            <div
              style={{
                marginTop: 22,
                fontFamily: SANS,
                fontSize: 26,
                fontWeight: 600,
                color: RO.copperHi,
                opacity: ctaIn,
              }}
            >
              I only take a few builds a month.
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
