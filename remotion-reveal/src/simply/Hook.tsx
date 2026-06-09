import React from "react";
import { AbsoluteFill } from "remotion";
import { FIRE, MONO, SANS } from "./theme";
import { BeatInfo, Bloom, DotGrid, Icon, ease, ipl } from "./helpers";
import { MSG } from "./Resto";

// ════════════════════════════════════════════════════════════════════════════
//  HOOK_MIRACLE — flash-forward cold open. Frame 1 is already mid-action:
//  the messy text → clean $14,200 lead, compressed to one breath. The full
//  journey replays as the payoff in the restoration act.
// ════════════════════════════════════════════════════════════════════════════

export const HookMiracle: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  // phases as fractions of the beat
  const typeP = ipl(bi.localF, 0, bi.durF * 0.3, 0.25, 1); // starts mid-typed
  const scanP = ipl(bi.localF, bi.durF * 0.32, bi.durF * 0.46, 0, 1);
  const cardIn = ipl(bi.localF, bi.durF * 0.44, bi.durF * 0.6, 0, 1, ease);
  const cashIn = ipl(bi.localF, bi.durF * 0.62, bi.durF * 0.74, 0, 1, ease);
  const flash = ipl(bi.localF, bi.durF * 0.44, bi.durF * 0.52, 0.35, 0);
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(bi.localF / 5));
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg,#150d06 0%,#0A0E14 100%)",
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <DotGrid color={FIRE.copper} opacity={0.24} frame={frame} />
      <Bloom color="rgba(240,116,42,0.38)" at="50% 10%" />
      {/* incoming messy text */}
      <div
        style={{
          marginTop: 250,
          width: 860,
          background: "#17212B",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 30,
          padding: "26px 30px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: FIRE.copper,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="phone" size={28} color="#fff" />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: FIRE.soft }}>
            Incoming text · 6:42 AM
          </div>
        </div>
        <div
          style={{
            background: "#2B5278",
            color: "#fff",
            borderRadius: "24px 24px 24px 6px",
            padding: "24px 28px",
            fontFamily: SANS,
            fontSize: 33,
            lineHeight: 1.4,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {MSG.slice(0, Math.floor(MSG.length * typeP))}
          {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
          {scanP > 0 && scanP < 1 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${scanP * 100}%`,
                height: 5,
                background: `linear-gradient(90deg,transparent,${FIRE.copperHi},transparent)`,
                boxShadow: `0 0 26px ${FIRE.copper}`,
              }}
            />
          )}
        </div>
      </div>
      {/* arrow of transformation */}
      <div
        style={{
          margin: "30px 0 6px",
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * -16}px)`,
        }}
      >
        <svg width="60" height="64" viewBox="0 0 24 26" fill="none">
          <path
            d="M12 2v18M5 14l7 7 7-7"
            stroke={FIRE.copperHi}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {/* the clean lead card, already won */}
      <div
        style={{
          width: 700,
          background: "#101722",
          border: `2px solid ${cashIn > 0.3 ? FIRE.emerald : FIRE.copper}`,
          borderRadius: 26,
          padding: "30px 36px",
          opacity: cardIn,
          transform: `scale(${0.9 + cardIn * 0.1})`,
          boxShadow: `0 0 ${46 * pulse}px ${
            cashIn > 0.3 ? FIRE.emerald : FIRE.copper
          }55`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 24,
              fontWeight: 800,
              color: FIRE.emerald,
              letterSpacing: "0.06em",
            }}
          >
            ✓ NEW LEAD
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 20,
              fontWeight: 700,
              color: FIRE.copperHi,
              background: `${FIRE.copper}22`,
              border: `1px solid ${FIRE.copper}66`,
              borderRadius: 10,
              padding: "4px 12px",
            }}
          >
            auto-captured
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 26,
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: 38,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            John S.
          </span>
          <span style={{ fontFamily: MONO, fontSize: 28, color: FIRE.soft }}>
            312-555-1234
          </span>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 22,
              fontWeight: 700,
              color: FIRE.info,
              background: `${FIRE.info}22`,
              borderRadius: 9,
              padding: "4px 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="droplet" size={20} color={FIRE.info} /> Water · Thursday
          </span>
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: SANS,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: FIRE.emerald,
            opacity: cashIn,
            transform: `translateY(${(1 - cashIn) * 18}px)`,
            textShadow: `0 0 38px ${FIRE.emerald}66`,
          }}
        >
          $14,200{" "}
          <span style={{ fontSize: 32, color: FIRE.soft }}>· job won</span>
        </div>
      </div>
      {/* materialize flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#fff",
          opacity: flash,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
