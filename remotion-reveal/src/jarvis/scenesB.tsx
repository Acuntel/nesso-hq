import React from "react";
import { AbsoluteFill, random, spring } from "remotion";
import { FIRE, LAW, MONO, SANS, W, H } from "../simply/theme";
import { Icon, ease, ipl } from "../simply/helpers";
import { BracketTarget, GlassPanel, ScanPass, TypeOn, countUp } from "./kit";
import type { SceneProps } from "./scenesA";

// ════════════════════════════════════════════════════════════════════════════
//  ACT 2 — the siblings: constellation pivot → law OS → contract AI →
//  outbound duo → fleet count.
// ════════════════════════════════════════════════════════════════════════════

const CYAN = "#39D6FF";
const AMBER = "#E8A33D";
const GREEN = "#3DDC84";
const VIOLET = "#A78BFA";

// the 9 sibling nodes (mini system windows)
const NODES: {
  label: string;
  color: string;
  icon: string;
  x: number;
  y: number;
  s: number;
}[] = [
  {
    label: "PRACTICE OS",
    color: LAW.indigo,
    icon: "scale",
    x: 250,
    y: 560,
    s: 1.0,
  },
  { label: "CONTRACT AI", color: CYAN, icon: "doc", x: 700, y: 430, s: 0.9 },
  { label: "CALL AGENT", color: VIOLET, icon: "phone", x: 870, y: 740, s: 0.8 },
  { label: "EMAIL ENGINE", color: CYAN, icon: "mail", x: 160, y: 900, s: 0.75 },
  {
    label: "PROPERTY INTEL",
    color: GREEN,
    icon: "home",
    x: 540,
    y: 980,
    s: 0.85,
  },
  {
    label: "LEAD ENGINE",
    color: AMBER,
    icon: "inbox",
    x: 850,
    y: 1130,
    s: 0.7,
  },
  { label: "EXCHANGE", color: VIOLET, icon: "grid", x: 300, y: 1260, s: 0.65 },
  { label: "AI WEBSITES", color: CYAN, icon: "spark", x: 620, y: 1370, s: 0.7 },
  {
    label: "FIELD CRM",
    color: FIRE.copper,
    icon: "hardhat",
    x: 480,
    y: 700,
    s: 1.0,
  },
];

const Node: React.FC<{
  n: (typeof NODES)[number];
  lit: number;
  frame: number;
}> = ({ n, lit, frame }) => (
  <div
    style={{
      position: "absolute",
      left: n.x - 90 * n.s,
      top: n.y - 60 * n.s,
      width: 180 * n.s,
      height: 120 * n.s,
      borderRadius: 14,
      background: "rgba(255,255,255,0.04)",
      border: `1.5px solid ${n.color}${lit > 0.5 ? "CC" : "55"}`,
      boxShadow: lit > 0.5 ? `0 0 ${24 * n.s}px ${n.color}44` : "none",
      opacity: 0.6 + 0.4 * lit,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8 * n.s,
    }}
  >
    <Icon name={n.icon} size={34 * n.s} color={n.color} />
    <div
      style={{
        fontFamily: MONO,
        fontSize: 15 * n.s,
        letterSpacing: "0.1em",
        color: "rgba(255,255,255,0.75)",
      }}
    >
      {n.label}
    </div>
  </div>
);

const Constellation: React.FC<{
  frame: number;
  litP: number; // how many nodes are lit 0..1
  lineP: number; // connection draw progress
  orbit?: number; // degrees of slow orbit
  children?: React.ReactNode;
}> = ({ frame, litP, lineP, orbit = 0, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      transform: `rotate(${orbit}deg)`,
      transformOrigin: "50% 46%",
    }}
  >
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {NODES.map((n, i) => {
        const m = NODES[(i + 3) % NODES.length];
        const len = Math.hypot(m.x - n.x, m.y - n.y);
        return (
          <line
            key={i}
            x1={n.x}
            y1={n.y}
            x2={m.x}
            y2={m.y}
            stroke={CYAN}
            strokeWidth="1"
            opacity={0.25}
            strokeDasharray={len}
            strokeDashoffset={len * (1 - lineP)}
          />
        );
      })}
    </svg>
    {NODES.map((n, i) => (
      <Node
        key={i}
        n={n}
        lit={ipl(litP * NODES.length, i, i + 0.7, 0, 1)}
        frame={frame}
      />
    ))}
    {children}
  </div>
);

// SIBLINGS_PULLBACK — nightwatch panel shrinks into one node of a constellation
export const SiblingsPullback: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const shrink = ipl(bi.localF, 0, 12, 0, 1, ease);
  const litP = ipl(bi.localF, bi.durF * 0.25, bi.durF * 0.8, 0, 1);
  const lineP = ipl(bi.localF, bi.durF * 0.35, bi.durF * 0.9, 0, 1, ease);
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <Constellation frame={frame} litP={litP} lineP={lineP} />
      {/* continuity: the nightwatch panel shrinking into the FIELD CRM node */}
      {shrink < 1 && (
        <div
          style={{
            position: "absolute",
            left: 100 + shrink * (480 - 90 - 100),
            top: 500 + shrink * (700 - 60 - 500),
            width: 880 * (1 - shrink * 0.8),
            opacity: 1 - shrink * 0.6,
          }}
        >
          <GlassPanel accent={CYAN} style={{ padding: 20 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 22,
                color: CYAN,
                whiteSpace: "nowrap",
              }}
            >
              LEAD INTAKE // 24/7 ✓
            </div>
          </GlassPanel>
        </div>
      )}
    </AbsoluteFill>
  );
};

// SIBLING_LAW_OS — three rapid lock-ons: matters → invoices → trust ledger
export const SiblingLawOs: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const t1 = bi.durF * 0.35;
  const t2 = bi.durF * 0.55;
  const t3 = bi.durF * 0.78;
  const rows = [
    ["M-2041", "OPEN"],
    ["M-2039", "DISCOVERY"],
    ["M-2036", "OPEN"],
  ];
  return (
    <AbsoluteFill style={{ background: "rgba(8,11,20,0.5)" }}>
      <div
        style={{
          position: "absolute",
          top: 230,
          left: 70,
          fontFamily: MONO,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: LAW.indigoHi,
        }}
      >
        ▸ LIVE AT A CHICAGO LAW FIRM
      </div>
      {/* matters */}
      <div style={{ position: "absolute", top: 300, left: 70, width: 560 }}>
        <GlassPanel
          accent={LAW.indigo}
          localF={bi.localF}
          startF={2}
          style={{ padding: 24 }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 20,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.12em",
              marginBottom: 14,
            }}
          >
            MATTERS
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 4px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 24, color: "#fff" }}>
                {r[0]}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 18,
                  fontWeight: 700,
                  color: r[1] === "OPEN" ? GREEN : AMBER,
                  border: `1px solid ${r[1] === "OPEN" ? GREEN : AMBER}55`,
                  borderRadius: 7,
                  padding: "3px 10px",
                }}
              >
                {r[1]}
              </span>
            </div>
          ))}
        </GlassPanel>
        <BracketTarget
          x={-14}
          y={-14}
          w={588}
          h={300}
          localF={bi.localF}
          startF={t1}
          accent={LAW.indigoHi}
        />
      </div>
      {/* invoices */}
      <div style={{ position: "absolute", top: 700, right: 70, width: 480 }}>
        <GlassPanel
          accent={LAW.indigo}
          localF={bi.localF}
          startF={t1}
          style={{ padding: 24 }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 20,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.12em",
              marginBottom: 14,
            }}
          >
            INVOICES
          </div>
          {[
            ["INV-0042", "$8,400"],
            ["INV-0041", "$3,250"],
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 4px",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 22, color: "#fff" }}>
                {r[0]}
              </span>
              <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <b style={{ fontFamily: SANS, fontSize: 24, color: "#fff" }}>
                  {r[1]}
                </b>
                {bi.localF > t2 + 6 + i * 4 && (
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 17,
                      fontWeight: 700,
                      color: GREEN,
                    }}
                  >
                    PAID ✓
                  </span>
                )}
              </span>
            </div>
          ))}
        </GlassPanel>
        <BracketTarget
          x={-14}
          y={-14}
          w={508}
          h={220}
          localF={bi.localF}
          startF={t2}
          accent={LAW.indigoHi}
        />
      </div>
      {/* trust ledger — the holding lock-on */}
      <div style={{ position: "absolute", top: 1030, left: 70, right: 70 }}>
        <GlassPanel
          accent={LAW.indigo}
          localF={bi.localF}
          startF={t2}
          style={{ padding: 28 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 20,
                  color: LAW.indigoHi,
                  letterSpacing: "0.12em",
                }}
              >
                IOLTA TRUST LEDGER
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 42,
                  fontWeight: 800,
                  color: "#fff",
                  marginTop: 8,
                }}
              >
                $486,200
              </div>
            </div>
            {bi.localF > t3 + 8 && (
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 26,
                  fontWeight: 700,
                  color: GREEN,
                }}
              >
                RECONCILED ✓
              </div>
            )}
          </div>
        </GlassPanel>
        <BracketTarget
          x={-14}
          y={-14}
          w={W - 140 + 28}
          h={170}
          localF={bi.localF}
          startF={t3}
          accent={GREEN}
        />
      </div>
    </AbsoluteFill>
  );
};

// SIBLING_CONTRACT_AI — scan beam over a greeked agreement; verdict chips latch
export const SiblingContractAi: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const scanP = ipl(bi.localF, bi.durF * 0.25, bi.durF * 0.72, 0, 1);
  const docX = 90;
  const docW = W * 0.62;
  const flags = [
    { y: 480, label: "✓ BUYER NAME", color: GREEN, at: 0.42 },
    { y: 760, label: "✓ CLOSING DATE", color: GREEN, at: 0.55 },
    {
      y: 1120,
      label: "⚠ MISSING: SELLER SIGNATURE",
      color: "#F5B945",
      at: 0.72,
    },
  ];
  return (
    <AbsoluteFill style={{ background: "rgba(8,11,20,0.5)" }}>
      {/* greeked agreement page */}
      <div
        style={{
          position: "absolute",
          left: docX,
          top: 290,
          width: docW,
          height: 1050,
          background: "rgba(236,231,219,0.92)",
          borderRadius: 10,
          padding: 44,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 30,
            color: "#2a2a2a",
          }}
        >
          PURCHASE AGREEMENT
        </div>
        {Array.from({ length: 16 }).map((_, k) => (
          <div
            key={k}
            style={{
              height: 11,
              background: "#c8c2b4",
              borderRadius: 2,
              marginTop: 24,
              width: `${92 - (k % 4) * 9}%`,
            }}
          />
        ))}
        <div
          style={{
            marginTop: 40,
            width: "46%",
            height: 56,
            borderBottom: "3px solid #8a8474",
            fontFamily: SANS,
            fontSize: 20,
            color: "#8a8474",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          seller signature
        </div>
        <ScanPass p={scanP} accent={CYAN} tint="rgba(57,214,255,0.07)" />
      </div>
      {/* verdict chips latch as the beam crosses */}
      {flags.map((fl, i) => (
        <BracketTarget
          key={i}
          x={docX + 30}
          y={fl.y}
          w={docW - 60}
          h={56}
          localF={bi.localF}
          startF={bi.durF * fl.at}
          accent={fl.color}
          label={fl.label}
          labelColor={fl.color}
        />
      ))}
      {/* footer telemetry */}
      <div
        style={{
          position: "absolute",
          left: 90,
          bottom: 460,
          fontFamily: MONO,
          fontSize: 28,
          letterSpacing: "0.1em",
          color: CYAN,
        }}
      >
        <TypeOn
          text="~30 SECONDS · $0.04 / RUN · AWS BEDROCK"
          localF={bi.localF}
          startF={bi.durF * 0.78}
          cps={1.4}
        />
      </div>
    </AbsoluteFill>
  );
};

// SIBLING_OUTBOUND_DUO — live call waveform + email-draft grid
export const SiblingOutboundDuo: React.FC<SceneProps> = ({
  frame,
  fps,
  bi,
}) => {
  const drafts =
    187 + countUp((bi.localF - bi.durF * 0.5) / (bi.durF * 0.35), 13);
  const locked = bi.localF > bi.durF * 0.85;
  return (
    <AbsoluteFill style={{ background: "rgba(8,11,20,0.5)" }}>
      {/* top: outbound call */}
      <div style={{ position: "absolute", top: 280, left: 80, right: 80 }}>
        <GlassPanel
          accent={VIOLET}
          localF={bi.localF}
          startF={2}
          style={{ padding: 32 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 22,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: VIOLET,
              }}
            >
              OUTBOUND CALL · LIVE
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 20,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              HOME-DESIGN FIRM
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                border: `2px solid ${VIOLET}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 26px ${VIOLET}44`,
              }}
            >
              <Icon name="phone" size={38} color={VIOLET} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 80,
                flex: 1,
              }}
            >
              {Array.from({ length: 24 }).map((_, i) => {
                const s =
                  0.2 +
                  0.8 *
                    Math.abs(
                      Math.sin(0.4 * bi.localF + i * 0.9) *
                        Math.sin(0.13 * bi.localF + i * 0.31),
                    );
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 80,
                      background: VIOLET,
                      opacity: 0.45 + s * 0.55,
                      transform: `scaleY(${s})`,
                      borderRadius: 3,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div
            style={{
              marginTop: 22,
              fontFamily: MONO,
              fontSize: 26,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <TypeOn
              text='"Hi — calling about your build timeline…"'
              localF={bi.localF}
              startF={bi.durF * 0.18}
              cps={0.9}
            />
          </div>
        </GlassPanel>
      </div>
      {/* bottom: email drafts grid */}
      <div style={{ position: "absolute", top: 800, left: 80, right: 80 }}>
        <GlassPanel
          accent={CYAN}
          localF={bi.localF}
          startF={bi.durF * 0.3}
          style={{ padding: 32 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: CYAN,
              }}
            >
              EMAIL ENGINE
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 24,
                fontVariantNumeric: "tabular-nums",
                color: locked ? GREEN : "#fff",
              }}
            >
              DRAFTS TODAY {Math.min(200, drafts)}
              {locked ? " ✓" : ""}
            </span>
          </div>
          {Array.from({ length: 6 }).map((_, k) => {
            const a = ipl(
              bi.localF,
              bi.durF * 0.4 + k * 2,
              bi.durF * 0.4 + k * 2 + 5,
              0,
              1,
            );
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  marginTop: 14,
                  opacity: a,
                }}
              >
                <Icon name="mail" size={20} color="rgba(255,255,255,0.4)" />
                <div
                  style={{
                    flex: 1,
                    height: 12,
                    background: "rgba(255,255,255,0.16)",
                    borderRadius: 3,
                    width: `${90 - (k % 3) * 14}%`,
                  }}
                />
                <span style={{ fontFamily: MONO, fontSize: 16, color: GREEN }}>
                  DRAFT
                </span>
              </div>
            );
          })}
        </GlassPanel>
      </div>
    </AbsoluteFill>
  );
};

// FLEET_COUNT — widest shot: all nodes lit, giant 1→14 count
export const FleetCount: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const orbit = 4 * Math.sin((frame / 240) * Math.PI * 2);
  const n = Math.max(
    1,
    Math.min(
      14,
      Math.floor(ipl(bi.localF, bi.durF * 0.2, bi.durF * 0.55, 1, 14.99)),
    ),
  );
  const stampS = spring({
    frame: Math.max(0, bi.localF - bi.durF * 0.68),
    fps,
    config: { damping: 11, stiffness: 170 },
  });
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <div style={{ opacity: 0.55 }}>
        <Constellation frame={frame} litP={1} lineP={1} orbit={orbit} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 230,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 70px ${CYAN}66`,
            }}
          >
            {n}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "0.24em",
              color: CYAN,
              marginTop: 8,
            }}
          >
            SYSTEMS
          </div>
          <div
            style={{
              marginTop: 34,
              fontFamily: SANS,
              fontSize: 42,
              fontWeight: 800,
              color: "#fff",
              transform: `scale(${1.3 - 0.3 * stampS})`,
              opacity: bi.localF > bi.durF * 0.68 ? 1 : 0,
            }}
          >
            12 MONTHS · 1 BUILDER
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
