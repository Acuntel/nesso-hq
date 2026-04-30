import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
  OffthreadVideo,
} from "remotion";

export type HookTextProps = {
  /** The cold-open line to animate in, word by word. */
  line: string;
  /**
   * Optional subline shown below, smaller, delayed. Keep under ~32 chars.
   * Used for punch context, e.g. "4 months. zero texts."
   */
  subline?: string;
  /** "rose" uses the Nesso warm accent; "indigo" uses a moodier blue-purple. */
  palette?: "rose" | "indigo";
  /**
   * Optional URL to a viral video clip to render UNDER the text. Dimmed to
   * ~55% opacity and desaturated so the kinetic typography stays legible.
   * If empty/undefined, the gradient palette alone renders.
   */
  backgroundVideoUrl?: string;
};

const PALETTES = {
  rose: {
    bgTop: "#1A0F0D",
    bgMid: "#2A1614",
    bgBottom: "#0F0908",
    accent: "#E8A0A8",
    blob1: "rgba(232, 160, 168, 0.18)",
    blob2: "rgba(180, 90, 110, 0.14)",
    blob3: "rgba(255, 200, 210, 0.10)",
  },
  indigo: {
    bgTop: "#0A0710",
    bgMid: "#14101C",
    bgBottom: "#1A1226",
    accent: "#C8B8F0",
    blob1: "rgba(180, 160, 240, 0.18)",
    blob2: "rgba(130, 110, 200, 0.14)",
    blob3: "rgba(200, 180, 255, 0.08)",
  },
} as const;

const AmbientBlob: React.FC<{
  size: number;
  color: string;
  top: string;
  left: string;
  delay: number;
  duration: number;
  frame: number;
  fps: number;
}> = ({ size, color, top, left, delay, duration, frame, fps }) => {
  const t = ((frame / fps - delay) % duration) / duration;
  const drift = Math.sin(t * Math.PI * 2) * 24;
  const scale = 0.9 + Math.sin(t * Math.PI * 2) * 0.1;
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        top,
        left,
        borderRadius: "50%",
        background: color,
        filter: "blur(80px)",
        transform: `translate(${drift}px, ${drift * 0.6}px) scale(${scale})`,
      }}
    />
  );
};

export const HookText: React.FC<HookTextProps> = ({
  line,
  subline,
  palette = "rose",
  backgroundVideoUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const P = PALETTES[palette];

  const words = line.split(" ");
  // V24: word stagger pushed off the front so the FIRST ~1.0s is pure raw
  // chaos clip — no overlay competing for attention. End is computed
  // BACKWARDS from durationInFrames so the last word's fade-in + glow peak
  // always lands before the cut, regardless of word count. (Without this,
  // a 7-word hook had the glow's input range overshoot durationInFrames
  // and Remotion's `interpolate()` rejected the non-monotonic range.)
  const fadeFrames = Math.max(6, Math.round(fps * 0.22));
  const glowPeakOffset = 14;
  const tailMargin = fadeFrames + glowPeakOffset + 4; // 4f safety
  const startFrame = Math.max(durationInFrames * 0.35, fps * 1.0);
  const endFrame = Math.max(startFrame + 1, durationInFrames - tailMargin);
  const perWordGap = (endFrame - startFrame) / Math.max(1, words.length);

  // V24: ghost preview disabled. We deliberately want frame 0 to be CLIP-ONLY
  // so the TikTok thumbnail also pulls just the chaos visual. (Algorithm
  // rewards thumbnails that look "real" — typography-heavy thumbs read as ads.)
  const ghostOpacity = 0;
  const ghostBlur = 0;

  // Subline appears 0.3s after the main line finishes
  const sublineStart = endFrame + Math.round(fps * 0.1);

  // Whole-line settle: subtle scale breath in the last 20% so it feels alive,
  // not frozen. Clamp the input range — for very short hook durations
  // endFrame could equal durationInFrames and Remotion would reject the
  // zero-width range.
  const settleScale = interpolate(
    frame,
    [endFrame, Math.max(endFrame + 1, durationInFrames)],
    [1.0, 1.015],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    },
  );

  // Vignette deepens as the line completes
  const vignetteOpacity = interpolate(
    frame,
    [0, durationInFrames * 0.5],
    [0, 0.55],
    { extrapolateRight: "clamp" },
  );

  // Background clip treatment — dims + desaturates so kinetic text stays legible
  const clipOpacity = interpolate(
    frame,
    [
      0,
      Math.round(fps * 0.12),
      durationInFrames - Math.round(fps * 0.2),
      durationInFrames,
    ],
    [0, 0.55, 0.55, 0.25],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const clipScale = interpolate(frame, [0, durationInFrames], [1.04, 1.12], {
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${P.bgTop} 0%, ${P.bgMid} 50%, ${P.bgBottom} 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Viral clip layer — dimmed + desaturated */}
      {backgroundVideoUrl && (
        <AbsoluteFill
          style={{
            opacity: clipOpacity,
            filter: "saturate(0.55) contrast(1.08)",
            transform: `scale(${clipScale})`,
            transformOrigin: "center center",
          }}
        >
          {/* V24: native audio passes through (was muted) — chaos clip's
              tire screech / screams / impact ARE the hook soundtrack. Volume
              is full (1.0); morph.py ducks the music bed to 0.06 during
              0..hook_dur so the native track dominates the first 2.5s. */}
          <OffthreadVideo
            src={backgroundVideoUrl}
            muted={false}
            volume={1.0}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Color wash to unify with palette */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, ${P.bgTop}cc 0%, transparent 30%, ${P.bgBottom}dd 100%)`,
              mixBlendMode: "multiply",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Ambient blobs — floaty, warm, on-brand */}
      <AmbientBlob
        size={420}
        color={P.blob1}
        top="12%"
        left="-10%"
        delay={0}
        duration={8}
        frame={frame}
        fps={fps}
      />
      <AmbientBlob
        size={340}
        color={P.blob2}
        top="55%"
        left="70%"
        delay={1.5}
        duration={7}
        frame={frame}
        fps={fps}
      />
      <AmbientBlob
        size={500}
        color={P.blob3}
        top="70%"
        left="-5%"
        delay={3}
        duration={9}
        frame={frame}
        fps={fps}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)",
          opacity: vignetteOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Ghost preview layer — all words visible at frame 0 so the TikTok
          thumbnail (pulled from frame 0) shows the full hook line. Fades out
          by frame 6, then the staggered layer takes over. */}
      {ghostOpacity > 0 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: "0 80px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "14px 18px",
              maxWidth: 960,
              opacity: ghostOpacity,
              filter: `blur(${ghostBlur}px)`,
            }}
          >
            {words.map((word, i) => (
              <span
                key={`ghost-${i}`}
                style={{
                  fontFamily:
                    "'SF Pro Display', 'Geist', 'Manrope', 'DM Sans', sans-serif",
                  fontSize: words.length > 8 ? 88 : 108,
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.025em",
                  lineHeight: 1.08,
                  whiteSpace: "nowrap",
                }}
              >
                {word}
              </span>
            ))}
          </div>
        </AbsoluteFill>
      )}

      {/* Main line — word stagger */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 80px",
          transform: `scale(${settleScale})`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "14px 18px",
            maxWidth: 960,
          }}
        >
          {words.map((word, i) => {
            const wordStart = startFrame + i * perWordGap;
            const opacity = interpolate(
              frame,
              [wordStart, wordStart + fadeFrames],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const translateY = interpolate(
              frame,
              [wordStart, wordStart + fadeFrames],
              [28, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              },
            );
            // Glow trail on the final word only (the payoff). V24 belt-and-
            // suspenders: clamp every interpolate input so it's strictly
            // monotonic regardless of word count. Without this, a long hook
            // line could push the glow peak past durationInFrames and
            // Remotion would throw "inputRange must be strictly monotonically
            // increasing" — which is exactly what crashed the V24 first run.
            const isLast = i === words.length - 1;
            const lastIn0 = wordStart + fadeFrames;
            const lastIn1 = Math.max(lastIn0 + 1, wordStart + fadeFrames + 14);
            const lastIn2 = Math.max(lastIn1 + 1, durationInFrames);
            const nonLastIn0 = wordStart + fadeFrames;
            const nonLastIn1 = nonLastIn0 + 10;
            const glowOpacity = isLast
              ? interpolate(
                  frame,
                  [lastIn0, lastIn1, lastIn2],
                  [0, 0.85, 0.3],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                )
              : interpolate(frame, [nonLastIn0, nonLastIn1], [0.6, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });

            return (
              <span
                key={i}
                style={{
                  fontFamily:
                    "'SF Pro Display', 'Geist', 'Manrope', 'DM Sans', sans-serif",
                  fontSize: words.length > 8 ? 88 : 108,
                  fontWeight: 700,
                  color: isLast ? P.accent : "white",
                  letterSpacing: "-0.025em",
                  lineHeight: 1.08,
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  textShadow: isLast
                    ? `0 0 60px rgba(232, 160, 168, ${glowOpacity})`
                    : `0 0 40px rgba(255,255,255,${glowOpacity * 0.6})`,
                  whiteSpace: "nowrap",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Optional subline */}
        {subline && (
          <div
            style={{
              marginTop: 48,
              opacity: interpolate(
                frame,
                [sublineStart, sublineStart + 10],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
              transform: `translateY(${interpolate(
                frame,
                [sublineStart, sublineStart + 10],
                [16, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              )}px)`,
              fontFamily: "'SF Pro Text', 'Geist', 'Manrope', sans-serif",
              fontSize: 42,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "-0.01em",
              textAlign: "center",
            }}
          >
            {subline}
          </div>
        )}
      </AbsoluteFill>

      {/* Final-frame flash pulse — signals the cut to the next segment */}
      {(() => {
        const flashStart = durationInFrames - Math.round(fps * 0.25);
        const flashOpacity = interpolate(
          frame,
          [flashStart, flashStart + 4, durationInFrames],
          [0, 0.35, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <AbsoluteFill
            style={{
              background: "white",
              opacity: flashOpacity,
              pointerEvents: "none",
            }}
          />
        );
      })()}
    </AbsoluteFill>
  );
};
