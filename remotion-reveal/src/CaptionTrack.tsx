import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

export type CaptionWord = {
  word: string;
  startSec: number;
  endSec: number;
};

export type CaptionLine = {
  text: string;
  startSec: number;
  endSec: number;
  words: CaptionWord[];
};

export type CaptionTrackProps = {
  captions?: CaptionLine[];
  /**
   * Vertical position as a 0..1 fraction of the screen height.
   * Default 0.78 = lower third, safe for TikTok bottom UI.
   */
  positionY?: number;
  /** Accent color for the currently-spoken word. */
  accentColor?: string;
};

const FONT_STACK =
  "'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Arial', sans-serif";

/**
 * Word-by-word burned-in captions. Renders one line at a time at the lower
 * third of the screen, with the currently-spoken word highlighted in the
 * accent color. Intended to be layered ON TOP of any composition so viewers
 * who watch muted (≈85% of TikTok) can follow the voiceover.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({
  captions = [],
  positionY = 0.78,
  accentColor = "#E8A0A8",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps;

  if (!captions || captions.length === 0) return null;

  // Find the line visible at this moment. Lines are non-overlapping by design
  // but we add a tiny leading/trailing window for smoother transitions.
  const lead = 0.05;
  const trail = 0.15;
  const active = captions.find(
    (c) => nowSec >= c.startSec - lead && nowSec <= c.endSec + trail,
  );
  if (!active) return null;

  // Fade in/out at line boundaries (2 frames each)
  const fadeFrames = 2;
  const fadeInEnd = active.startSec + fadeFrames / fps;
  const fadeOutStart = active.endSec - fadeFrames / fps;
  const opacity = interpolate(
    nowSec,
    [active.startSec - lead, fadeInEnd, fadeOutStart, active.endSec + trail],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const slideY = interpolate(
    nowSec,
    [active.startSec - lead, fadeInEnd],
    [10, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: `${positionY * 100}%`,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 14px",
          maxWidth: "88%",
          padding: "18px 28px",
          borderRadius: 28,
          background: "rgba(0, 0, 0, 0.78)",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
          opacity,
          transform: `translateY(${slideY}px)`,
        }}
      >
        {active.words.map((w, i) => {
          const spoken = nowSec >= w.startSec && nowSec <= w.endSec + 0.05;
          const past = nowSec > w.endSec + 0.05;
          const color = spoken
            ? accentColor
            : past
              ? "white"
              : "rgba(255,255,255,0.72)";
          const scale = spoken ? 1.06 : 1.0;
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT_STACK,
                fontSize: 46,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
                color,
                textShadow: spoken
                  ? `0 0 20px ${accentColor}aa`
                  : "0 2px 6px rgba(0,0,0,0.6)",
                transform: `scale(${scale})`,
                transition: "color 60ms linear, transform 80ms ease-out",
                whiteSpace: "nowrap",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
