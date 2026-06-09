import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import manifest from "./simply/beats.json";
import { FIRE, LAW, SANS } from "./simply/theme";
import {
  BeatInfo,
  Caption,
  Grain,
  ReelBeat,
  Trans,
  Vignette,
  useBeats,
} from "./simply/helpers";
import { HookMiracle } from "./simply/Hook";
import { PainOpenDesk, TurnToProof } from "./simply/Pain";
import { LawPdf, LawTour } from "./simply/Law";
import { Morph } from "./simply/Morph";
import { RestoLead, RestoMoney, RestoPipe, RestoText } from "./simply/Resto";
import { CloseCta, Founder, ProofTurn } from "./simply/Close";

// ════════════════════════════════════════════════════════════════════════════
//  SIMPLY SCALED — sales reel v8 (13 beats, 60.0s)
//  Flash-forward hook → compressed pain → law act (tour + contract AI) →
//  bright in-place morph → restoration act (text → lead → pipeline → money) →
//  proof → founder → CTA hold. Beat timing, VO, captions and SFX fractions all
//  come from ./simply/beats.json — the same manifest the Python pipeline reads.
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

const FIRE_KEYS = new Set([
  "HOOK_MIRACLE",
  "MORPH",
  "RESTO_TEXT",
  "RESTO_LEAD",
  "RESTO_PIPE",
  "RESTO_MONEY",
]);

type SceneProps = { frame: number; fps: number; bi: BeatInfo };

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
  const { fps } = useVideoConfig();
  const bts = beats && beats.length ? beats : buildDefaultBeats();
  const b = useBeats(bts, fps, frame);
  const activeKey = bts.find(
    (x) =>
      frame >= Math.round(x.start * fps) &&
      frame < Math.round((x.start + x.dur) * fps),
  )?.key;
  const accent =
    activeKey && FIRE_KEYS.has(activeKey) ? FIRE.copper : LAW.indigo;

  // Hard, early failure beats a silently-empty render: every beat the pipeline
  // sends must have a scene here, and vice versa.
  const SCENES: Record<string, (p: SceneProps) => React.ReactNode> = {
    HOOK_MIRACLE: (p) => <HookMiracle {...p} />,
    PAIN_DESK: (p) => <PainOpenDesk {...p} />,
    TURN_TO_PROOF: (p) => <TurnToProof {...p} />,
    LAW_TOUR: (p) => <LawTour {...p} />,
    LAW_PDF: (p) => <LawPdf {...p} />,
    MORPH: (p) => <Morph {...p} />,
    RESTO_TEXT: (p) => <RestoText {...p} />,
    RESTO_LEAD: (p) => <RestoLead {...p} />,
    RESTO_PIPE: (p) => <RestoPipe {...p} />,
    RESTO_MONEY: (p) => <RestoMoney {...p} />,
    PROOF_TURN: (p) => <ProofTurn {...p} />,
    FOUNDER: (p) => <Founder {...p} founderPhotoUrl={founderPhotoUrl} />,
    CLOSE_CTA: (p) => (
      <CloseCta
        {...p}
        brand={brand}
        phone={phone}
        email={email}
        offer={offer}
        logoUrl={logoUrl}
      />
    ),
  };
  const unknown = bts.filter((x) => !SCENES[x.key]).map((x) => x.key);
  if (unknown.length) {
    throw new Error(
      `SimplyScaledReel: beats with no scene: ${unknown.join(", ")} — ` +
        "did beats.json and the pipeline drift apart?",
    );
  }
  const lastKey = bts[bts.length - 1]?.key;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {bts.map((x) =>
        b[x.key].visible ? (
          <Trans key={x.key} bi={b[x.key]} last={x.key === lastKey}>
            {SCENES[x.key]({ frame, fps, bi: b[x.key] })}
          </Trans>
        ) : null,
      )}

      {/* small persistent wordmark (hidden during founder + close) */}
      {activeKey !== "CLOSE_CTA" && activeKey !== "FOUNDER" && (
        <div
          style={{
            position: "absolute",
            top: 58,
            right: 54,
            fontFamily: SANS,
            fontSize: 24,
            fontWeight: 800,
            color: "rgba(255,255,255,0.55)",
            zIndex: 7600,
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}
        >
          {brand}
        </div>
      )}

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
