import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import manifest from "./simply/beats.json";
import { FIRE, LAW, lerpHex } from "./simply/theme";
import {
  BeatInfo,
  Caption,
  Grain,
  ReelBeat,
  Vignette,
  useBeats,
} from "./simply/helpers";
import { CamScene, SpeedStreaks, useCamera } from "./jarvis/camera";
import { DeepSpace, HudFrame } from "./jarvis/hud";
import {
  HookLiveCatch,
  MoneyOdometer,
  NarratorReveal,
  Nightwatch,
  PipelineProof,
  type SceneProps,
} from "./jarvis/scenesA";
import {
  FleetCount,
  SiblingContractAi,
  SiblingLawOs,
  SiblingOutboundDuo,
  SiblingsPullback,
} from "./jarvis/scenesB";
import { BuiltMe, CtaHold, Maker, Offer, YourLeakScan } from "./jarvis/scenesC";

// ════════════════════════════════════════════════════════════════════════════
//  SIMPLY SCALED — sales reel v9 "THE SYSTEM SPEAKS" (15 beats, 60.0s)
//  The narrator IS the software. One continuous camera flythrough — zero cuts,
//  persistent living HUD. Beats/VO/captions/SFX come from ./simply/beats.json,
//  the same manifest the Python pipeline reads.
// ════════════════════════════════════════════════════════════════════════════

export type { ReelBeat };

export type SimplyScaledReelProps = {
  beats?: ReelBeat[];
  brand?: string;
  phone?: string;
  email?: string;
  offer?: string;
  logoUrl?: string;
  founderPhotoUrl?: string;
  lite?: boolean;
};

function buildDefaultBeats(): ReelBeat[] {
  let t = 0;
  return manifest.beats.map((b) => {
    const beat = { key: b.key, start: t, dur: b.minDur };
    t += b.minDur;
    return beat;
  });
}

const CAPTIONS: Record<string, { text: string; big: boolean }> = {};
for (const b of manifest.beats)
  CAPTIONS[b.key] = { text: b.caption, big: b.big };

// per-beat HUD/caption accent — the cockpit re-lights as the camera flies
const ACCENTS: Record<string, string> = {
  HOOK_LIVE_CATCH: FIRE.copper,
  NARRATOR_REVEAL: "#39D6FF",
  PIPELINE_PROOF: "#39D6FF",
  MONEY_ODOMETER: "#E8A33D",
  NIGHTWATCH_3AM: "#39D6FF",
  SIBLINGS_PULLBACK: "#39D6FF",
  SIBLING_LAW_OS: LAW.indigo,
  SIBLING_CONTRACT_AI: "#39D6FF",
  SIBLING_OUTBOUND_DUO: "#A78BFA",
  FLEET_COUNT: "#39D6FF",
  MAKER: "#E8A33D",
  BUILT_ME: "#39D6FF",
  YOUR_LEAK_SCAN: "#F5B945",
  OFFER: LAW.indigoHi,
  CTA_HOLD: LAW.indigoHi,
};

const MODULE_TAGS: Record<string, string> = {
  NARRATOR_REVEAL: "MODULE 00 // CORE",
  PIPELINE_PROOF: "MODULE 01 // PIPELINE",
  MONEY_ODOMETER: "MODULE 02 // REVENUE",
  NIGHTWATCH_3AM: "MODULE 03 // NIGHTWATCH",
  SIBLINGS_PULLBACK: "FLEET VIEW",
  SIBLING_LAW_OS: "MODULE 04 // PRACTICE OS",
  SIBLING_CONTRACT_AI: "MODULE 05 // CONTRACT INTEL",
  SIBLING_OUTBOUND_DUO: "MODULE 06 // OUTBOUND",
  FLEET_COUNT: "FLEET VIEW // ALL SYSTEMS",
  MAKER: "ROOT ACCESS // THE MAKER",
  BUILT_ME: "NEXT DEPLOY",
  YOUR_LEAK_SCAN: "NEXT DEPLOY // YOUR BUSINESS",
  OFFER: "MISSION OFFER",
  CTA_HOLD: "CONTACT",
};

export const SimplyScaledReel: React.FC<SimplyScaledReelProps> = ({
  beats,
  brand = "Simply Scaled",
  phone = "(847) 212-2142",
  email = "bradyschwartz25@gmail.com",
  offer = "Free 15-min teardown of where your money's leaking — no pitch.",
  logoUrl = "",
  founderPhotoUrl = "",
  lite = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const bts = beats && beats.length ? beats : buildDefaultBeats();
  const b = useBeats(bts, fps, frame);
  const cam = useCamera(bts, fps, frame);
  const activeKey = bts[cam.beatIdx]?.key ?? bts[0].key;
  const nextKey = bts[Math.min(cam.beatIdx + 1, bts.length - 1)].key;
  const accent = lerpHex(
    toHex(ACCENTS[activeKey] ?? "#39D6FF"),
    toHex(ACCENTS[nextKey] ?? "#39D6FF"),
    cam.burstP,
  );

  const SCENES: Record<string, (p: SceneProps) => React.ReactNode> = {
    HOOK_LIVE_CATCH: (p) => <HookLiveCatch {...p} />,
    NARRATOR_REVEAL: (p) => <NarratorReveal {...p} />,
    PIPELINE_PROOF: (p) => <PipelineProof {...p} />,
    MONEY_ODOMETER: (p) => <MoneyOdometer {...p} />,
    NIGHTWATCH_3AM: (p) => <Nightwatch {...p} />,
    SIBLINGS_PULLBACK: (p) => <SiblingsPullback {...p} />,
    SIBLING_LAW_OS: (p) => <SiblingLawOs {...p} />,
    SIBLING_CONTRACT_AI: (p) => <SiblingContractAi {...p} />,
    SIBLING_OUTBOUND_DUO: (p) => <SiblingOutboundDuo {...p} />,
    FLEET_COUNT: (p) => <FleetCount {...p} />,
    MAKER: (p) => <Maker {...p} founderPhotoUrl={founderPhotoUrl} />,
    BUILT_ME: (p) => <BuiltMe {...p} founderPhotoUrl={founderPhotoUrl} />,
    YOUR_LEAK_SCAN: (p) => <YourLeakScan {...p} />,
    OFFER: (p) => <Offer {...p} />,
    CTA_HOLD: (p) => <CtaHold {...p} />,
  };
  const unknown = bts.filter((x) => !SCENES[x.key]).map((x) => x.key);
  if (unknown.length) {
    throw new Error(
      `SimplyScaledReel: beats with no scene: ${unknown.join(", ")} — ` +
        "did beats.json and the pipeline drift apart?",
    );
  }

  // VO presence for the waveform envelope (manifest knows the lines)
  const voLine =
    (manifest.beats.find((x) => x.key === activeKey) as any)?.vo ?? "";
  const voActive =
    voLine.length > 0 &&
    (activeKey !== "CTA_HOLD" ? b[activeKey].p < 0.92 : b[activeKey].p < 0.72);

  // nightwatch beat frames for the mission-clock spin
  const nw = b.NIGHTWATCH_3AM
    ? { sF: b.NIGHTWATCH_3AM.sF, durF: b.NIGHTWATCH_3AM.durF }
    : null;

  return (
    <AbsoluteFill style={{ background: "#070B14" }}>
      <DeepSpace frame={frame} cam={cam} accent={accent} />

      {bts.map((x, i) => {
        // mount the scene's world only when the camera can see it (CamScene
        // also gates by distance; this guard avoids computing far scenes)
        const bi = b[x.key];
        const near = Math.abs(i - cam.beatIdx) <= 2;
        if (!near) return null;
        return (
          <CamScene
            key={x.key}
            i={i}
            cam={cam}
            moduleTag={MODULE_TAGS[x.key]}
            accent={accent}
          >
            {SCENES[x.key]({ frame, fps, bi })}
          </CamScene>
        );
      })}

      <SpeedStreaks vN={cam.vN} frame={frame} />

      <HudFrame
        frame={frame}
        cam={cam}
        accent={accent}
        activeKey={activeKey}
        voActive={voActive}
        nightwatch={nw}
        totalFrames={durationInFrames}
      />

      {activeKey && CAPTIONS[activeKey]?.text && (
        <Caption
          text={CAPTIONS[activeKey].text}
          localF={b[activeKey].localF}
          durF={b[activeKey].durF}
          fps={fps}
          accent={accent}
          big={CAPTIONS[activeKey].big}
        />
      )}

      <Vignette />
      {!lite && <Grain />}
    </AbsoluteFill>
  );
};

// ACCENTS may hold rgb() from theme constants; normalize to #hex for lerpHex
function toHex(c: string): string {
  if (c.startsWith("#")) return c;
  const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#39D6FF";
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((v) => parseInt(v, 10).toString(16).padStart(2, "0"))
      .join("")
  );
}
