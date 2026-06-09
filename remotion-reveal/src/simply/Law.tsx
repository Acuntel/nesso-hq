import React from "react";
import { AbsoluteFill } from "remotion";
import manifest from "./beats.json";
import { MULE, SANS, MONO, W } from "./theme";
import {
  BeatInfo,
  DotGrid,
  Icon,
  PushIn,
  TipCursor,
  ease,
  easeInOut,
  ipl,
} from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
//  PRACTICE OS (accurate Stolen Mule recreation): cursor + rows share one rect
// ════════════════════════════════════════════════════════════════════════════

type NavItem = { label: string; icon: string; ai?: boolean };
export const NAV: NavItem[] = [
  { label: "Dashboard", icon: "grid" },
  { label: "Matters", icon: "scale" },
  { label: "Contacts", icon: "users" },
  { label: "Invoices", icon: "invoice" },
  { label: "Time & Fees", icon: "clock" },
  { label: "Tasks", icon: "check" },
  { label: "Calendar", icon: "calendar" },
  { label: "Intake", icon: "inbox" },
  { label: "Trust Accounting", icon: "bank" },
  { label: "Contract Analyzer", icon: "doc", ai: true },
];
export const SIDE_W = 300;
const NAV_TOP = 168;
const ROW_H = 58;
const AI_GAP = 44;
const AI_START = 9;
export const navRowY = (i: number) =>
  NAV_TOP + i * ROW_H + (i >= AI_START ? AI_GAP : 0);
const navCenter = (i: number) => ({ x: 150, y: navRowY(i) + ROW_H / 2 });

export const MuleSidebar: React.FC<{ activeIdx: number }> = ({ activeIdx }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: SIDE_W,
      background: MULE.sunken,
      borderRight: `1px solid ${MULE.border}`,
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
          background: MULE.indigo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 22,
          boxShadow: `0 0 18px ${MULE.indigo}88`,
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
          letterSpacing: "-0.01em",
        }}
      >
        Practice OS
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: NAV_TOP + AI_START * ROW_H + 8,
        width: SIDE_W,
        fontFamily: SANS,
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: "0.18em",
        color: MULE.mid,
        paddingLeft: 24,
      }}
    >
      AI INTEGRATIONS
    </div>
    {NAV.map((n, i) => {
      const y = navRowY(i);
      const active = i === activeIdx;
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
            gap: 14,
            padding: "0 16px",
            borderRadius: 12,
            background: active ? `${MULE.indigo}26` : "transparent",
            boxShadow: active ? `inset 0 0 0 1px ${MULE.indigo}66` : "none",
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: active ? 700 : 500,
            color: active ? "#fff" : MULE.mid,
          }}
        >
          <Icon name={n.icon} size={24} />
          <span style={{ flex: 1 }}>{n.label}</span>
          {n.ai && (
            <span
              style={{
                fontFamily: SANS,
                fontSize: 12,
                fontWeight: 800,
                color: "#04150E",
                background: MULE.indigoHi,
                borderRadius: 5,
                padding: "2px 6px",
              }}
            >
              AI
            </span>
          )}
        </div>
      );
    })}
  </div>
);

export const MAINX = SIDE_W + 44; // content left
export const MAINW = W - MAINX - 44;

// Live badge sits next to the title — the top-right corner stays clear for the
// persistent Simply Scaled wordmark.
export const MuleChrome: React.FC<{
  activeIdx: number;
  frame: number;
  title: string;
  children: React.ReactNode;
}> = ({ activeIdx, frame, title, children }) => (
  <AbsoluteFill style={{ background: MULE.canvas }}>
    <DotGrid color={MULE.indigo} opacity={0.18} frame={frame} />
    <MuleSidebar activeIdx={activeIdx} />
    <div
      style={{
        position: "absolute",
        left: SIDE_W,
        right: 0,
        top: 0,
        height: 110,
        borderBottom: `1px solid ${MULE.border}`,
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: "0 44px",
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 40,
          fontWeight: 800,
          color: MULE.text,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: SANS,
          fontSize: 20,
          color: MULE.indigoHi,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: MULE.indigo,
            boxShadow: `0 0 12px ${MULE.indigo}`,
          }}
        />{" "}
        Live
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: MAINX,
        top: 150,
        right: 44,
        bottom: 40,
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

// ── shared pane bits ─────────────────────────────────────────────────────────
export const badge = (txt: string, c: string, bg: string) => (
  <span
    style={{
      fontFamily: SANS,
      fontSize: 18,
      fontWeight: 700,
      color: c,
      background: bg,
      borderRadius: 8,
      padding: "4px 12px",
    }}
  >
    {txt}
  </span>
);

const Row: React.FC<{
  cells: React.ReactNode[];
  widths: string[];
  appear?: number;
}> = ({ cells, widths, appear = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "20px 22px",
      borderBottom: `1px solid ${MULE.border}`,
      opacity: appear,
    }}
  >
    {cells.map((c, i) => (
      <div
        key={i}
        style={{
          width: widths[i],
          fontFamily: SANS,
          fontSize: 24,
          color: MULE.text,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {c}
      </div>
    ))}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: MULE.surface,
      border: `1px solid ${MULE.border}`,
      borderRadius: 18,
      ...style,
    }}
  >
    {children}
  </div>
);

export const kpi = (label: string, val: string, accent = MULE.text) => (
  <Card style={{ flex: 1, padding: "20px 22px" }}>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: MULE.mid,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: SANS,
        fontSize: 46,
        fontWeight: 800,
        color: accent,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {val}
    </div>
  </Card>
);

// ── module main panes (tour stops only: Dashboard, Matters, Invoices,
//    Calendar, Trust) — each one dense enough to fill the pushed-in frame ────
export const ModulePane: React.FC<{ module: number; frame: number }> = ({
  module,
  frame,
}) => {
  switch (module) {
    case 1: // Matters
      return (
        <Card style={{ overflow: "hidden" }}>
          <Row
            widths={["20%", "16%", "34%", "30%"]}
            cells={[
              <b style={{ color: MULE.mid, fontSize: 18 }}>MATTER</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>STATUS</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>PROPERTY</b>,
              <b style={{ color: MULE.mid, fontSize: 18 }}>ATTORNEY</b>,
            ]}
          />
          {[
            ["M-2041", "Open", "14 Oak St., Wheaton", "A. Cole"],
            ["M-2039", "Pending", "88 Maple Ave.", "R. Diaz"],
            ["M-2036", "Closed", "5 Birch Ct.", "A. Cole"],
            ["M-2030", "Open", "210 Elm Blvd.", "J. Park"],
            ["M-2028", "Open", "47 Cedar Ln.", "R. Diaz"],
          ].map((r, i) => (
            <Row
              key={i}
              widths={["20%", "16%", "34%", "30%"]}
              cells={[
                <span style={{ fontFamily: MONO }}>{r[0]}</span>,
                badge(
                  r[1],
                  r[1] === "Open"
                    ? MULE.ok
                    : r[1] === "Pending"
                      ? MULE.warn
                      : MULE.mid,
                  r[1] === "Open"
                    ? MULE.okFill
                    : r[1] === "Pending"
                      ? MULE.warnFill
                      : "rgba(255,255,255,0.06)",
                ),
                r[2],
                r[3],
              ]}
            />
          ))}
        </Card>
      );
    case 3: // Invoices
      return (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {kpi("Unpaid", "$112,750", MULE.warn)}
            {kpi("Overdue", "$19,400", MULE.danger)}
            {kpi("Collected", "$284,900", MULE.ok)}
          </div>
          <Card style={{ overflow: "hidden" }}>
            {[
              ["INV-2026-0042", "Paid", "Mercer Holdings", "$8,400"],
              ["INV-2026-0041", "Sent", "S. Diaz", "$3,250"],
              ["INV-2026-0039", "Overdue", "210 Elm LLC", "$6,100"],
              ["INV-2026-0038", "Paid", "Wheaton Title", "$1,900"],
            ].map((r, i) => (
              <Row
                key={i}
                widths={["32%", "16%", "30%", "22%"]}
                cells={[
                  <span style={{ fontFamily: MONO, fontSize: 20 }}>
                    {r[0]}
                  </span>,
                  badge(
                    r[1],
                    r[1] === "Paid"
                      ? MULE.ok
                      : r[1] === "Sent"
                        ? MULE.indigoHi
                        : MULE.danger,
                    r[1] === "Paid"
                      ? MULE.okFill
                      : r[1] === "Sent"
                        ? `${MULE.indigo}22`
                        : MULE.dangerFill,
                  ),
                  r[2],
                  <b>{r[3]}</b>,
                ]}
              />
            ))}
          </Card>
        </>
      );
    case 6: // Calendar
      return (
        <Card style={{ padding: 22, height: "100%" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <div
                key={d}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: MULE.mid,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, height: 360 }}>
            {[0, 1, 2, 3, 4].map((c) => (
              <div
                key={c}
                style={{
                  flex: 1,
                  position: "relative",
                  background: MULE.sunken,
                  borderRadius: 12,
                  border: `1px solid ${MULE.border}`,
                }}
              >
                {c === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 30,
                      left: 8,
                      right: 8,
                      height: 60,
                      background: MULE.indigo,
                      borderRadius: 8,
                      padding: 8,
                      fontFamily: SANS,
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Closing 10a
                  </div>
                )}
                {c === 2 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 120,
                      left: 8,
                      right: 8,
                      height: 50,
                      background: MULE.warnFill,
                      border: `1px solid ${MULE.warn}`,
                      borderRadius: 8,
                      padding: 8,
                      fontFamily: SANS,
                      fontSize: 16,
                      color: MULE.warn,
                    }}
                  >
                    Deadline
                  </div>
                )}
                {c === 4 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 60,
                      left: 8,
                      right: 8,
                      height: 56,
                      background: `${MULE.ok}22`,
                      border: `1px solid ${MULE.ok}`,
                      borderRadius: 8,
                      padding: 8,
                      fontFamily: SANS,
                      fontSize: 16,
                      color: MULE.ok,
                    }}
                  >
                    Signing
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      );
    case 8: // Trust Accounting
      return (
        <>
          <Card
            style={{
              padding: "20px 24px",
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  fontWeight: 700,
                  color: MULE.text,
                }}
              >
                IOLTA Trust ····4182
              </div>
              <div style={{ fontFamily: SANS, fontSize: 20, color: MULE.mid }}>
                First Trust Bank
              </div>
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 40,
                fontWeight: 800,
                color: MULE.ok,
              }}
            >
              $486,200
            </div>
          </Card>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              "Transactions",
              "Reconciliation",
              "Reporting",
              "Deposit Slips",
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: i === 0 ? MULE.indigoHi : MULE.mid,
                  padding: "8px 14px",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <Card style={{ overflow: "hidden" }}>
            {[
              ["Deposit — Mercer earnest", "+$25,000"],
              ["Disbursement — title", "−$1,800"],
              ["Deposit — Diaz retainer", "+$5,000"],
            ].map((r, i) => (
              <Row
                key={i}
                widths={["70%", "30%"]}
                cells={[
                  r[0],
                  <b
                    style={{
                      color: r[1].startsWith("+") ? MULE.ok : MULE.danger,
                    }}
                  >
                    {r[1]}
                  </b>,
                ]}
              />
            ))}
          </Card>
        </>
      );
    default: // 0 Dashboard
      return (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {kpi("Unbilled", "$48,200")}
            {kpi("Unpaid", "$112,750", MULE.warn)}
            {kpi("Overdue", "$19,400", MULE.danger)}
            {kpi("Collected", "$284,900", MULE.indigoHi)}
          </div>
          <Card style={{ padding: 22, marginBottom: 18 }}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 20,
                fontWeight: 800,
                color: MULE.mid,
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              REVENUE — LAST 12 MONTHS
            </div>
            <svg
              width={MAINW - 44}
              height={160}
              style={{ overflow: "visible" }}
            >
              <polyline
                points={[20, 26, 24, 32, 40, 38, 47, 54, 60, 68, 76, 90]
                  .map(
                    (v, i, a) =>
                      `${(i / (a.length - 1)) * (MAINW - 44)},${150 - (v / 100) * 130}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={MULE.indigoHi}
                strokeWidth="5"
                style={{ filter: `drop-shadow(0 0 10px ${MULE.indigo})` }}
              />
            </svg>
          </Card>
          <div style={{ display: "flex", gap: 16 }}>
            <Card style={{ flex: 1, padding: 20 }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: MULE.mid,
                }}
              >
                Alerts (3)
              </div>
              {[0, 1].map((k) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                    fontFamily: SANS,
                    fontSize: 20,
                    color: MULE.text,
                  }}
                >
                  <span style={{ color: MULE.danger }}>●</span> Invoice 8 days
                  overdue
                </div>
              ))}
            </Card>
            <Card style={{ flex: 1, padding: 20 }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 20,
                  fontWeight: 700,
                  color: MULE.mid,
                }}
              >
                My Tasks (6)
              </div>
              {[0, 1].map((k) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                    fontFamily: SANS,
                    fontSize: 20,
                    color: MULE.text,
                  }}
                >
                  <span style={{ color: MULE.ok }}>☐</span> Send disclosures
                </div>
              ))}
            </Card>
          </div>
        </>
      );
  }
};

// ── LAW_TOUR: dashboard, then the cursor clicks 4 sidebar stops. Click
//    fractions come from the manifest — the SAME numbers Python uses for SFX. ─
const TOUR_STOPS: number[] = manifest.tour.stops;
const TOUR_FRACS: number[] = manifest.tour.fracs;

export const LawTour: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const n = TOUR_STOPS.length;
  const clickL = TOUR_FRACS.map((f) => bi.durF * f);
  let nextK = 0;
  while (nextK < n && bi.localF >= clickL[nextK]) nextK++;
  let activeIdx = 0;
  for (let k = 0; k < n; k++)
    if (bi.localF >= clickL[k]) activeIdx = TOUR_STOPS[k];
  const fromIdx = nextK === 0 ? 0 : TOUR_STOPS[nextK - 1];
  const toIdx = nextK < n ? TOUR_STOPS[nextK] : TOUR_STOPS[n - 1];
  const segStart = nextK === 0 ? 0 : clickL[nextK - 1];
  const segEnd = nextK < n ? clickL[nextK] : bi.durF;
  const moveP = ipl(
    bi.localF,
    segStart,
    Math.max(segStart + 1, segEnd - 2),
    0,
    1,
    easeInOut,
  );
  const from = navCenter(fromIdx);
  const to = navCenter(toIdx);
  const cxx = from.x + (to.x - from.x) * moveP;
  const cyy = from.y + (to.y - from.y) * moveP;
  let clickAmt = 0;
  for (let k = 0; k < n; k++) {
    const d = bi.localF - clickL[k];
    if (d >= 0 && d < 9) clickAmt = Math.max(clickAmt, 1 - d / 9);
  }
  const titles: Record<number, string> = {
    0: "Dashboard",
    1: "Matters",
    3: "Invoices",
    6: "Calendar",
    8: "Trust Accounting",
  };
  return (
    <PushIn p={bi.p} from={1.0} to={1.045} origin="0% 12%">
      <MuleChrome
        activeIdx={activeIdx}
        frame={frame}
        title={titles[activeIdx] ?? "Dashboard"}
      >
        <ModulePane module={activeIdx} frame={frame} />
      </MuleChrome>
      <TipCursor tx={cxx} ty={cyy} click={clickAmt} />
    </PushIn>
  );
};

// ── LAW_PDF: contract analyzer (click Scan → checklist) ──────────────────────
const ACTION_BTN = { x: MAINX + 150, y: 980, w: 300, h: 84 };

export const LawPdf: React.FC<{ frame: number; fps: number; bi: BeatInfo }> = ({
  frame,
  fps,
  bi,
}) => {
  const enter = ipl(bi.localF, 0, 10, 0, 1, ease);
  const cursorP = ipl(
    bi.localF,
    bi.durF * 0.18,
    bi.durF * 0.34,
    0,
    1,
    easeInOut,
  );
  const click = ipl(bi.localF, bi.durF * 0.32, bi.durF * 0.42, 1, 0);
  const scanned = bi.localF > bi.durF * 0.4;
  const btnCx = ACTION_BTN.x + ACTION_BTN.w / 2;
  const btnCy = ACTION_BTN.y + ACTION_BTN.h / 2;
  const fromX = MAINX + 500,
    fromY = 1300;
  const cxx = fromX + (btnCx - fromX) * cursorP;
  const cyy = fromY + (btnCy - fromY) * cursorP;
  const rows = [
    {
      tag: "OK",
      t: "Form: Multi-Board 8.0 detected",
      c: MULE.ok,
      bg: MULE.okFill,
    },
    { tag: "OK", t: "Parties: 3 matched", c: MULE.ok, bg: MULE.okFill },
    {
      tag: "OK",
      t: "Signatures & initials: 6 of 6",
      c: MULE.ok,
      bg: MULE.okFill,
    },
    {
      tag: "VERIFY",
      t: "Financing: confirm closing date",
      c: MULE.warn,
      bg: MULE.warnFill,
    },
    {
      tag: "ACTION",
      t: "Earnest money receipt: missing",
      c: MULE.danger,
      bg: MULE.dangerFill,
    },
  ];
  return (
    <PushIn p={bi.p} from={1.0} to={1.045} origin="0% 12%">
      <MuleChrome activeIdx={9} frame={frame} title="Contract Analyzer">
        {!scanned ? (
          <div style={{ opacity: enter }}>
            <div
              style={{
                height: 560,
                border: `3px dashed ${MULE.border}`,
                borderRadius: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                background: MULE.sunken,
              }}
            >
              <Icon name="doc" size={84} color={MULE.indigoHi} />
              <div style={{ fontFamily: SANS, fontSize: 30, color: MULE.mid }}>
                purchase_agreement.pdf
              </div>
            </div>
          </div>
        ) : (
          <Card
            style={{
              padding: 30,
              opacity: ipl(bi.localF, bi.durF * 0.4, bi.durF * 0.5, 0, 1),
            }}
          >
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              {badge("3 OK", MULE.ok, MULE.okFill)}
              {badge("1 VERIFY", MULE.warn, MULE.warnFill)}
              {badge("1 ACTION", MULE.danger, MULE.dangerFill)}
            </div>
            {rows.map((r, i) => {
              const a = ipl(
                bi.localF,
                bi.durF * 0.46 + i * 4,
                bi.durF * 0.46 + i * 4 + 6,
                0,
                1,
                ease,
              );
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 14,
                    opacity: a,
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 18,
                      fontWeight: 800,
                      color: r.c,
                      background: r.bg,
                      borderRadius: 8,
                      padding: "5px 10px",
                      width: 110,
                      textAlign: "center",
                    }}
                  >
                    {r.tag}
                  </span>
                  <span
                    style={{ fontFamily: SANS, fontSize: 28, color: "#fff" }}
                  >
                    {r.t}
                  </span>
                </div>
              );
            })}
            <div
              style={{
                fontFamily: MONO,
                fontSize: 20,
                color: MULE.mid,
                marginTop: 10,
              }}
            >
              $0.04 · AWS Bedrock · 28s
            </div>
          </Card>
        )}
        {!scanned && (
          <div
            style={{
              position: "absolute",
              left: ACTION_BTN.x - MAINX,
              top: ACTION_BTN.y - 150,
              width: ACTION_BTN.w,
              height: ACTION_BTN.h,
              background: MULE.indigo,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              transform: `scale(${click > 0 ? 0.96 : 1})`,
              boxShadow: `0 0 28px ${MULE.indigo}88`,
            }}
          >
            Scan Contract
          </div>
        )}
      </MuleChrome>
      {!scanned && <TipCursor tx={cxx} ty={cyy} click={click} />}
    </PushIn>
  );
};
