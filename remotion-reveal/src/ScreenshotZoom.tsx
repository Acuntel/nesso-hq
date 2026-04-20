import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
} from "remotion";
import React from "react";

type Props = {
  src: string;
  accentColor: string;
};

export const ScreenshotZoom: React.FC<Props> = ({ src, accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns: slow zoom 100% → 110%
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    easing: Easing.inOut(Easing.cubic),
  });

  // Slight upward pan
  const translateY = interpolate(frame, [0, durationInFrames], [0, -15], {
    easing: Easing.inOut(Easing.cubic),
  });

  // Fade in from previous segment
  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Vignette opacity (darkens edges for depth)
  const vignetteOpacity = interpolate(frame, [0, 15], [0, 0.7], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity: fadeIn, overflow: "hidden" }}>
      {/* Screenshot with Ken Burns */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: vignetteOpacity,
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(10,7,16,0.8) 100%)`,
        }}
      />

      {/* Bottom gradient for text readability */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: "linear-gradient(transparent, rgba(10,7,16,0.95))",
        }}
      />
    </AbsoluteFill>
  );
};
