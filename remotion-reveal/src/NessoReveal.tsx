import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
  Easing,
  Img,
} from "remotion";
import React from "react";
import { TextFadeIn } from "./TextFadeIn";
import { ScreenshotZoom } from "./ScreenshotZoom";
import { LogoCascade } from "./LogoCascade";

export type RevealProps = {
  headline: string;
  logoUrl: string;
  screenshotUrl: string;
  subtitleText: string;
  handleText: string;
  accentColor: string;
};

export const NessoReveal: React.FC<RevealProps> = ({
  headline,
  logoUrl,
  screenshotUrl,
  subtitleText,
  handleText,
  accentColor,
}) => {
  const { fps } = useVideoConfig();

  // Segment timing (frames)
  const textDur = Math.round(1.5 * fps); // 45 frames
  const screenshotDur = screenshotUrl ? Math.round(1.5 * fps) : 0; // 45 or 0
  const logoDur = Math.round(2.0 * fps); // 60 frames

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #0A0710 0%, #14101C 50%, #1A1226 100%)",
      }}
    >
      {/* Segment 1: Headline word-by-word fade-in */}
      <Sequence from={0} durationInFrames={textDur}>
        <TextFadeIn text={headline} />
      </Sequence>

      {/* Segment 2: App screenshot Ken Burns (if provided) */}
      {screenshotUrl && (
        <Sequence from={textDur} durationInFrames={screenshotDur}>
          <ScreenshotZoom src={screenshotUrl} accentColor={accentColor} />
        </Sequence>
      )}

      {/* Segment 3: Logo scale-up + cascade text */}
      <Sequence from={textDur + screenshotDur} durationInFrames={logoDur}>
        <LogoCascade
          logoUrl={logoUrl}
          subtitleText={subtitleText}
          handleText={handleText}
          accentColor={accentColor}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
