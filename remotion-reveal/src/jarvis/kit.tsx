import React from "react";
import { Easing, random, spring } from "remotion";
import { MONO, SANS } from "../simply/theme";
import { ease, ipl } from "../simply/helpers";

// ════════════════════════════════════════════════════════════════════════════
//  KIT — TypeOn, CountUp, Odometer, ScanPass, BracketTarget, GlassPanel,
//  MessageBubble. Deterministic, stroke-based, no blur/backdrop-filter.
// ════════════════════════════════════════════════════════════════════════════

const GLYPHS = "█▓▒#$%01";

// terminal type-on / decode text. Width reserved with an invisible twin.
export const TypeOn: React.FC<{
  text: string;
  localF: number;
  startF: number;
  mode?: "type" | "decode";
  cps?: number; // chars per frame (type mode ~0.83)
  style?: React.CSSProperties;
  cursor?: boolean;
}> = ({
  text,
  localF,
  startF,
  mode = "type",
  cps = 0.83,
  style,
  cursor = true,
}) => {
  const f = localF - startF;
  if (f < 0)
    return <span style={{ ...style, visibility: "hidden" }}>{text}</span>;
  const shown = Math.min(text.length, Math.floor(f * cps));
  const done = shown >= text.length;
  let visible: React.ReactNode;
  if (mode === "decode") {
    visible = text.split("").map((ch, i) => {
      const lockAt = i * 0.8 + 6;
      if (f >= lockAt) return ch;
      const gi = Math.floor(
        random(`g-${i}-${Math.floor(f / 2)}`) * GLYPHS.length,
      );
      return ch === " " ? " " : GLYPHS[gi];
    });
  } else {
    visible = text.slice(0, shown);
  }
  return (
    <span style={{ position: "relative", whiteSpace: "nowrap", ...style }}>
      <span style={{ visibility: "hidden" }}>{text}</span>
      <span
        style={{ position: "absolute", left: 0, top: 0, whiteSpace: "pre" }}
      >
        {visible}
        {cursor && !done && (
          <span style={{ opacity: Math.floor(f / 2) % 2 === 0 ? 1 : 0 }}>
            ▋
          </span>
        )}
      </span>
    </span>
  );
};

export const countUp = (p: number, target: number) =>
  Math.round(target * Easing.out(Easing.exp)(Math.max(0, Math.min(1, p))));

// hero money number: per-digit glyph columns on springs, right-to-left stagger
export const Odometer: React.FC<{
  value: string; // e.g. "$612,480"
  localF: number;
  startF: number;
  fps: number;
  fontSize: number;
  color: string;
  glow?: string;
}> = ({ value, localF, startF, fps, fontSize, color, glow }) => {
  const lineH = fontSize * 1.04;
  const digits = value.split("");
  const nDigits = digits.filter((c) => /\d/.test(c)).length;
  let digitIdx = -1;
  return (
    <div
      style={{
        display: "flex",
        fontFamily: SANS,
        fontWeight: 800,
        fontSize,
        letterSpacing: "-0.04em",
        color,
        fontVariantNumeric: "tabular-nums",
        textShadow: glow ? `0 0 ${fontSize * 0.4}px ${glow}` : undefined,
        lineHeight: 1,
      }}
    >
      {digits.map((ch, i) => {
        if (!/\d/.test(ch)) {
          return <span key={i}>{ch}</span>;
        }
        digitIdx += 1;
        const target = parseInt(ch, 10);
        const stagger = (nDigits - 1 - digitIdx) * 3; // right-to-left
        const s = spring({
          frame: Math.max(0, localF - startF - stagger),
          fps,
          config: { damping: 14, stiffness: 120 },
        });
        const y = -(target * s) * lineH;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              height: lineH,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                flexDirection: "column",
                transform: `translateY(${y}px)`,
              }}
            >
              {Array.from({ length: 10 }).map((_, dgt) => (
                <span key={dgt} style={{ height: lineH }}>
                  {dgt}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
};

// scanning beam that "reads" a panel top→bottom, tint trailing behind
export const ScanPass: React.FC<{
  p: number; // 0..1 sweep progress
  accent: string;
  tint?: string;
}> = ({ p, accent, tint }) => (
  <>
    {tint && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tint,
          clipPath: `inset(0 0 ${Math.max(0, 100 - p * 100)}% 0)`,
          pointerEvents: "none",
        }}
      />
    )}
    {p > 0 && p < 1 && (
      <div
        style={{
          position: "absolute",
          left: "5%",
          right: "5%",
          top: `${p * 100}%`,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 22px ${accent}`,
          pointerEvents: "none",
        }}
      />
    )}
  </>
);

// fighter-jet lock-on reticle: converges 1.6x→1x with overshoot, then flashes
export const BracketTarget: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  localF: number;
  startF: number;
  accent: string;
  label?: string;
  labelColor?: string;
  pulse?: boolean; // slow lock pulse after convergence (CTA)
  frame?: number;
}> = ({
  x,
  y,
  w,
  h,
  localF,
  startF,
  accent,
  label,
  labelColor,
  pulse,
  frame = 0,
}) => {
  const f = localF - startF;
  if (f < 0) return null;
  const conv = ipl(f, 0, 8, 0, 1, Easing.out(Easing.back(1.7)));
  const flash = ipl(f, 8, 10, 0.9, 0.3);
  const pl = pulse ? 1 + 0.04 * Math.sin((frame / 40) * Math.PI * 2) : 1;
  const s = (1.6 - 0.6 * conv) * pl;
  const rot = 45 * (1 - conv);
  const leg = 18;
  const sw = 2.5;
  return (
    <div
      style={{
        position: "absolute",
        left: x + w / 2,
        top: y + h / 2,
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: (-w / 2) * s,
          top: (-h / 2) * s,
          width: w * s,
          height: h * s,
          transform: `rotate(${rot}deg)`,
          opacity: Math.max(0.55, flash),
        }}
      >
        {[
          { left: -2, top: -2, r: 0 },
          { right: -2, top: -2, r: 90 },
          { right: -2, bottom: -2, r: 180 },
          { left: -2, bottom: -2, r: 270 },
        ].map((c, k) => (
          <svg
            key={k}
            width={leg + 4}
            height={leg + 4}
            viewBox={`0 0 ${leg + 4} ${leg + 4}`}
            style={
              {
                position: "absolute",
                left: (c as any).left,
                right: (c as any).right,
                top: (c as any).top,
                bottom: (c as any).bottom,
                transform: `rotate(${c.r}deg)`,
              } as any
            }
          >
            <path
              d={`M${sw} ${leg} L${sw} ${sw} L${leg} ${sw}`}
              fill="none"
              stroke={accent}
              strokeWidth={sw}
            />
          </svg>
        ))}
      </div>
      {label && (
        <div
          style={{
            position: "absolute",
            left: w / 2 + 18,
            top: -16,
            transform: `translateX(${(1 - conv) * 8}px)`,
            opacity: conv,
            fontFamily: MONO,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: labelColor ?? accent,
            background: "rgba(7,11,20,0.85)",
            border: `1px solid ${labelColor ?? accent}66`,
            borderRadius: 8,
            padding: "6px 12px",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// glass surface with materialize entrance — never backdrop-filter
export const GlassPanel: React.FC<{
  localF?: number;
  startF?: number;
  accent?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ localF = 99, startF = 0, accent = "#39D6FF", style, children }) => {
  const f = localF - startF;
  const inP = ipl(f, 0, 7, 0, 1, ease);
  if (f < 0) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.045)",
        border: `1px solid ${accent}33`,
        borderRadius: 20,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        opacity: inP,
        transform: `scaleY(${0.6 + inP * 0.4})`,
        transformOrigin: "center",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// the hook's inbound SMS bubble
export const MessageBubble: React.FC<{
  children: React.ReactNode;
  accent: string;
  style?: React.CSSProperties;
}> = ({ children, accent, style }) => (
  <div
    style={{
      background: "#2B5278",
      color: "#fff",
      borderRadius: "26px 26px 26px 6px",
      padding: "26px 30px",
      fontFamily: SANS,
      fontSize: 38,
      lineHeight: 1.4,
      position: "relative",
      boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px ${accent}22`,
      ...style,
    }}
  >
    {children}
  </div>
);

// stamp that slams in (WON, NO PITCH)
export const Stamp: React.FC<{
  localF: number;
  startF: number;
  fps: number;
  color: string;
  rotate?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ localF, startF, fps, color, rotate = 0, style, children }) => {
  const f = localF - startF;
  if (f < 0) return null;
  const s = spring({ frame: f, fps, config: { damping: 11, stiffness: 180 } });
  const shake = f < 4 ? Math.sin(f * 9) * (4 - f) : 0;
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: SANS,
        fontWeight: 900,
        color,
        border: `4px solid ${color}`,
        borderRadius: 14,
        padding: "10px 26px",
        transform: `scale(${1.6 - 0.6 * s}) rotate(${rotate}deg) translateX(${shake}px)`,
        opacity: Math.min(1, f / 2),
        textShadow: `0 0 24px ${color}66`,
        boxShadow: `0 0 30px ${color}33`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// self-drawing SVG line w/ wide-stroke glow (no filter blur)
export const HoloLine: React.FC<{
  points: number[]; // normalized 0..100 values
  width: number;
  height: number;
  drawP: number;
  color: string;
  frame: number;
}> = ({ points, width, height, drawP, color, frame }) => {
  const n = points.length;
  const xs = (i: number) => (i / (n - 1)) * width;
  const ys = (v: number) => height - (v / 110) * height;
  const liveY = 3 * Math.sin(frame * 0.21) + 1.5 * Math.sin(frame * 0.83);
  const pts = points.map((v, i) => [xs(i), ys(v) + (i === n - 1 ? liveY : 0)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const len = width * 1.4;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={6}
        opacity={0.25}
        strokeDasharray={len}
        strokeDashoffset={len * (1 - drawP)}
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={len}
        strokeDashoffset={len * (1 - drawP)}
        strokeLinecap="round"
      />
    </svg>
  );
};
