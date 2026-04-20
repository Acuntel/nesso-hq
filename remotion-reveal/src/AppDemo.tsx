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
import { CaptionTrack, type CaptionLine } from "./CaptionTrack";

// ─────────────────────────────────────────────────────────────────────────────
// Nesso app-faithful click-through. 8 seconds, 8 beats.
// Colors match the real app (src/pages/Home.tsx + AnimatedConnectionBar.tsx):
//   bg       hsl(15 35% 90%)  → rgb(235, 218, 212)
//   card     hsl(15 32% 92%)  → rgb(240, 225, 220)
//   text     hsl(25 25% 28%)  → rgb(82, 67, 58)
//   primary  hsl(350 40% 52%) → rgb(178, 90, 100)
//   muted    hsl(15 22% 80%)  → rgb(212, 196, 189)
// ─────────────────────────────────────────────────────────────────────────────

export type AppDemoProps = {
  personName: string;
  monthsSinceText: number;
  aiMessage: string;
  logoUrl?: string;
  /**
   * Optional word-timed captions synced to the demo narration VO.
   * Relative to this segment's local 0. Rendered at the lower third.
   */
  captions?: CaptionLine[];
};

// Scene timing — sum to 8.0s. Edit here to re-time the whole composition.
// Beat-matched to the signature 80 BPM music (0.75s per beat, 0.375s per half-beat).
// Every boundary lands on a beat or half-beat for a "scored" feel.
const SCENES = {
  HOME: { start: 0.0, end: 1.5 }, // 2 beats — Inner Circle grid + bar drain
  TAP_CARD: { start: 1.5, end: 2.25 }, // 1 beat — finger taps Sarah (heavier weight)
  SLIDE: { start: 2.25, end: 3.0 }, // 1 beat — iOS push transition
  PERSON: { start: 3.0, end: 4.5 }, // 2 beats — person detail with CTA pulse
  TAP_REACH: { start: 4.5, end: 4.875 }, // 0.5 beat — quick tap reach out
  SHEET_UP: { start: 4.875, end: 5.25 }, // 0.5 beat — snappy sheet slide
  AI_TYPING: { start: 5.25, end: 6.75 }, // 2 beats — AI generates message
  SEND: { start: 6.75, end: 8.0 }, // 1.67 beats — tap send, bubble flies, flash
} as const;

const COLORS = {
  bg: "rgb(235, 218, 212)",
  bgGradient:
    "linear-gradient(180deg, rgb(240, 225, 220) 0%, rgb(228, 208, 201) 100%)",
  card: "rgb(245, 232, 227)",
  cardBorder: "rgba(82, 67, 58, 0.08)",
  text: "rgb(82, 67, 58)",
  textSoft: "rgba(82, 67, 58, 0.62)",
  textMuted: "rgba(82, 67, 58, 0.42)",
  primary: "rgb(178, 90, 100)",
  primaryDeep: "rgb(152, 72, 84)",
  barEmpty: "rgba(212, 196, 189, 0.6)",
  iosBlue: "#0A84FF",
  iosGreen: "#30D158",
  glassBorder: "rgba(82, 67, 58, 0.10)",
  sheetBg: "rgba(255, 250, 248, 0.96)",
} as const;

const SF_STACK =
  "'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', 'Arial', sans-serif";
const SERIF_STACK =
  "'Instrument Serif', 'Fraunces', 'Cormorant Garamond', 'Georgia', serif";

// Phone geometry — renders "inside" the iPhone frame for authenticity
const PHONE = {
  insetX: 0,
  insetY: 0,
  // We render at 1080x1920 — the VIEWPORT of the phone. No chrome frame around it
  // since TikTok fills the screen. The status bar + home indicator give the device feel.
  statusH: 64,
  homeIndicatorOffset: 28,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared visual primitives
// ─────────────────────────────────────────────────────────────────────────────

const StatusBar: React.FC<{ tint?: "dark" | "light" }> = ({
  tint = "dark",
}) => {
  const color = tint === "dark" ? COLORS.text : "white";
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: PHONE.statusH,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 48px 0",
        fontFamily: SF_STACK,
        fontWeight: 600,
        fontSize: 28,
        color,
        letterSpacing: "-0.01em",
        zIndex: 50,
      }}
    >
      <div>9:41</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6 + i * 2,
                borderRadius: 1.5,
                background: color,
              }}
            />
          ))}
        </div>
        <div
          style={{
            width: 42,
            height: 20,
            border: `2px solid ${color}`,
            borderRadius: 5,
            padding: 2,
          }}
        >
          <div
            style={{
              width: "86%",
              height: "100%",
              background: color,
              borderRadius: 1.5,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const HomeIndicator: React.FC<{ tint?: "dark" | "light" }> = ({
  tint = "dark",
}) => (
  <div
    style={{
      position: "absolute",
      bottom: PHONE.homeIndicatorOffset,
      left: "50%",
      transform: "translateX(-50%)",
      width: 280,
      height: 8,
      borderRadius: 4,
      background: tint === "dark" ? COLORS.text : "white",
      opacity: 0.5,
      zIndex: 50,
    }}
  />
);

const AmbientBlobs: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const blobs = [
    {
      size: 260,
      x: "8%",
      y: "14%",
      color: "rgba(232, 160, 168, 0.35)",
      dur: 22,
      delay: 0,
    },
    {
      size: 200,
      x: "72%",
      y: "32%",
      color: "rgba(180, 120, 130, 0.25)",
      dur: 18,
      delay: 3,
    },
    {
      size: 320,
      x: "12%",
      y: "58%",
      color: "rgba(255, 200, 210, 0.22)",
      dur: 25,
      delay: 7,
    },
    {
      size: 180,
      x: "66%",
      y: "72%",
      color: "rgba(200, 130, 150, 0.22)",
      dur: 20,
      delay: 5,
    },
  ];
  return (
    <>
      {blobs.map((b, i) => {
        const t = ((frame / fps - b.delay) / b.dur) % 1;
        const drift = Math.sin(t * Math.PI * 2) * 20;
        const scale = 0.95 + Math.sin(t * Math.PI * 2) * 0.1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: b.size,
              height: b.size,
              top: b.y,
              left: b.x,
              borderRadius: "50%",
              background: b.color,
              filter: "blur(60px)",
              transform: `translate(${drift}px, ${drift * 0.5}px) scale(${scale})`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

const FingerTap: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  durationFrames: number;
  cx: number;
  cy: number;
}> = ({ frame, fps, startFrame, durationFrames, cx, cy }) => {
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames + 6) return null;

  // Finger circle fades in then out
  const fingerOpacity = interpolate(
    local,
    [0, 3, durationFrames - 2, durationFrames],
    [0, 0.35, 0.35, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Haptic ring expands
  const ringStart = Math.round(durationFrames * 0.4);
  const ringProgress = interpolate(local, [ringStart, ringStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const ringSize = 60 + ringProgress * 180;
  const ringOpacity = interpolate(ringProgress, [0, 1], [0.6, 0]);

  return (
    <>
      {/* Finger dot */}
      <div
        style={{
          position: "absolute",
          top: cy - 36,
          left: cx - 36,
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(82, 67, 58, 0.85)",
          boxShadow: "0 0 0 6px rgba(82, 67, 58, 0.18)",
          opacity: fingerOpacity,
          zIndex: 100,
        }}
      />
      {/* Haptic ring */}
      <div
        style={{
          position: "absolute",
          top: cy - ringSize / 2,
          left: cx - ringSize / 2,
          width: ringSize,
          height: ringSize,
          borderRadius: "50%",
          border: "4px solid rgba(178, 90, 100, 0.8)",
          opacity: ringOpacity,
          zIndex: 99,
        }}
      />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Home Screen — Inner Circle grid with person cards
// ─────────────────────────────────────────────────────────────────────────────

type PersonCardData = {
  name: string;
  initials: string;
  level: number; // final level (we interpolate from start level)
  startLevel: number; // level at scene start
  avatarColor: string;
  relation: string;
  streak?: number;
};

const PEOPLE: PersonCardData[] = [
  {
    name: "Mom",
    initials: "MO",
    level: 88,
    startLevel: 88,
    avatarColor: "rgb(178, 90, 100)",
    relation: "Mom",
    streak: 24,
  },
  {
    name: "Jake",
    initials: "JA",
    level: 72,
    startLevel: 72,
    avatarColor: "rgb(120, 150, 200)",
    relation: "Close friend",
    streak: 11,
  },
  {
    name: "Sarah",
    initials: "SA",
    level: 10,
    startLevel: 60,
    avatarColor: "rgb(200, 130, 150)",
    relation: "Best friend",
  },
  {
    name: "Alex",
    initials: "AL",
    level: 46,
    startLevel: 46,
    avatarColor: "rgb(150, 180, 140)",
    relation: "College",
    streak: 4,
  },
  {
    name: "Emma",
    initials: "EM",
    level: 82,
    startLevel: 82,
    avatarColor: "rgb(220, 150, 110)",
    relation: "Close friend",
    streak: 18,
  },
  {
    name: "Marcus",
    initials: "MA",
    level: 34,
    startLevel: 34,
    avatarColor: "rgb(150, 130, 180)",
    relation: "Roommate",
  },
];

const SARAH_IDX = 2;

const ConnectionBar: React.FC<{
  level: number;
  animated?: boolean;
  frame?: number;
  fps?: number;
}> = ({ level }) => {
  const clamped = Math.max(0, Math.min(100, level));
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        borderRadius: 5,
        background: COLORS.barEmpty,
        overflow: "hidden",
        position: "relative",
        boxShadow: "inset 0 1px 2px rgba(82, 67, 58, 0.08)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${clamped}%`,
          background: `linear-gradient(180deg, rgb(200, 110, 120) 0%, ${COLORS.primary} 60%, rgb(150, 72, 84) 100%)`,
          borderRadius: 5,
          transition: "width 0.4s",
        }}
      />
    </div>
  );
};

const PersonCard: React.FC<{
  p: PersonCardData;
  displayLevel: number;
  highlighted?: boolean;
  pressScale?: number;
}> = ({ p, displayLevel, highlighted, pressScale = 1 }) => {
  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: 32,
        border: `1px solid ${COLORS.cardBorder}`,
        padding: "22px 18px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        boxShadow: highlighted
          ? "0 12px 40px rgba(178, 90, 100, 0.28), 0 0 0 3px rgba(178, 90, 100, 0.35)"
          : "0 4px 16px rgba(82, 67, 58, 0.08)",
        transform: `scale(${pressScale})`,
        transition: "transform 0.1s",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 108,
          height: 108,
          borderRadius: "50%",
          background: p.avatarColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: SF_STACK,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: "-0.01em",
          boxShadow: `0 0 0 4px rgba(255,255,255,0.6), 0 0 0 6px ${p.avatarColor}33`,
        }}
      >
        {p.initials}
      </div>
      {/* Name */}
      <div
        style={{
          fontFamily: SF_STACK,
          fontSize: 28,
          fontWeight: 600,
          color: COLORS.text,
          letterSpacing: "-0.01em",
        }}
      >
        {p.name}
      </div>
      {/* Relation */}
      <div
        style={{
          fontFamily: SF_STACK,
          fontSize: 18,
          fontWeight: 500,
          color: COLORS.textSoft,
        }}
      >
        {p.relation}
      </div>
      {/* Bar */}
      <div style={{ width: "100%", paddingTop: 6 }}>
        <ConnectionBar level={displayLevel} />
      </div>
      {/* Streak */}
      {p.streak && p.streak >= 2 && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(255, 237, 213, 0.85)",
            borderRadius: 999,
            padding: "3px 10px 3px 6px",
            fontFamily: SF_STACK,
            fontSize: 14,
            fontWeight: 700,
            color: "rgb(200, 90, 50)",
            display: "flex",
            gap: 2,
            alignItems: "center",
          }}
        >
          🔥<span>{p.streak}</span>
        </div>
      )}
    </div>
  );
};

const HomeScreen: React.FC<{
  frame: number;
  fps: number;
  sceneStartFrame: number;
  highlightPerson?: number | null;
  pressPerson?: number | null;
  pressProgress?: number;
}> = ({
  frame,
  fps,
  sceneStartFrame,
  highlightPerson,
  pressPerson,
  pressProgress = 0,
}) => {
  // Cards fade up with 60ms stagger starting at scene start
  const local = frame - sceneStartFrame;
  const cardStagger = Math.round(fps * 0.06);

  // Sarah's bar drain — starts at 0.4s into scene, animates over 0.8s
  const drainStart = Math.round(fps * 0.4);
  const drainEnd = drainStart + Math.round(fps * 0.8);

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      <AmbientBlobs frame={frame} fps={fps} />
      <StatusBar tint="dark" />

      {/* Header */}
      {(() => {
        const headerOpacity = interpolate(local, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const headerY = interpolate(local, [0, 12], [12, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div
            style={{
              position: "absolute",
              top: 108,
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: headerOpacity,
              transform: `translateY(${headerY}px)`,
            }}
          >
            <div
              style={{
                fontFamily: SERIF_STACK,
                fontSize: 76,
                fontWeight: 500,
                color: COLORS.text,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Inner Circle
            </div>
            <div
              style={{
                fontFamily: SF_STACK,
                fontSize: 22,
                fontWeight: 500,
                color: COLORS.textSoft,
                marginTop: 10,
              }}
            >
              Learn more
            </div>
          </div>
        );
      })()}

      {/* Search + Overdue row */}
      {(() => {
        const searchOpacity = interpolate(local, [4, 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            style={{
              position: "absolute",
              top: 316,
              left: 48,
              right: 48,
              display: "flex",
              gap: 12,
              opacity: searchOpacity,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 64,
                borderRadius: 20,
                background: "rgba(255, 255, 255, 0.55)",
                border: `1px solid ${COLORS.glassBorder}`,
                backdropFilter: "blur(20px)",
                display: "flex",
                alignItems: "center",
                padding: "0 22px",
                fontFamily: SF_STACK,
                fontSize: 22,
                color: COLORS.textMuted,
                gap: 14,
              }}
            >
              <span style={{ fontSize: 24 }}>🔍</span>
              <span>Search...</span>
            </div>
            <div
              style={{
                padding: "0 22px",
                height: 64,
                borderRadius: 20,
                background: "rgba(255, 255, 255, 0.55)",
                border: `1px solid ${COLORS.glassBorder}`,
                display: "flex",
                alignItems: "center",
                fontFamily: SF_STACK,
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.textSoft,
              }}
            >
              Overdue
            </div>
          </div>
        );
      })()}

      {/* People grid */}
      <div
        style={{
          position: "absolute",
          top: 416,
          left: 44,
          right: 44,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 18,
          rowGap: 24,
        }}
      >
        {PEOPLE.map((p, i) => {
          const cardStart = 10 + i * cardStagger;
          const cardOpacity = interpolate(
            local,
            [cardStart, cardStart + 12],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          const cardY = interpolate(
            local,
            [cardStart, cardStart + 14],
            [28, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          );

          // Sarah's bar drains from startLevel → level
          let displayLevel = p.level;
          if (i === SARAH_IDX) {
            const drainT = interpolate(local, [drainStart, drainEnd], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.cubic),
            });
            displayLevel = p.startLevel + (p.level - p.startLevel) * drainT;
          }

          const isHighlight = highlightPerson === i;
          const pressScale = pressPerson === i ? 1 - pressProgress * 0.04 : 1;

          return (
            <div
              key={p.name}
              style={{
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                position: "relative",
              }}
            >
              <PersonCard
                p={p}
                displayLevel={displayLevel}
                highlighted={isHighlight}
                pressScale={pressScale}
              />
            </div>
          );
        })}
      </div>

      <HomeIndicator tint="dark" />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Person Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

const PersonScreen: React.FC<{
  frame: number;
  fps: number;
  sceneStartFrame: number;
  personName: string;
  monthsSinceText: number;
  reachPressProgress?: number; // 0..1 for button press
  sheetOpen?: boolean;
}> = ({
  frame,
  fps,
  sceneStartFrame,
  personName,
  monthsSinceText,
  reachPressProgress = 0,
  sheetOpen = false,
}) => {
  const local = frame - sceneStartFrame;
  const sarah = PEOPLE[SARAH_IDX];

  // Pulse the reach out button
  const pulsePhase = (frame / fps) * 1.8;
  const pulseScale = 1 + Math.sin(pulsePhase * Math.PI) * 0.025;

  // Press overrides pulse
  const btnScale =
    reachPressProgress > 0 ? 1 - reachPressProgress * 0.05 : pulseScale;
  const btnBgShift = reachPressProgress * 0.15;

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      <AmbientBlobs frame={frame} fps={fps} />
      <StatusBar tint="dark" />

      {/* Back chevron */}
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 36,
          fontFamily: SF_STACK,
          fontSize: 28,
          color: COLORS.primary,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 48, fontWeight: 300, lineHeight: 0.8 }}>
          ‹
        </span>
        <span style={{ fontWeight: 500 }}>Back</span>
      </div>

      {/* Large avatar with ring */}
      <div
        style={{
          position: "absolute",
          top: 220,
          left: "50%",
          transform: "translateX(-50%)",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: sarah.avatarColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: SF_STACK,
          fontWeight: 700,
          fontSize: 78,
          boxShadow: `0 0 0 8px rgba(255,255,255,0.8), 0 0 0 12px ${sarah.avatarColor}44, 0 20px 48px rgba(82, 67, 58, 0.2)`,
        }}
      >
        {sarah.initials}
      </div>

      {/* Name */}
      <div
        style={{
          position: "absolute",
          top: 470,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SF_STACK,
          fontSize: 60,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: "-0.02em",
        }}
      >
        {personName}
      </div>

      <div
        style={{
          position: "absolute",
          top: 552,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SF_STACK,
          fontSize: 26,
          fontWeight: 500,
          color: COLORS.textSoft,
        }}
      >
        Best friend
      </div>

      {/* "drifting" status with heart broken */}
      <div
        style={{
          position: "absolute",
          top: 612,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SF_STACK,
          fontSize: 24,
          fontWeight: 600,
          color: COLORS.primary,
        }}
      >
        💔 {monthsSinceText} months since you talked
      </div>

      {/* Large connection bar */}
      <div
        style={{
          position: "absolute",
          top: 692,
          left: 80,
          right: 80,
        }}
      >
        <div
          style={{
            width: "100%",
            height: 22,
            borderRadius: 11,
            background: COLORS.barEmpty,
            position: "relative",
            overflow: "hidden",
            boxShadow: "inset 0 2px 6px rgba(82, 67, 58, 0.12)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: "10%",
              background: `linear-gradient(180deg, rgb(220, 140, 150) 0%, ${COLORS.primary} 50%, rgb(150, 72, 84) 100%)`,
              borderRadius: 11,
            }}
          />
        </div>
      </div>

      {/* Reach out button */}
      <div
        style={{
          position: "absolute",
          top: 800,
          left: 120,
          right: 120,
          height: 96,
          borderRadius: 48,
          background: `rgb(${178 - btnBgShift * 25}, ${90 - btnBgShift * 18}, ${100 - btnBgShift * 16})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: SF_STACK,
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          boxShadow:
            reachPressProgress > 0
              ? "0 4px 12px rgba(178, 90, 100, 0.35)"
              : "0 12px 36px rgba(178, 90, 100, 0.45), 0 0 0 0 rgba(178, 90, 100, 0.3)",
          transform: `scale(${btnScale})`,
          transition: "transform 0.08s",
        }}
      >
        Reach out
      </div>

      {/* Recent interactions card */}
      <div
        style={{
          position: "absolute",
          top: 960,
          left: 48,
          right: 48,
          background: COLORS.card,
          borderRadius: 28,
          border: `1px solid ${COLORS.cardBorder}`,
          padding: 28,
        }}
      >
        <div
          style={{
            fontFamily: SF_STACK,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 18,
          }}
        >
          Recent interactions
        </div>
        {[
          { icon: "💬", type: "Texted", when: "4 months ago", fade: true },
          { icon: "📞", type: "Called", when: "6 months ago", fade: true },
          { icon: "💬", type: "Texted", when: "8 months ago", fade: true },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 0",
              borderTop: i > 0 ? `1px solid ${COLORS.cardBorder}` : "none",
              opacity: row.fade ? 0.6 : 1,
            }}
          >
            <div
              style={{
                fontFamily: SF_STACK,
                fontSize: 22,
                color: COLORS.text,
              }}
            >
              {row.icon} {row.type}
            </div>
            <div
              style={{
                fontFamily: SF_STACK,
                fontSize: 20,
                color: COLORS.textMuted,
              }}
            >
              {row.when}
            </div>
          </div>
        ))}
      </div>

      {sheetOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)",
            zIndex: 60,
          }}
        />
      )}

      <HomeIndicator tint="dark" />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Reach Out Sheet
// ─────────────────────────────────────────────────────────────────────────────

const ReachOutSheet: React.FC<{
  frame: number;
  fps: number;
  sceneStartFrame: number;
  personName: string;
  aiMessage: string;
  aiRevealProgress: number; // 0..1, how much of aiMessage is visible
  showAiPress?: boolean;
  showSendPress?: boolean;
  sendProgress?: number; // 0..1 once send pressed, for flash
}> = ({
  frame,
  fps,
  sceneStartFrame,
  personName,
  aiMessage,
  aiRevealProgress,
  showAiPress,
  showSendPress,
  sendProgress = 0,
}) => {
  const local = frame - sceneStartFrame;

  // Sheet slides up from below
  const sheetT = spring({
    frame: local,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.6 },
  });
  const sheetTranslateY = (1 - sheetT) * 1100;

  const visibleChars = Math.floor(aiMessage.length * aiRevealProgress);
  const visibleText = aiMessage.slice(0, visibleChars);
  const cursorBlink = Math.floor(frame / 8) % 2 === 0;

  return (
    <>
      {/* Sheet */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1280,
          background: COLORS.sheetBg,
          backdropFilter: "blur(24px)",
          borderTopLeftRadius: 42,
          borderTopRightRadius: 42,
          transform: `translateY(${sheetTranslateY}px)`,
          zIndex: 70,
          padding: "28px 48px 56px",
          boxShadow: "0 -16px 48px rgba(82, 67, 58, 0.18)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 56,
            height: 6,
            borderRadius: 3,
            background: COLORS.textMuted,
            margin: "0 auto 28px",
          }}
        />

        {/* Title */}
        <div
          style={{
            fontFamily: SF_STACK,
            fontSize: 36,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: "-0.02em",
            marginBottom: 24,
          }}
        >
          Reach out to {personName}
        </div>

        {/* ✨ Write with AI button */}
        <div
          style={{
            background: `linear-gradient(135deg, rgba(232, 160, 168, 0.25), rgba(220, 140, 150, 0.18))`,
            border: `2px solid rgba(178, 90, 100, ${showAiPress ? 0.8 : 0.35})`,
            borderRadius: 24,
            padding: "22px 26px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 22,
            transform: showAiPress ? "scale(0.985)" : "scale(1)",
            transition: "transform 0.08s",
          }}
        >
          <span style={{ fontSize: 30 }}>✨</span>
          <span
            style={{
              fontFamily: SF_STACK,
              fontSize: 26,
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            Write with AI
          </span>
        </div>

        {/* Textarea with typing AI message */}
        <div
          style={{
            background: "white",
            border: `1.5px solid ${COLORS.cardBorder}`,
            borderRadius: 22,
            padding: "24px 26px",
            minHeight: 220,
            fontFamily: SF_STACK,
            fontSize: 26,
            lineHeight: 1.45,
            color: COLORS.text,
            marginBottom: 28,
            position: "relative",
          }}
        >
          {visibleText}
          {aiRevealProgress > 0 && aiRevealProgress < 1 && cursorBlink && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 28,
                background: COLORS.text,
                verticalAlign: "middle",
                marginLeft: 2,
              }}
            />
          )}
        </div>

        {/* Text + Email buttons */}
        <div style={{ display: "flex", gap: 18 }}>
          <div
            style={{
              flex: 1,
              height: 88,
              borderRadius: 44,
              background: showSendPress ? COLORS.primaryDeep : COLORS.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontFamily: SF_STACK,
              fontSize: 28,
              fontWeight: 600,
              gap: 10,
              transform: showSendPress ? "scale(0.97)" : "scale(1)",
              transition: "transform 0.08s",
              boxShadow: "0 8px 24px rgba(178, 90, 100, 0.35)",
            }}
          >
            💬 Text
          </div>
          <div
            style={{
              flex: 1,
              height: 88,
              borderRadius: 44,
              background: COLORS.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontFamily: SF_STACK,
              fontSize: 28,
              fontWeight: 600,
              gap: 10,
              boxShadow: "0 8px 24px rgba(178, 90, 100, 0.35)",
            }}
          >
            ✉️ Email
          </div>
        </div>
      </div>

      {/* Send flash */}
      {sendProgress > 0 && (
        <AbsoluteFill
          style={{
            background: "white",
            opacity: interpolate(
              sendProgress,
              [0, 0.2, 0.5, 1],
              [0, 0.5, 0.2, 0],
            ),
            zIndex: 200,
          }}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main composition
// ─────────────────────────────────────────────────────────────────────────────

export const AppDemo: React.FC<AppDemoProps> = ({
  personName,
  monthsSinceText,
  aiMessage,
  logoUrl,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Convert scene ranges to frame ranges
  const S = Object.fromEntries(
    Object.entries(SCENES).map(([k, v]) => [
      k,
      {
        startFrame: Math.round(v.start * fps),
        endFrame: Math.round(v.end * fps),
        durationFrames: Math.round((v.end - v.start) * fps),
      },
    ]),
  ) as Record<
    keyof typeof SCENES,
    { startFrame: number; endFrame: number; durationFrames: number }
  >;

  // ── Home / tap / slide / person progress ────────────────────────────────
  const inHome = frame < S.SLIDE.startFrame;
  const inSlide = frame >= S.SLIDE.startFrame && frame < S.SLIDE.endFrame;
  const afterSlide = frame >= S.SLIDE.endFrame;

  // Card press during TAP_CARD
  const cardPressLocal = frame - S.TAP_CARD.startFrame;
  const cardPressProgress =
    cardPressLocal >= 0 && cardPressLocal <= S.TAP_CARD.durationFrames
      ? interpolate(
          cardPressLocal,
          [0, S.TAP_CARD.durationFrames * 0.5, S.TAP_CARD.durationFrames],
          [0, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

  // Slide transition
  const slideLocal = frame - S.SLIDE.startFrame;
  const slideT = interpolate(slideLocal, [0, S.SLIDE.durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Reach out button press
  const reachPressLocal = frame - S.TAP_REACH.startFrame;
  const reachPressProgress =
    reachPressLocal >= 0 && reachPressLocal <= S.TAP_REACH.durationFrames
      ? interpolate(
          reachPressLocal,
          [0, S.TAP_REACH.durationFrames * 0.5, S.TAP_REACH.durationFrames],
          [0, 1, 0.6],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

  // Sheet up
  const sheetOpen = frame >= S.SHEET_UP.startFrame;

  // AI reveal progress — starts 0.3s after SHEET_UP ends (after a tap of the AI button)
  const aiPressStart = S.AI_TYPING.startFrame;
  const aiPressDuration = Math.round(fps * 0.3);
  const showAiPress =
    frame >= aiPressStart && frame < aiPressStart + aiPressDuration;

  const aiTypeStart = aiPressStart + aiPressDuration;
  const aiTypeDuration = S.AI_TYPING.endFrame - aiTypeStart;
  const aiRevealProgress = interpolate(
    frame,
    [aiTypeStart, aiTypeStart + aiTypeDuration * 0.9],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Send press at start of SEND scene
  const sendPressStart = S.SEND.startFrame;
  const sendPressDuration = Math.round(fps * 0.35);
  const showSendPress =
    frame >= sendPressStart && frame < sendPressStart + sendPressDuration;
  const sendFlashProgress = interpolate(
    frame,
    [sendPressStart + sendPressDuration, S.SEND.endFrame],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Layer rendering ─────────────────────────────────────────────────────

  // Home-side translate during slide (slide left to -30%)
  const homeTranslateX = inSlide ? -slideT * 0.3 * 1080 : 0;
  // Person-side translate during slide (slide in from +100%)
  const personTranslateX = inSlide ? (1 - slideT) * 1080 : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, overflow: "hidden" }}>
      {/* Home screen layer */}
      {(inHome || inSlide) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${homeTranslateX}px)`,
            willChange: "transform",
          }}
        >
          <HomeScreen
            frame={frame}
            fps={fps}
            sceneStartFrame={S.HOME.startFrame}
            highlightPerson={
              frame >= S.TAP_CARD.startFrame && frame < S.SLIDE.endFrame
                ? SARAH_IDX
                : null
            }
            pressPerson={SARAH_IDX}
            pressProgress={cardPressProgress}
          />
        </div>
      )}

      {/* Person screen layer */}
      {(inSlide || afterSlide) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${personTranslateX}px)`,
            willChange: "transform",
            boxShadow: inSlide ? "-24px 0 48px rgba(0,0,0,0.25)" : "none",
          }}
        >
          <PersonScreen
            frame={frame}
            fps={fps}
            sceneStartFrame={S.PERSON.startFrame}
            personName={personName}
            monthsSinceText={monthsSinceText}
            reachPressProgress={reachPressProgress}
            sheetOpen={sheetOpen}
          />
        </div>
      )}

      {/* Sheet overlay */}
      {sheetOpen && (
        <ReachOutSheet
          frame={frame}
          fps={fps}
          sceneStartFrame={S.SHEET_UP.startFrame}
          personName={personName}
          aiMessage={aiMessage}
          aiRevealProgress={aiRevealProgress}
          showAiPress={showAiPress}
          showSendPress={showSendPress}
          sendProgress={sendFlashProgress}
        />
      )}

      {/* Finger tap overlays — positioned relative to the 1080x1920 viewport */}
      {/* Tap on Sarah's card — column 0, row 1 → approx (294, 680) */}
      <FingerTap
        frame={frame}
        fps={fps}
        startFrame={S.TAP_CARD.startFrame}
        durationFrames={S.TAP_CARD.durationFrames}
        cx={294}
        cy={810}
      />
      {/* Tap on Reach out button — approx (540, 848) */}
      <FingerTap
        frame={frame}
        fps={fps}
        startFrame={S.TAP_REACH.startFrame}
        durationFrames={S.TAP_REACH.durationFrames}
        cx={540}
        cy={848}
      />
      {/* Tap on AI button — inside sheet, approx (540, 1050) after slide up */}
      {frame >= aiPressStart && frame < aiPressStart + aiPressDuration && (
        <FingerTap
          frame={frame}
          fps={fps}
          startFrame={aiPressStart}
          durationFrames={aiPressDuration}
          cx={540}
          cy={1080}
        />
      )}
      {/* Tap on Text send button — approx (360, 1760) */}
      {frame >= sendPressStart &&
        frame < sendPressStart + sendPressDuration && (
          <FingerTap
            frame={frame}
            fps={fps}
            startFrame={sendPressStart}
            durationFrames={sendPressDuration}
            cx={380}
            cy={1760}
          />
        )}

      {/* Burned-in captions synced to demo narration — top z-index */}
      <CaptionTrack captions={captions} />
    </AbsoluteFill>
  );
};
