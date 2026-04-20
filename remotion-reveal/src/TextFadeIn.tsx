import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import React from "react";

type Props = {
  text: string;
};

export const TextFadeIn: React.FC<Props> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const words = text.split(" ");

  // Each word staggers in over 70% of the duration, 30% hold at end
  const staggerWindow = durationInFrames * 0.7;
  const perWordDelay = staggerWindow / Math.max(1, words.length);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 80px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px 16px",
          maxWidth: 900,
        }}
      >
        {words.map((word, i) => {
          const startFrame = i * perWordDelay;
          const fadeFrames = 10; // ~0.33s fade per word

          const opacity = interpolate(
            frame,
            [startFrame, startFrame + fadeFrames],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          const translateY = interpolate(
            frame,
            [startFrame, startFrame + fadeFrames],
            [20, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          );

          // Subtle glow on newly appearing words
          const glowOpacity = interpolate(
            frame,
            [startFrame + fadeFrames, startFrame + fadeFrames + 8],
            [0.6, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          return (
            <span
              key={i}
              style={{
                fontFamily:
                  "'SF Pro Display', 'Geist Sans', 'Manrope', sans-serif",
                fontSize: 52,
                fontWeight: 700,
                color: "white",
                letterSpacing: "-0.02em",
                lineHeight: 1.3,
                opacity,
                transform: `translateY(${translateY}px)`,
                textShadow: `0 0 30px rgba(255,255,255,${glowOpacity})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
