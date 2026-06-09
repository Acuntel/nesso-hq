import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import manifest from "./beats.json";
import { SANS, W, H } from "./theme";

export type ReelBeat = { key: string; start: number; dur: number };

// Beat keys come from the shared manifest (beats.json) — the same file the
// Python pipeline reads for VO + SFX timing. One source of truth.
export type BeatKey = (typeof manifest.beats)[number]["key"];
export const BEAT_KEYS: BeatKey[] = manifest.beats.map((b) => b.key);

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.inOut(Easing.cubic);

export type BeatInfo = {
  active: boolean;
  visible: boolean;
  sF: number;
  eF: number;
  durF: number;
  localF: number;
  p: number;
};

export function useBeats(beats: ReelBeat[], fps: number, frame: number) {
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

export const ipl = (
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

export function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// ─── consistent stroke-icon set (replaces system emoji everywhere) ──────────
const PATHS: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M5 21h14" />
      <path d="M12 6 5 8l3 6a3.5 3.5 0 0 1-6 0l3-6" />
      <path d="M12 6l7 2-3 6a3.5 3.5 0 0 0 6 0l-3-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 5a3.5 3.5 0 0 1 0 7M18.5 14.5c2 .9 3 2.7 3 5.5" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  check: <path d="M4.5 12.5 10 18 19.5 6.5" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 2.5V7M16 2.5V7" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13l3-8h12l3 8v6H3z" />
      <path d="M3 13h5.5a3.5 3.5 0 0 0 7 0H21" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5M4.5 9.5V18M9 9.5V18M15 9.5V18M19.5 9.5V18M3 20.5h18" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2.5h8l4 4v15H6z" />
      <path d="M14 2.5V7h4M9 12h6M9 16h6" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 11 12 3.5 20.5 11" />
      <path d="M5.5 10v10.5h13V10" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: (
    <path d="M5 3.5h4l1.5 5L8 10a13 13 0 0 0 6 6l1.5-2.5 5 1.5v4a2 2 0 0 1-2 2C9.6 21 3 14.4 3 5.5a2 2 0 0 1 2-2z" />
  ),
  bot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 8V4.5M9.5 4.5h5" />
      <circle cx="9.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  droplet: (
    <path d="M12 3.5c3.6 4.4 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.4-6.1 6-10.5z" />
  ),
  spark: (
    <path d="M12 3l1.8 5.6L19.5 10l-5.7 1.4L12 17l-1.8-5.6L4.5 10l5.7-1.4z" />
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  hardhat: (
    <>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M3 16h18v3H3zM10 8.5V5h4v3.5" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3.5" width="14" height="17.5" rx="1" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 21v-4h3v4" />
    </>
  ),
};

export const Icon: React.FC<{
  name: keyof typeof PATHS | string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ name, size = 22, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {PATHS[name as string] ?? <circle cx="12" cy="12" r="8" />}
  </svg>
);

// ─── atmosphere / finishing ─────────────────────────────────────────────────
export const DotGrid: React.FC<{
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

export const Bloom: React.FC<{
  color: string;
  intensity?: number;
  at?: string;
}> = ({ color, intensity = 1, at = "50% 108%" }) => (
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

export const Grain: React.FC = () => (
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

export const Vignette: React.FC = () => (
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
export const LightSweep: React.FC<{ p: number }> = ({ p }) => (
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

// Slow 9:16 push-in toward the populated region of a desktop UI so the frame
// reads dense on a phone instead of letterboxed chrome over empty grid.
export const PushIn: React.FC<{
  p: number; // 0..1 beat progress
  from?: number;
  to?: number;
  origin?: string;
  children: React.ReactNode;
}> = ({ p, from = 1.12, to = 1.2, origin = "40% 30%", children }) => (
  <AbsoluteFill
    style={{
      transform: `scale(${from + (to - from) * p})`,
      transformOrigin: origin,
    }}
  >
    {children}
  </AbsoluteFill>
);

// animated cursor (tip-aligned via TipCursor)
export const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({
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

export const TipCursor: React.FC<{
  tx: number;
  ty: number;
  click?: number;
}> = ({ tx, ty, click = 0 }) => <Cursor x={tx - 4} y={ty - 2} click={click} />;

// ─── caption (sound-off script) ─────────────────────────────────────────────
// Scrim + heavy shadow so it survives bright scenes; bottom edge kept above
// the ~280px zone TikTok/Reels UI covers.
export const Caption: React.FC<{
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
        bottom: 320,
        textAlign: "center",
        opacity: op,
        transform: `translateY(${(1 - inP) * 30}px)`,
        zIndex: 7000,
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: big ? 64 : 50,
          lineHeight: 1.18,
          letterSpacing: "-0.02em",
          color: "#fff",
          background: "rgba(0,0,0,0.55)",
          borderRadius: 18,
          padding: "14px 28px",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          textShadow: `0 3px 18px rgba(0,0,0,0.95), 0 0 24px ${accent}55`,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// Smooth screen-to-screen transition: quick scale + crossfade so every cut
// reads as a motivated camera move. `last` keeps the CTA from fading out.
export const Trans: React.FC<{
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
