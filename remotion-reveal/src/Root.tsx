import { Composition } from "remotion";
import { NessoReveal } from "./NessoReveal";
import { HookText } from "./HookText";
import { LogoClose } from "./LogoClose";
import { IMessageStory } from "./IMessageStory";
import { AppDemo } from "./AppDemo";

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── V22: kinetic text hook (2.5s) ─────────────────────────────── */}
      <Composition
        id="HookText"
        component={HookText}
        durationInFrames={Math.round(2.5 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          line: "you haven't texted her in 4 months",
          subline: "",
          palette: "rose",
        }}
      />

      {/* ── V22: iMessage text story with bubble spring-ins (9s) ──────── */}
      <Composition
        id="IMessageStory"
        component={IMessageStory}
        durationInFrames={Math.round(9 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          contactName: "best friend",
          messages: [
            {
              sender: "me",
              text: "I counted. we haven't actually talked in 4 months.",
              delay: 1.4,
              emphasis: false,
            },
            {
              sender: "other",
              text: "that's not true",
              delay: 1.2,
              emphasis: false,
            },
            {
              sender: "me",
              text: "scroll up. every text for the last 16 weeks starts with me.",
              delay: 1.8,
              emphasis: true,
            },
            { sender: "other", text: "...", delay: 1.6, emphasis: false },
            {
              sender: "me",
              text: "we didn't fight. we just got busy. and it worked.",
              delay: 2.0,
              emphasis: true,
            },
            {
              sender: "system",
              text: "Read 1:47 AM",
              delay: 0.8,
              emphasis: false,
            },
          ],
          captions: [],
        }}
      />

      {/* ── V22: Nesso app click-through (8s) ──────────────────────────── */}
      <Composition
        id="AppDemo"
        component={AppDemo}
        durationInFrames={Math.round(8 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          personName: "Sarah",
          monthsSinceText: 4,
          aiMessage:
            "hey, been thinking about you — free this weekend to actually catch up?",
          logoUrl: "",
          captions: [],
        }}
      />

      {/* ── V22: logo close (2.5s) ─────────────────────────────────────── */}
      <Composition
        id="LogoClose"
        component={LogoClose}
        durationInFrames={Math.round(2.5 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          logoUrl: "",
          payoff: "it's free",
          handle: "nesso.ai",
          appStoreHint: "on the App Store",
          backdropUrl: "",
        }}
      />

      {/* ── Legacy V21 reveal kept for backward compat ─────────────────── */}
      <Composition
        id="NessoReveal"
        component={NessoReveal}
        durationInFrames={150}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          headline: "one notification would have changed everything",
          logoUrl: "",
          screenshotUrl: "",
          subtitleText: "it's free",
          handleText: "@nesso.app",
          accentColor: "#E8D4CF",
        }}
      />
    </>
  );
};
