import React from "react";
import { AbsoluteFill } from "remotion";
import { FIRE, MULE, SANS, lerpHex } from "./theme";
import { BeatInfo, Bloom, DotGrid, Icon, easeInOut, ipl } from "./helpers";
import { NAV, SIDE_W, navRowY } from "./Law";

// ════════════════════════════════════════════════════════════════════════════
//  MORPH — the SAME app recolors indigo→copper and relabels in place, on a
//  fully visible dashboard (v8: bright, content stays on screen the whole way).
// ════════════════════════════════════════════════════════════════════════════
const REST_NAV: { label: string; icon: string }[] = [
  { label: "Leads", icon: "inbox" },
  { label: "Pipeline", icon: "grid" },
  { label: "Contacts", icon: "users" },
  { label: "Dashboard", icon: "clock" },
];
const ROW_H = 58;

// KPI tiles that recolor + relabel mid-beat — content never leaves the frame.
const MORPH_KPIS: [string, string, string, string][] = [
  // [law label, law value, resto label, resto value]
  ["Unbilled", "$48,200", "Leads in", "31"],
  ["Unpaid", "$112,750", "Jobs live", "12"],
  ["Overdue", "$19,400", "Sold MTD", "$84,300"],
  ["Collected", "$284,900", "Sold YTD", "$612,480"],
];

export const Morph: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const m = ipl(bi.localF, 0, bi.durF * 0.8, 0, 1, easeInOut);
  const c = lerpHex("#6366F1", "#F0742A", m);
  const lawOut = ipl(m, 0.2, 0.5, 1, 0);
  const restIn = ipl(m, 0.42, 0.72, 0, 1);
  return (
    <AbsoluteFill style={{ background: lerpHex("#0c1120", "#1a0f07", m) }}>
      <DotGrid color={c} opacity={0.22} frame={frame} />
      <Bloom color={`${lerpHex("#6366F1", "#F0742A", m)}44`} at="50% 20%" />
      {/* sidebar — stays mounted, recolors + relabels in place */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDE_W,
          background: lerpHex("#0a0e19", "#140b06", m),
          borderRight: `1px solid ${c}33`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "44px 22px 0",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: c,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 22,
              boxShadow: `0 0 18px ${c}88`,
            }}
          >
            ◆
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 26,
              color: "#fff",
            }}
          >
            <span style={{ position: "absolute", opacity: lawOut }}>
              Practice OS
            </span>
            <span style={{ opacity: restIn }}>Job Board</span>
          </div>
        </div>
        {/* rows 0-3: crossfade law→restoration label in place */}
        {NAV.slice(0, 4).map((n, i) => {
          const y = navRowY(i);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 12,
                top: y,
                width: SIDE_W - 24,
                height: ROW_H - 8,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                borderRadius: 12,
                background: i === 0 ? `${c}26` : "transparent",
                fontFamily: SANS,
                fontSize: 22,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: lawOut,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <Icon name={n.icon} size={24} /> {n.label}
              </span>
              <span
                style={{
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: restIn,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                <Icon name={REST_NAV[i].icon} size={24} /> {REST_NAV[i].label}
              </span>
            </div>
          );
        })}
        {/* rows 4+ collapse away */}
        {NAV.slice(4).map((n, i) => {
          const idx = i + 4;
          const h = ipl(m, 0.2, 0.7, ROW_H - 8, 0);
          const op = ipl(m, 0.2, 0.6, 0.6, 0);
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: 12,
                top: navRowY(idx),
                width: SIDE_W - 24,
                height: h,
                opacity: op,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 16px",
                fontFamily: SANS,
                fontSize: 22,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <Icon name={n.icon} size={24} /> {n.label}
            </div>
          );
        })}
      </div>
      {/* topbar */}
      <div
        style={{
          position: "absolute",
          left: SIDE_W,
          right: 0,
          top: 0,
          height: 110,
          borderBottom: `1px solid ${c}33`,
          display: "flex",
          alignItems: "center",
          padding: "0 44px",
        }}
      >
        <span
          style={{
            position: "absolute",
            opacity: lawOut,
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 800,
            color: MULE.text,
          }}
        >
          Dashboard
        </span>
        <span
          style={{
            position: "absolute",
            opacity: restIn,
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 800,
            color: FIRE.text,
          }}
        >
          Dashboard
        </span>
      </div>
      {/* content: KPI tiles stay on screen and recolor + relabel in place */}
      <div
        style={{
          position: "absolute",
          left: SIDE_W + 44,
          top: 150,
          right: 44,
        }}
      >
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {MORPH_KPIS.map((k, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "20px 22px",
                background: lerpHex("#111725", "#1c130c", m),
                border: `1px solid ${c}44`,
                borderRadius: 18,
                position: "relative",
                minHeight: 110,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                }}
              >
                <span style={{ position: "absolute", opacity: lawOut }}>
                  {k[0]}
                </span>
                <span style={{ opacity: restIn }}>{k[2]}</span>
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 40,
                  fontWeight: 800,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 26,
                }}
              >
                <span style={{ position: "absolute", opacity: lawOut }}>
                  {k[1]}
                </span>
                <span style={{ opacity: restIn }}>{k[3]}</span>
              </div>
            </div>
          ))}
        </div>
        {/* chart panel recolors with the theme */}
        <div
          style={{
            height: 320,
            background: lerpHex("#111725", "#1c130c", m),
            border: `1px solid ${c}44`,
            borderRadius: 18,
            padding: 24,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.55)",
              marginBottom: 14,
            }}
          >
            REVENUE — LAST 12 MONTHS
          </div>
          <svg width={620} height={210} style={{ overflow: "visible" }}>
            <polyline
              points={[20, 26, 24, 32, 40, 38, 47, 54, 60, 68, 76, 90]
                .map(
                  (v, i, a) =>
                    `${(i / (a.length - 1)) * 620},${200 - (v / 100) * 170}`,
                )
                .join(" ")}
              fill="none"
              stroke={c}
              strokeWidth="5"
              style={{ filter: `drop-shadow(0 0 10px ${c})` }}
            />
          </svg>
        </div>
      </div>
      {/* thesis line — on early so the pivot reads immediately */}
      <div
        style={{
          position: "absolute",
          bottom: 320,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 48,
          color: "#fff",
          opacity: ipl(m, 0.12, 0.32, 0, 1),
          textShadow: `0 3px 18px rgba(0,0,0,0.9), 0 0 24px ${c}`,
        }}
      >
        Same engine.{" "}
        <span style={{ color: lerpHex("#A5B4FC", "#FFA45C", m) }}>
          Rebuilt for a different business.
        </span>
      </div>
    </AbsoluteFill>
  );
};
