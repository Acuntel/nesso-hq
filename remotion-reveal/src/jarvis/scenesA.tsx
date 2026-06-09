import React from "react";
import { AbsoluteFill, spring } from "remotion";
import { FIRE, LAW, MONO, SANS, W } from "../simply/theme";
import { BeatInfo, Icon, ease, easeInOut, ipl } from "../simply/helpers";
import {
  BracketTarget,
  GlassPanel,
  HoloLine,
  MessageBubble,
  Odometer,
  ScanPass,
  Stamp,
  TypeOn,
  countUp,
} from "./kit";

// ════════════════════════════════════════════════════════════════════════════
//  ACT 1 — the system demos itself: live catch → reveal → pipeline → money →
//  nightwatch. All scenes full-bleed on the deep-navy void (DeepSpace shows
//  through transparent backgrounds via the camera world).
// ════════════════════════════════════════════════════════════════════════════

export type SceneProps = { frame: number; fps: number; bi: BeatInfo };

const CYAN = "#39D6FF";
const AMBER = "#E8A33D";
const GREEN = "#3DDC84";
const WARN = "#F5B945";

export const MSG =
  "hey its john my basement flooded everywhere idk what to do can u come look thursday??";

// HOOK_LIVE_CATCH — frame 1 is mid-action; $14,200 caption visible from frame 0
export const HookLiveCatch: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const typeP = ipl(bi.localF, 0, bi.durF * 0.3, 0.25, 1);
  const reticleF = bi.durF * 0.25;
  const scanP = ipl(bi.localF, bi.durF * 0.45, bi.durF * 0.62, 0, 1);
  const cardIn = ipl(bi.localF, bi.durF * 0.5, bi.durF * 0.66, 0, 1, ease);
  const wonF = bi.durF * 0.78;
  const fields: [string, string][] = [
    ["NAME", "John R."],
    ["ISSUE", "Water damage"],
    ["VISIT", "Thursday"],
  ];
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      {/* messy inbound text */}
      <div
        style={{ position: "absolute", top: 300, left: 90, width: W * 0.72 }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 22,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.5)",
            marginBottom: 14,
          }}
        >
          INBOUND · 6:42 AM
        </div>
        <MessageBubble accent={FIRE.copper}>
          {MSG.slice(0, Math.floor(MSG.length * typeP))}
          {typeP < 1 && <span style={{ opacity: 0.6 }}>▋</span>}
          <ScanPass p={scanP} accent={FIRE.copperHi} />
        </MessageBubble>
        <BracketTarget
          x={-20}
          y={40}
          w={W * 0.72 + 40}
          h={300}
          localF={bi.localF}
          startF={reticleF}
          accent={FIRE.copperHi}
        />
      </div>
      {/* clean lead card decoded beneath */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 90,
          right: 90,
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 30}px)`,
        }}
      >
        <GlassPanel accent={GREEN} style={{ padding: "34px 40px" }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: GREEN,
              marginBottom: 20,
            }}
          >
            ✓ LEAD EXTRACTED
          </div>
          <div style={{ display: "flex", gap: 44, flexWrap: "wrap" }}>
            {fields.map((f, i) => (
              <div key={i}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 19,
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.12em",
                  }}
                >
                  {f[0]}
                </div>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 36,
                    fontWeight: 700,
                    color: "#fff",
                    marginTop: 4,
                  }}
                >
                  <TypeOn
                    text={f[1]}
                    localF={bi.localF}
                    startF={bi.durF * 0.52 + i * 4}
                    mode="decode"
                    cursor={false}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 26,
              display: "flex",
              alignItems: "center",
              gap: 26,
            }}
          >
            <Stamp
              localF={bi.localF}
              startF={wonF}
              fps={fps}
              color={GREEN}
              style={{ fontSize: 56 }}
            >
              WON · $
              {countUp(
                (bi.localF - wonF) / (bi.durF * 0.16),
                14200,
              ).toLocaleString("en-US")}
            </Stamp>
          </div>
        </GlassPanel>
      </div>
    </AbsoluteFill>
  );
};

// NARRATOR_REVEAL — won card docks; the system identifies itself
export const NarratorReveal: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const dock = ipl(bi.localF, 0, 12, 0, 1, ease);
  const line2F = bi.durF * 0.5;
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      {/* continuity: the won card shrinks into a right-rail slot */}
      <div
        style={{
          position: "absolute",
          left: 90 + dock * 620,
          top: 360 + dock * 60,
          width: 900 * (1 - dock * 0.7),
          opacity: 1 - dock * 0.45,
        }}
      >
        <GlassPanel accent={GREEN} style={{ padding: 24 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 26 * (1 - dock * 0.3),
              color: GREEN,
              whiteSpace: "nowrap",
            }}
          >
            ✓ WON · $14,200 · John R.
          </div>
        </GlassPanel>
      </div>
      {dock > 0.95 && (
        <div
          style={{
            position: "absolute",
            left: 710 + 270,
            top: 420,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: GREEN,
            boxShadow: `0 0 18px ${GREEN}`,
          }}
        />
      )}
      {/* the typed thesis */}
      <div style={{ position: "absolute", left: 90, right: 90, top: 760 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 64,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.5,
          }}
        >
          <TypeOn
            text="I'M NOT A PERSON."
            localF={bi.localF}
            startF={bi.durF * 0.22}
            cps={1.1}
          />
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 64,
            fontWeight: 700,
            color: CYAN,
            lineHeight: 1.5,
            textShadow: `0 0 30px ${CYAN}55`,
            marginTop: 12,
          }}
        >
          <TypeOn
            text="I'M THE SOFTWARE."
            localF={bi.localF}
            startF={line2F}
            cps={1.1}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// PIPELINE_PROOF — system auto-drags John's card to WON; numbers cascade
export const PipelineProof: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const cols = ["NEW CALL", "SCHEDULED", "WON"];
  const colW = 300;
  const gap = 22;
  const x0 = 60;
  const topY = 430;
  const dragP = ipl(bi.localF, bi.durF * 0.18, bi.durF * 0.48, 0, 1, easeInOut);
  const dropped = bi.localF >= bi.durF * 0.48;
  const chipPop = spring({
    frame: Math.max(0, bi.localF - bi.durF * 0.58),
    fps,
    config: { damping: 10, stiffness: 200 },
  });
  const floatP = ipl(bi.localF, bi.durF * 0.62, bi.durF * 0.8, 0, 1, ease);
  // bezier: lift then arc to WON column
  const fromX = x0 + 14;
  const toX = x0 + 2 * (colW + gap) + 14;
  const midY = topY + 90 - 80;
  const cardX = fromX + (toX - fromX) * dragP;
  const cardY =
    (1 - dragP) * (1 - dragP) * (topY + 90) +
    2 * (1 - dragP) * dragP * midY +
    dragP * dragP * (topY + 90);
  const ring = dropped
    ? ipl(bi.localF, bi.durF * 0.48, bi.durF * 0.58, 0, 1)
    : 0;
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      {/* revenue widget top-right that reacts after the drop */}
      <div style={{ position: "absolute", right: 70, top: 250 }}>
        <GlassPanel accent={AMBER} style={{ padding: "18px 26px" }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 18,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.1em",
            }}
          >
            REVENUE · YTD
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 40,
              fontWeight: 800,
              color: AMBER,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            $
            {(
              598280 +
              countUp((bi.localF - bi.durF * 0.66) / (bi.durF * 0.2), 14200)
            ).toLocaleString("en-US")}
          </div>
        </GlassPanel>
      </div>
      {/* floating +$14,200 chip */}
      {floatP > 0 && floatP < 1 && (
        <div
          style={{
            position: "absolute",
            left: toX + 100 + floatP * 380,
            top: topY - floatP * 240,
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 800,
            color: GREEN,
            opacity: 1 - floatP * 0.5,
          }}
        >
          +$14,200
        </div>
      )}
      {/* board */}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: topY,
          display: "flex",
          gap,
        }}
      >
        {cols.map((c, i) => (
          <GlassPanel
            key={i}
            accent={i === 2 ? GREEN : CYAN}
            style={{ width: colW, minHeight: 760, padding: 16 }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: i === 2 ? GREEN : "rgba(255,255,255,0.6)",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {c}
              {i === 2 && (
                <span
                  style={{
                    marginLeft: 10,
                    display: "inline-block",
                    transform: `scale(${1 + chipPop * 0.35})`,
                    color: GREEN,
                  }}
                >
                  {dropped && chipPop > 0.1 ? "39" : "38"}
                </span>
              )}
            </div>
            {Array.from({ length: i === 1 ? 4 : 3 }).map((_, k) => (
              <div
                key={k}
                style={{
                  height: 86,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  marginTop: 12,
                }}
              />
            ))}
          </GlassPanel>
        ))}
        {/* gradient slice hinting more columns */}
        <div
          style={{
            width: 90,
            minHeight: 760,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.04), transparent)",
            borderRadius: 20,
          }}
        />
      </div>
      {/* drop ring */}
      {ring > 0 && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: toX + 130 - (60 + ring * 80) / 2,
            top: topY + 130 - (60 + ring * 80) / 2,
            width: 60 + ring * 80,
            height: 60 + ring * 80,
            borderRadius: "50%",
            border: `2px solid ${GREEN}`,
            opacity: 1 - ring,
          }}
        />
      )}
      {/* John's travelling card — the system drags it, no cursor */}
      <div
        style={{
          position: "absolute",
          left: cardX,
          top: cardY,
          width: colW - 28,
          transform: `scale(${dragP > 0 && dragP < 1 ? 1.06 : 1}) rotate(${dragP > 0 && dragP < 1 ? 2 : 0}deg)`,
          boxShadow:
            dragP > 0 && dragP < 1 ? "0 24px 60px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <GlassPanel
          accent={dropped ? GREEN : FIRE.copper}
          style={{ padding: 18 }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 28,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            John R.
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 18,
              color: "rgba(255,255,255,0.55)",
              marginTop: 4,
            }}
          >
            water damage · THU
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: SANS,
              fontSize: 30,
              fontWeight: 800,
              color: dropped ? GREEN : FIRE.copperHi,
            }}
          >
            $14,200
          </div>
        </GlassPanel>
      </div>
    </AbsoluteFill>
  );
};

// MONEY_ODOMETER — the revenue widget is now the whole world
export const MoneyOdometer: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const lineP = ipl(bi.localF, bi.durF * 0.35, bi.durF * 0.75, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Odometer
            value="$612,480"
            localF={bi.localF}
            startF={4}
            fps={fps}
            fontSize={158}
            color={AMBER}
            glow={`${FIRE.copper}AA`}
          />
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            letterSpacing: "0.3em",
            color: "rgba(255,255,255,0.65)",
            marginTop: 28,
          }}
        >
          TRACKED THIS YEAR
        </div>
        <div
          style={{ marginTop: 40, display: "flex", justifyContent: "center" }}
        >
          <HoloLine
            points={[18, 24, 22, 31, 38, 35, 47, 55, 62, 71, 84, 100]}
            width={760}
            height={170}
            drawP={lineP}
            color={AMBER}
            frame={frame}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// NIGHTWATCH_3AM — the lights dim a step; the bot catches a lead at 03:07
export const Nightwatch: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const msgIn = ipl(bi.localF, bi.durF * 0.3, bi.durF * 0.45, 0, 1, ease);
  const parsed = bi.localF >= bi.durF * 0.7;
  const hb = bi.localF * 4;
  // simple ECG path segments repeating
  const ecg = "M0 30 L40 30 L52 30 L60 8 L68 48 L76 30 L130 30 L150 30";
  return (
    <AbsoluteFill
      style={{
        background: "rgba(2,4,10,0.55)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 880 }}>
        <GlassPanel accent={CYAN} style={{ padding: "36px 42px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 26,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: CYAN,
              }}
            >
              LEAD INTAKE // 24/7
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 30,
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              03:07:44
            </div>
          </div>
          {/* inbound message dot slides in, scan, parsed chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              height: 90,
              position: "relative",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `${FIRE.copper}33`,
                border: `1.5px solid ${FIRE.copper}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `translateX(${(1 - msgIn) * -240}px)`,
                opacity: msgIn,
              }}
            >
              <Icon name="phone" size={26} color={FIRE.copperHi} />
            </div>
            <div
              style={{
                flex: 1,
                fontFamily: MONO,
                fontSize: 26,
                color: parsed ? GREEN : "rgba(255,255,255,0.7)",
              }}
            >
              {parsed ? "LEAD PARSED → POSTED TO BOARD ✓" : "incoming text…"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              marginTop: 20,
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 24,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              OWNER: ASLEEP · BOT: ON
            </div>
            <svg
              width="150"
              height="60"
              viewBox="0 0 150 60"
              style={{ overflow: "visible" }}
            >
              <path
                d={ecg}
                fill="none"
                stroke={GREEN}
                strokeWidth="2.5"
                strokeDasharray="200"
                strokeDashoffset={200 - (hb % 200)}
                style={{ filter: `drop-shadow(0 0 6px ${GREEN})` }}
              />
            </svg>
          </div>
        </GlassPanel>
      </div>
    </AbsoluteFill>
  );
};
