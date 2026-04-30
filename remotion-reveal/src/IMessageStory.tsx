import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
} from "remotion";
import type { CaptionLine } from "./CaptionTrack";

export type IMessageStoryMessage = {
  /** "me" = outgoing blue bubble (right), "other" = incoming gray (left), "system" = centered gray text. */
  sender: "me" | "other" | "system";
  text: string;
  /** Seconds of elapsed time between the PREVIOUS message appearing and this one. */
  delay: number;
  /** If true, this bubble gets the gut-punch scale-pop + glow treatment. */
  emphasis?: boolean;
};

export type IMessageStoryProps = {
  contactName: string;
  messages: IMessageStoryMessage[];
  /**
   * Optional word-timed captions, relative to this segment's local 0.
   * Rendered at the lower third by CaptionTrack for muted-viewer retention.
   */
  captions?: CaptionLine[];
};

const IOS_BLUE = "#0A84FF"; // iMessage blue dark-mode
const OTHER_GRAY = "#262628"; // iMessage other bubble dark-mode
const SYSTEM_GRAY = "#8E8E93";
const TOP_BAR_HEIGHT = 180;

// Font stack matches iOS SF Pro cascade
const SF_STACK =
  "'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', 'Arial', sans-serif";

const StatusBar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 56,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 48px",
      color: "white",
      fontFamily: SF_STACK,
      fontWeight: 600,
      fontSize: 28,
      letterSpacing: "-0.01em",
      zIndex: 10,
    }}
  >
    <div>9:41</div>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {/* Signal dots */}
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6 + i * 2,
              borderRadius: 1.5,
              background: "white",
            }}
          />
        ))}
      </div>
      {/* Battery */}
      <div
        style={{
          width: 40,
          height: 20,
          border: "2px solid white",
          borderRadius: 5,
          padding: 2,
          position: "relative",
        }}
      >
        <div
          style={{
            width: "80%",
            height: "100%",
            background: "white",
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  </div>
);

const ContactHeader: React.FC<{ name: string }> = ({ name }) => (
  <div
    style={{
      position: "absolute",
      top: 56,
      left: 0,
      right: 0,
      height: TOP_BAR_HEIGHT - 56,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      zIndex: 10,
    }}
  >
    {/* Profile circle with initial */}
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: "#3A3A3C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: SF_STACK,
        fontWeight: 600,
        fontSize: 30,
        marginBottom: 6,
      }}
    >
      {name[0]?.toUpperCase() || "?"}
    </div>
    {/* Name + > */}
    <div
      style={{
        color: "white",
        fontFamily: SF_STACK,
        fontSize: 20,
        fontWeight: 400,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {name}
      <span style={{ color: SYSTEM_GRAY, fontSize: 18 }}>›</span>
    </div>
  </div>
);

const BackChevron: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 72,
      left: 36,
      color: IOS_BLUE,
      fontFamily: SF_STACK,
      fontSize: 48,
      fontWeight: 300,
      lineHeight: 1,
      zIndex: 11,
    }}
  >
    ‹
  </div>
);

// Small triangle tail for bubble
const BubbleTail: React.FC<{ side: "left" | "right"; color: string }> = ({
  side,
  color,
}) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 16 16"
    style={{
      position: "absolute",
      bottom: 0,
      [side]: -6,
      pointerEvents: "none",
    }}
  >
    {side === "right" ? (
      <path d="M 0 16 Q 14 16 16 0 Q 14 14 0 14 Z" fill={color} />
    ) : (
      <path d="M 16 16 Q 2 16 0 0 Q 2 14 16 14 Z" fill={color} />
    )}
  </svg>
);

const TypingIndicator: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const t = (frame / fps) % 1.2;
  const dotOpacity = (phase: number) => {
    const local = (t + phase) % 1.2;
    return local < 0.6 ? 0.3 + local * 1.1 : 0.3 + (1.2 - local) * 1.1;
  };
  return (
    <div
      style={{
        alignSelf: "flex-start",
        background: OTHER_GRAY,
        borderRadius: 22,
        padding: "14px 20px",
        display: "flex",
        gap: 6,
        marginLeft: 18,
        marginBottom: 12,
        position: "relative",
      }}
    >
      {[0, 0.4, 0.8].map((phase, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "white",
            opacity: dotOpacity(phase),
          }}
        />
      ))}
      <BubbleTail side="left" color={OTHER_GRAY} />
    </div>
  );
};

type BubbleState = {
  msg: IMessageStoryMessage;
  appearFrame: number;
  showTypingFrom: number | null; // null if no typing indicator
};

export const IMessageStory: React.FC<IMessageStoryProps> = ({
  contactName,
  messages,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Build per-message appear frames with typing indicator for incoming bubbles
  const TYPING_DUR_FRAMES = Math.round(fps * 0.35); // 0.35s
  const bubbles: BubbleState[] = [];
  let cursorFrame = Math.round(fps * 0.1); // brief settle at start
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDelayFrames = Math.round(msg.delay * fps);
    let showTypingFrom: number | null = null;
    if (msg.sender === "other" && i > 0) {
      showTypingFrom = cursorFrame;
      cursorFrame += TYPING_DUR_FRAMES;
    }
    bubbles.push({ msg, appearFrame: cursorFrame, showTypingFrom });
    cursorFrame += msgDelayFrames;
  }

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: SF_STACK }}>
      <StatusBar />
      <BackChevron />
      <ContactHeader name={contactName} />

      {/* V24: Messages container — bigger, bolder, fills the screen.
          Bottom padding dropped from 460 → 240 so bubbles run almost down
          to TikTok's UI band. Bubbles ARE the captions now (no separate
          caption ribbon on the story segment) so we can use the full
          vertical real estate. Messages area = y 220 → 1680. */}
      <div
        style={{
          position: "absolute",
          top: TOP_BAR_HEIGHT + 40,
          left: 0,
          right: 0,
          bottom: 240,
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        {bubbles.map((b, i) => {
          const { msg, appearFrame, showTypingFrom } = b;
          const isMe = msg.sender === "me";
          const isSys = msg.sender === "system";

          // Typing indicator visibility
          const typingVisible =
            showTypingFrom !== null &&
            frame >= showTypingFrom &&
            frame < appearFrame;

          // Bubble spring-in
          const springVal = spring({
            frame: frame - appearFrame,
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });
          const bubbleScale = isSys ? 1.0 : 0.85 + springVal * 0.15;
          const bubbleOpacity = interpolate(
            frame,
            [appearFrame, appearFrame + 6],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const bubbleY = interpolate(
            frame,
            [appearFrame, appearFrame + 10],
            [40, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          );

          // V24: Emphasis pop — bigger (1.0 → 1.18) since bubbles are larger
          // and the extra punch sells the gut-punch ALL CAPS line.
          let emphasisScale = 1.0;
          let emphasisGlow = 0;
          if (msg.emphasis && !isSys) {
            const popStart = appearFrame + 8;
            emphasisScale = interpolate(
              frame,
              [popStart, popStart + 6, popStart + 14, popStart + 26],
              [1.0, 1.18, 1.04, 1.0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            emphasisGlow = interpolate(
              frame,
              [popStart, popStart + 8, popStart + 22],
              [0, 0.7, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
          }

          // Skip rendering bubbles that haven't appeared yet
          if (frame < appearFrame && !typingVisible) return null;

          if (typingVisible) {
            return (
              <TypingIndicator key={`typing-${i}`} frame={frame} fps={fps} />
            );
          }

          // System message (centered gray text — V24 bumped to 36px)
          if (isSys) {
            return (
              <div
                key={i}
                style={{
                  alignSelf: "center",
                  color: SYSTEM_GRAY,
                  fontSize: 36,
                  fontWeight: 500,
                  padding: "16px 0",
                  opacity: bubbleOpacity,
                  transform: `translateY(${bubbleY}px)`,
                }}
              >
                {msg.text}
              </div>
            );
          }

          // Consecutive-sender check for tighter spacing
          const prev = bubbles[i - 1];
          const sameSender = prev && prev.msg.sender === msg.sender;
          const marginTop = sameSender ? 2 : 12;

          return (
            <div
              key={i}
              style={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                // V24: bubbles get 86% of the screen width (was 75%) so they
                // visually dominate. Combined with bottom: 240 above, this
                // means bubbles fill almost the whole screen — exactly what
                // a phone screenshot looks like.
                maxWidth: "86%",
                marginTop,
                position: "relative",
                opacity: bubbleOpacity,
                transform: `translateY(${bubbleY}px) scale(${bubbleScale * emphasisScale})`,
                transformOrigin: isMe ? "right bottom" : "left bottom",
              }}
            >
              {/* Emphasis glow — V24 stronger because the bubble is bigger */}
              {msg.emphasis && emphasisGlow > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: -22,
                    borderRadius: 40,
                    background: isMe
                      ? `radial-gradient(ellipse, rgba(10,132,255,${emphasisGlow * 0.75}) 0%, transparent 70%)`
                      : `radial-gradient(ellipse, rgba(255,255,255,${emphasisGlow * 0.4}) 0%, transparent 70%)`,
                    filter: "blur(28px)",
                    pointerEvents: "none",
                  }}
                />
              )}

              <div
                style={{
                  background: isMe ? IOS_BLUE : OTHER_GRAY,
                  color: "white",
                  // V24 bubble — chunkier, bigger, takes most of the screen.
                  // fontSize 60 (was 40), padding 24x32 (was 16x22), radius 32
                  // (was 26). Emphasis bumps to 700 weight to feel like the
                  // viewer just read a screenshot they'd actually share.
                  borderRadius: 32,
                  padding: "24px 32px",
                  fontSize: 60,
                  lineHeight: 1.18,
                  fontWeight: msg.emphasis ? 700 : 500,
                  letterSpacing: msg.emphasis ? "0" : "-0.01em",
                  position: "relative",
                  wordBreak: "break-word",
                }}
              >
                {msg.text}
                <BubbleTail
                  side={isMe ? "right" : "left"}
                  color={isMe ? IOS_BLUE : OTHER_GRAY}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* V24: NO caption ribbon on the story segment. The bubbles ARE the
          captions — bigger, bolder, fill most of the screen. CaptionTrack
          would otherwise overlap the larger bubbles AND fight the close CTA
          for attention. Pipeline passes captions=[] for this segment. */}

      {/* Opening whip-flash — 4 frames of white fading out on the cut from
          the kinetic hook. Mirrors the hook's closing flash so the hard
          cut feels like a whip-pan rather than a dead splice. */}
      {(() => {
        const flashOp = interpolate(frame, [0, 2, 6], [0.55, 0.25, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (flashOp <= 0) return null;
        return (
          <AbsoluteFill
            style={{
              background: "white",
              opacity: flashOp,
              pointerEvents: "none",
              zIndex: 10000,
            }}
          />
        );
      })()}

      {/* Closing riser-synced flash — 5 frames of soft white in the last
          0.2s so the cut INTO the app demo has its own punch. */}
      {(() => {
        const flashStart = durationInFrames - Math.round(fps * 0.2);
        const flashOp = interpolate(
          frame,
          [flashStart, flashStart + 3, durationInFrames],
          [0, 0.4, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        if (flashOp <= 0) return null;
        return (
          <AbsoluteFill
            style={{
              background: "white",
              opacity: flashOp,
              pointerEvents: "none",
              zIndex: 10000,
            }}
          />
        );
      })()}
    </AbsoluteFill>
  );
};
