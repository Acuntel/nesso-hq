import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
  Img,
  staticFile,
} from "remotion";

export type LogoCloseProps = {
  /** Public URL or staticFile path for the Nesso logo PNG. */
  logoUrl?: string;
  /** Main payoff line, e.g. "it's free". Keep short, max 3 words. */
  payoff?: string;
  /** Brand/domain line in accent color. e.g. "nesso.ai". */
  handle?: string;
  /** Small hint line under the handle. e.g. "on the App Store". */
  appStoreHint?: string;
  /** Optional dim-behind PNG (last frame of demo). Renders under at 35% opacity. */
  backdropUrl?: string;
};

export const LogoClose: React.FC<LogoCloseProps> = ({
  logoUrl,
  payoff = "it's free",
  handle = "nesso.ai",
  appStoreHint = "on the App Store",
  backdropUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Logo spring 0.55 → 1.0
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 95, mass: 0.9 },
  });
  const logoScale = 0.55 + logoSpring * 0.45;
  const logoOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Glow pulse behind logo
  const glowPulse = interpolate(
    frame,
    [0, durationInFrames * 0.55, durationInFrames],
    [0, 0.75, 0.35],
    { extrapolateRight: "clamp" },
  );

  // Payoff — word-by-word slide up starting at 30% of duration
  const payoffStart = Math.round(durationInFrames * 0.3);
  const payoffWords = payoff.split(" ");
  const payoffWordGap = Math.max(4, Math.round(fps * 0.08));
  const payoffFade = Math.max(6, Math.round(fps * 0.18));

  // Handle — fades in last, slight slide
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

  // Backdrop dims in over first 8 frames
  const backdropOpacity = interpolate(frame, [0, 8], [0, 0.35], {
    extrapolateRight: "clamp",
  });

  const logoSize = 280;
  const accentRose = "#E8A0A8";

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #140B0F 0%, #1F1215 55%, #0A0707 100%)",
        overflow: "hidden",
      }}
    >
      {/* Backdrop (last frame of demo) */}
      {backdropUrl && (
        <AbsoluteFill
          style={{
            opacity: backdropOpacity,
            filter: "blur(12px) saturate(0.7)",
          }}
        >
          <Img
            src={backdropUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Radial vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.75) 100%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {/* Ambient glow behind logo */}
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accentRose}${Math.round(
              glowPulse * 200,
            )
              .toString(16)
              .padStart(2, "0")} 0%, transparent 70%)`,
            filter: "blur(90px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -62%)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            marginBottom: 40,
            filter: `drop-shadow(0 12px 48px ${accentRose}55)`,
          }}
        >
          <Img
            src={logoUrl || staticFile("nesso_logo.png")}
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: 56,
            }}
          />
        </div>

        {/* Payoff — word-by-word */}
        <div
          style={{
            display: "flex",
            gap: "0 14px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {payoffWords.map((word, i) => {
            const wordStart = payoffStart + i * payoffWordGap;
            const op = interpolate(
              frame,
              [wordStart, wordStart + payoffFade],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const y = interpolate(
              frame,
              [wordStart, wordStart + payoffFade],
              [18, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              },
            );
            return (
              <span
                key={i}
                style={{
                  fontFamily:
                    "'SF Pro Display', 'Geist', 'Manrope', sans-serif",
                  fontSize: 96,
                  fontWeight: 800,
                  color: "white",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.0,
                  opacity: op,
                  transform: `translateY(${y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Handle — rose accent */}
        <div
          style={{
            opacity: handleOpacity,
            transform: `translateY(${handleY}px)`,
            fontFamily: "'SF Pro Text', 'Geist', 'Manrope', sans-serif",
            fontSize: 48,
            fontWeight: 600,
            color: accentRose,
            letterSpacing: "-0.01em",
          }}
        >
          {handle}
        </div>

        {/* "on the App Store" hint */}
        {appStoreHint && (
          <div
            style={{
              opacity: interpolate(
                frame,
                [handleStart + 6, handleStart + 18],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
              transform: `translateY(${interpolate(
                frame,
                [handleStart + 6, handleStart + 18],
                [10, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              )}px)`,
              marginTop: 10,
              fontFamily: "'SF Pro Text', 'Geist', 'Manrope', sans-serif",
              fontSize: 26,
              fontWeight: 500,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.02em",
            }}
          >
            {appStoreHint}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
