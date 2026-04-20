import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  spring,
} from "remotion";
import React from "react";

type Props = {
  logoUrl: string;
  subtitleText: string;
  handleText: string;
  accentColor: string;
};

export const LogoCascade: React.FC<Props> = ({
  logoUrl,
  subtitleText,
  handleText,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Logo: spring scale from 0.5 → 1.0 (starts immediately)
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 80,
      mass: 0.8,
    },
  });

  const logoOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  // "it's free" — fades up at 40% of timeline
  const freeStart = Math.round(durationInFrames * 0.35);
  const freeOpacity = interpolate(frame, [freeStart, freeStart + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const freeY = interpolate(frame, [freeStart, freeStart + 12], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // "@nesso.app" — fades up at 60% of timeline
  const handleStart = Math.round(durationInFrames * 0.55);
  const handleOpacity = interpolate(
    frame,
    [handleStart, handleStart + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const handleY = interpolate(frame, [handleStart, handleStart + 12], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Subtle ambient glow behind logo
  const glowPulse = interpolate(
    frame,
    [0, durationInFrames * 0.5, durationInFrames],
    [0, 0.4, 0.25],
    { extrapolateRight: "clamp" },
  );

  const logoSize = 280;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}${Math.round(
            glowPulse * 255,
          )
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
          filter: "blur(60px)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -55%)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: `scale(${0.5 + logoScale * 0.5})`,
          opacity: logoOpacity,
          marginBottom: 32,
        }}
      >
        {logoUrl ? (
          <Img
            src={logoUrl}
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: 56,
            }}
          />
        ) : (
          <div
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: 56,
              background: accentColor,
            }}
          />
        )}
      </div>

      {/* "it's free" */}
      <div
        style={{
          opacity: freeOpacity,
          transform: `translateY(${freeY}px)`,
          fontFamily: "'SF Pro Display', 'Geist Sans', 'Manrope', sans-serif",
          fontSize: 48,
          fontWeight: 700,
          color: "white",
          letterSpacing: "-0.02em",
        }}
      >
        {subtitleText}
      </div>

      {/* @nesso.app */}
      <div
        style={{
          opacity: handleOpacity,
          transform: `translateY(${handleY}px)`,
          fontFamily: "'SF Pro Display', 'Geist Sans', 'Manrope', sans-serif",
          fontSize: 26,
          fontWeight: 400,
          color: "rgba(142,142,147,1)",
          marginTop: 16,
          letterSpacing: "0.01em",
        }}
      >
        {handleText}
      </div>
    </AbsoluteFill>
  );
};
