import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { LAW, SANS } from "./theme";
import { BeatInfo, DotGrid, Icon, ease, ipl } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
//  PAIN ACT (v8: one compressed beat) — the analog grind, then the turn.
// ════════════════════════════════════════════════════════════════════════════
const PAPER = "#ece7db";
const PAINBG = "radial-gradient(ellipse at 50% 40%, #14110d 0%, #070605 100%)";

const PainVignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      boxShadow: "inset 0 0 340px 90px rgba(0,0,0,0.72)",
      pointerEvents: "none",
      zIndex: 50,
    }}
  />
);

// PAIN_DESK — desk establish (sticky notes / missed calls / spreadsheet)
export const PainOpenDesk: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const push = 1 + ipl(bi.localF, 0, bi.durF, 0, 0.05);
  const buzz = Math.sin(bi.localF * 1.1) * (bi.localF % 20 < 6 ? 2 : 0);
  return (
    <AbsoluteFill style={{ background: PAINBG }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${push})`,
          transformOrigin: "50% 45%",
          filter: "saturate(0.55) brightness(0.95)",
        }}
      >
        {/* paper contract */}
        <div
          style={{
            position: "absolute",
            top: 360,
            left: 120,
            width: 420,
            height: 540,
            background: PAPER,
            borderRadius: 6,
            transform: "rotate(-5deg)",
            boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
            padding: 30,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 24,
              color: "#2a2a2a",
            }}
          >
            AGREEMENT
          </div>
          {Array.from({ length: 9 }).map((_, k) => (
            <div
              key={k}
              style={{
                height: 9,
                background: "#c8c2b4",
                borderRadius: 2,
                marginTop: 16,
                width: `${90 - (k % 3) * 12}%`,
              }}
            />
          ))}
        </div>
        {/* sticky notes */}
        <div
          style={{
            position: "absolute",
            top: 300,
            left: 470,
            width: 180,
            height: 180,
            background: "#d9c84a",
            transform: "rotate(8deg)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
            fontFamily: "'Comic Sans MS',cursive",
            fontSize: 30,
            fontWeight: 700,
            color: "#4a4208",
            padding: 18,
          }}
        >
          call back!!
        </div>
        <div
          style={{
            position: "absolute",
            top: 980,
            left: 150,
            width: 150,
            height: 150,
            background: "#cbba3a",
            transform: "rotate(-12deg)",
            boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
            fontFamily: "'Comic Sans MS',cursive",
            fontSize: 26,
            fontWeight: 700,
            color: "#4a4208",
            padding: 16,
          }}
        >
          invoice??
        </div>
        {/* laptop with tabs */}
        <div
          style={{
            position: "absolute",
            top: 560,
            right: 110,
            width: 520,
            height: 360,
            background: "#0c0f15",
            borderRadius: 12,
            border: "8px solid #1a1a1a",
            boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 8,
              background: "#15181f",
            }}
          >
            {[0, 1, 2, 3, 4].map((t) => (
              <div
                key={t}
                style={{
                  flex: 1,
                  height: 26,
                  background: t === 0 ? "#272b34" : "#1b1e25",
                  borderRadius: 6,
                }}
              />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, k) => (
            <div
              key={k}
              style={{
                height: 10,
                background: "#262a33",
                borderRadius: 2,
                margin: "16px 20px",
              }}
            />
          ))}
        </div>
        {/* phone buzzing with missed calls */}
        <div
          style={{
            position: "absolute",
            top: 1020,
            right: 200,
            width: 220,
            height: 440,
            background: "#0a0a0c",
            borderRadius: 34,
            border: "6px solid #222",
            transform: `rotate(6deg) translate(${buzz}px,0)`,
            boxShadow: "0 24px 50px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              margin: "60px 16px 0",
              padding: "12px 14px",
              background: "rgba(248,113,113,0.16)",
              border: "1px solid rgba(248,113,113,0.5)",
              borderRadius: 10,
              fontFamily: SANS,
              fontSize: 19,
              fontWeight: 700,
              color: "#fca5a5",
            }}
          >
            Missed Call (7)
          </div>
        </div>
      </div>
      <PainVignette />
    </AbsoluteFill>
  );
};

// TURN_TO_PROOF — "You don't need more hours. / You need the right tools."
export const TurnToProof: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const snap = ipl(bi.localF, 4, 16, 0, 1, ease);
  const line1 = ipl(bi.localF, 2, 12, 0, 1, ease);
  const line2 = ipl(bi.localF, bi.durF * 0.38, bi.durF * 0.55, 0, 1, ease);
  const icons = ["doc", "phone", "mail", "inbox"];
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0c1020 0%, #05060a 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.2 * snap} frame={frame} />
      <div
        style={{
          width: 760,
          height: 460,
          background: LAW.bg2,
          borderRadius: 22,
          border: `1.5px solid ${LAW.indigo}66`,
          boxShadow: `0 0 70px ${LAW.indigo}44`,
          opacity: snap,
          transform: `scale(${0.82 + snap * 0.18})`,
          padding: 30,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((k) => (
            <div
              key={k}
              style={{
                flex: 1,
                height: 70,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${LAW.indigo}33`,
                borderRadius: 12,
              }}
            />
          ))}
        </div>
        <div
          style={{
            height: 180,
            background: `linear-gradient(180deg, ${LAW.indigo}22, transparent)`,
            borderRadius: 12,
          }}
        />
      </div>
      {/* the pain props become tool icons sliding into the app */}
      {icons.map((ic, i) => {
        const p = ipl(
          bi.localF,
          bi.durF * 0.5 + i * 2,
          bi.durF * 0.5 + i * 2 + 10,
          0,
          1,
          ease,
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ipl(p, 0, 1, 150 + i * 220, 520),
              top: ipl(p, 0, 1, 1300, 760),
              opacity: (1 - p) * snap,
            }}
          >
            <Icon name={ic} size={52} color={LAW.indigoHi} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          bottom: 380,
          left: 60,
          right: 60,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 46,
            color: "rgba(255,255,255,0.85)",
            opacity: line1,
          }}
        >
          You don't need more hours.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 50,
            color: "#fff",
            marginTop: 14,
            opacity: line2,
            textShadow: `0 0 26px ${LAW.indigo}`,
          }}
        >
          You need the right tools.{" "}
          <span style={{ color: LAW.indigoHi }}>So I built them.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
