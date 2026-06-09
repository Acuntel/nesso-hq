import React from "react";
import { AbsoluteFill } from "remotion";
import { FIRE, MONO, SANS, W, H } from "./theme";
import {
  BeatInfo,
  Bloom,
  DotGrid,
  Icon,
  ease,
  easeInOut,
  ipl,
} from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
//  RESTORATION ACT — text → clean lead → connected pipeline → money payoff.
//  A persistent copper "thread" follows the lead so you SEE it's one record.
// ════════════════════════════════════════════════════════════════════════════

export const RPhone: React.FC<{ frame: number; children: React.ReactNode }> = ({
  frame,
  children,
}) => (
  <AbsoluteFill
    style={{
      background: "#0A0E14",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <DotGrid color={FIRE.copper} opacity={0.18} frame={frame} />
    <Bloom color="rgba(240,116,42,0.28)" />
    <div
      style={{
        width: 820,
        height: 1560,
        borderRadius: 74,
        background: "#0E1621",
        border: "12px solid #1b2a3a",
        boxShadow: "0 40px 130px rgba(0,0,0,0.8)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          height: 128,
          background: "#17212B",
          display: "flex",
          alignItems: "center",
          padding: "0 38px",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: FIRE.copper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="bot" size={40} color="#fff" />
        </div>
        <div>
          <div
            style={{
              fontFamily: SANS,
              color: "#fff",
              fontWeight: 700,
              fontSize: 32,
            }}
          >
            Auto-assistant
          </div>
          <div style={{ fontFamily: SANS, color: FIRE.emerald, fontSize: 22 }}>
            ● live
          </div>
        </div>
      </div>
      <div style={{ padding: 36, position: "relative" }}>{children}</div>
    </div>
  </AbsoluteFill>
);

export const MSG =
  "hey its john my basement flooded last nite 312-555-1234 can someone come thurs??";

// RESTO_TEXT — the panicked text arrives
export const RestoText: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const typeP = ipl(bi.localF, 8, bi.durF * 0.78, 0, 1);
  return (
    <RPhone frame={frame}>
      <div
        style={{
          maxWidth: "90%",
          background: "#2B5278",
          color: "#fff",
          borderRadius: "26px 26px 26px 6px",
          padding: "26px 30px",
          fontFamily: SANS,
          fontSize: 34,
          lineHeight: 1.4,
        }}
      >
        {MSG.slice(0, Math.floor(MSG.length * typeP))}
        {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
      </div>
    </RPhone>
  );
};

// RESTO_LEAD — scan line over the text, then the clean lead card materializes
export const RestoLead: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const scanP = ipl(bi.localF, 0, bi.durF * 0.3, 0, 1);
  const a = ipl(bi.localF, bi.durF * 0.26, bi.durF * 0.5, 0, 1, ease);
  const fields: [string, string, string?][] = [
    ["Name", "John S."],
    ["Phone", "312-555-1234"],
    ["Job", "Water — flooded basement", "droplet"],
    ["When", "Thursday"],
  ];
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(bi.localF / 6));
  return (
    <RPhone frame={frame}>
      <div
        style={{
          maxWidth: "90%",
          background: "#2B5278",
          color: "#fff",
          borderRadius: "26px 26px 26px 6px",
          padding: "22px 26px",
          fontFamily: SANS,
          fontSize: 27,
          lineHeight: 1.35,
          position: "relative",
          marginBottom: 24,
        }}
      >
        {MSG}
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            top: 20 + scanP * 110,
            height: 4,
            background: `linear-gradient(90deg,transparent,${FIRE.copperHi},transparent)`,
            boxShadow: `0 0 22px ${FIRE.copper}`,
            opacity: scanP < 1 ? 1 : 0,
          }}
        />
      </div>
      <div
        style={{
          background: "#101722",
          border: `2px solid ${FIRE.copper}`,
          borderRadius: 24,
          padding: 34,
          opacity: a,
          transform: `scale(${0.92 + a * 0.08})`,
          boxShadow: `0 0 ${40 * pulse}px ${FIRE.copper}66`,
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 24,
            fontWeight: 800,
            color: FIRE.emerald,
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          ✓ NEW LEAD
        </div>
        {fields.map((f, i) => {
          const fa = ipl(
            bi.localF,
            bi.durF * 0.3 + i * 4,
            bi.durF * 0.3 + i * 4 + 8,
            0,
            1,
            ease,
          );
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 14,
                opacity: fa,
              }}
            >
              <div
                style={{
                  width: 110,
                  fontFamily: SANS,
                  fontSize: 24,
                  color: FIRE.soft,
                }}
              >
                {f[0]}
              </div>
              <div
                style={{
                  fontFamily: i === 1 ? MONO : SANS,
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {f[2] && <Icon name={f[2]} size={26} color={FIRE.info} />}
                {f[1]}
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            right: -10,
            top: "50%",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: FIRE.copper,
            boxShadow: `0 0 ${20 * pulse}px ${FIRE.copper}`,
            opacity: a,
          }}
        />
      </div>
    </RPhone>
  );
};

// RESTO_PIPE — one lead connected across pipeline + contacts + dashboard
export const RestoPipe: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const cols = ["New call", "Followed up", "Sent a price", "Got the job"];
  const colW = 232,
    gap = 18,
    x0 = 70,
    topY = 250;
  const travel = ipl(bi.localF, 0.18 * bi.durF, 0.8 * bi.durF, 0, 3, easeInOut);
  const stage = Math.min(3, Math.round(travel));
  const cardX = x0 + travel * (colW + gap);
  const cardY = topY + 70;
  const won = ipl(bi.localF, 0.78 * bi.durF, 0.9 * bi.durF, 0, 1, ease);
  const threadC = won > 0.3 ? FIRE.emerald : FIRE.copper;
  const enter = ipl(bi.localF, 0, 12, 0, 1, ease);
  const contactsPt = { x: 960, y: 470 };
  const dashPt = { x: 540, y: 1160 };
  const cardPt = { x: cardX + (colW - 28) / 2, y: cardY + 60 };
  return (
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg,#150d06,#0b0805)" }}
    >
      <DotGrid color={FIRE.copper} opacity={0.22} frame={frame} />
      {/* board */}
      <div
        style={{
          position: "absolute",
          top: topY,
          left: x0,
          display: "flex",
          gap,
          opacity: enter,
        }}
      >
        {cols.map((c, i) => (
          <div
            key={i}
            style={{
              width: colW,
              minHeight: 420,
              background:
                i === stage ? `${FIRE.copper}1f` : "rgba(255,255,255,0.03)",
              border: `1px solid ${i === stage ? FIRE.copper : FIRE.border}`,
              borderRadius: 16,
              padding: 14,
              boxShadow: i === stage ? `0 0 26px ${FIRE.copper}44` : "none",
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontSize: 22,
                fontWeight: 700,
                color: i === 3 ? FIRE.emerald : FIRE.soft,
                textAlign: "center",
              }}
            >
              {c}
            </div>
          </div>
        ))}
      </div>
      {/* contacts chip (right) */}
      <div
        style={{
          position: "absolute",
          left: contactsPt.x - 6,
          top: contactsPt.y - 50,
          width: 110,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${won > 0.3 ? FIRE.emerald : FIRE.copper}`,
          borderRadius: 14,
          padding: 14,
          textAlign: "center",
          opacity: enter,
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 16, color: FIRE.soft }}>
          Contacts
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `${FIRE.copper}33`,
            color: FIRE.copperHi,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "8px auto",
            fontFamily: SANS,
            fontWeight: 800,
          }}
        >
          J
        </div>
        <div style={{ fontFamily: SANS, fontSize: 16, color: "#fff" }}>
          John S. {won > 0.3 ? "✓" : ""}
        </div>
      </div>
      {/* dashboard counter (bottom) */}
      <div
        style={{
          position: "absolute",
          left: dashPt.x - 150,
          top: dashPt.y - 30,
          width: 300,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${FIRE.border}`,
          borderRadius: 14,
          padding: "14px 20px",
          textAlign: "center",
          opacity: enter,
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 16, color: FIRE.soft }}>
          Dashboard · jobs
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 800,
            color: won > 0.3 ? FIRE.emerald : "#fff",
          }}
        >
          {38 + (won > 0.3 ? 1 : 0)}
        </div>
      </div>
      {/* the persistent copper THREAD: card → contacts, card → dashboard */}
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <path
          d={`M ${cardPt.x} ${cardPt.y} Q ${(cardPt.x + contactsPt.x) / 2} ${cardPt.y - 80} ${contactsPt.x} ${contactsPt.y}`}
          fill="none"
          stroke={threadC}
          strokeWidth="3"
          opacity={enter * 0.8}
          style={{ filter: `drop-shadow(0 0 6px ${threadC})` }}
        />
        <path
          d={`M ${cardPt.x} ${cardPt.y} Q ${cardPt.x} ${(cardPt.y + dashPt.y) / 2} ${dashPt.x} ${dashPt.y}`}
          fill="none"
          stroke={threadC}
          strokeWidth="3"
          opacity={enter * 0.8}
          style={{ filter: `drop-shadow(0 0 6px ${threadC})` }}
        />
      </svg>
      {/* John's travelling lead card */}
      <div
        style={{
          position: "absolute",
          left: cardX,
          top: cardY,
          width: colW - 28,
          background: "#1c130c",
          border: `2px solid ${threadC}`,
          borderRadius: 14,
          padding: 16,
          boxShadow: `0 0 26px ${threadC}77`,
          opacity: enter,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 26,
            color: "#fff",
          }}
        >
          John S.
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 16,
            color: FIRE.soft,
            marginTop: 4,
          }}
        >
          312-555-1234
        </div>
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              background: `${FIRE.info}33`,
              color: FIRE.info,
              borderRadius: 8,
              padding: "4px 10px",
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="droplet" size={16} color={FIRE.info} /> Water
          </span>
        </div>
        {won > 0 && (
          <div
            style={{
              marginTop: 10,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 30,
              color: FIRE.emerald,
              opacity: won,
            }}
          >
            $14,200
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// RESTO_MONEY — the money is the sum of leads like John
export const RestoMoney: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const num = Math.round(612480 * ipl(bi.localF, 6, bi.durF * 0.7, 0, 1, ease));
  const glow = 0.7 + 0.3 * Math.abs(Math.sin(bi.localF / 7));
  const kpiA = (i: number) =>
    ipl(
      bi.localF,
      bi.durF * 0.55 + i * 4,
      bi.durF * 0.55 + i * 4 + 12,
      0,
      1,
      ease,
    );
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg,#150d06,#0b0805)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={FIRE.copper} opacity={0.26} frame={frame} />
      <Bloom color="rgba(240,116,42,0.4)" />
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 700,
            color: FIRE.soft,
          }}
        >
          Jobs sold this year
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 190,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: FIRE.copperHi,
            textShadow: `0 0 ${70 * glow}px ${FIRE.copper}`,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {"$" + num.toLocaleString("en-US")}
        </div>
        <div
          style={{
            display: "flex",
            gap: 22,
            marginTop: 44,
            justifyContent: "center",
          }}
        >
          {[
            ["Jobs won", "38"],
            ["Avg job", "$16,100"],
            ["New customers", "52"],
          ].map((k, i) => (
            <div
              key={i}
              style={{
                background: FIRE.card,
                border: `1px solid ${FIRE.border}`,
                borderRadius: 18,
                padding: "20px 28px",
                opacity: kpiA(i),
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: FIRE.soft,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {k[0]}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 46,
                  fontWeight: 800,
                  color: FIRE.text,
                }}
              >
                {k[1]}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: SANS,
            fontSize: 28,
            fontWeight: 600,
            color: FIRE.copperHi,
            opacity: ipl(bi.localF, bi.durF * 0.7, bi.durF * 0.85, 0, 1),
          }}
        >
          every dollar started as one text.
        </div>
      </div>
    </AbsoluteFill>
  );
};
