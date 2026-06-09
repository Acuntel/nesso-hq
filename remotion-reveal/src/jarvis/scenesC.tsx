import React from "react";
import { AbsoluteFill, Img, spring, staticFile } from "remotion";
import { FIRE, LAW, MONO, SANS, W, H } from "../simply/theme";
import { Icon, ease, ipl } from "../simply/helpers";
import { BracketTarget, GlassPanel, Stamp, TypeOn } from "./kit";
import type { SceneProps } from "./scenesA";

// ════════════════════════════════════════════════════════════════════════════
//  ACT 3 — maker → thesis → your leak scan → offer → CTA hold.
// ════════════════════════════════════════════════════════════════════════════

const CYAN = "#39D6FF";
const AMBER = "#E8A33D";
const GREEN = "#3DDC84";
const WARN = "#F5B945";

const assetUrl = (u: string) => (u.startsWith("http") ? u : staticFile(u));

// MAKER — the AI introduces the human
export const Maker: React.FC<SceneProps & { founderPhotoUrl: string }> = ({
  frame,
  fps,
  bi,
  founderPhotoUrl,
}) => {
  const reveal = ipl(bi.localF, bi.durF * 0.18, bi.durF * 0.45, 0, 1, ease);
  const nameIn = ipl(bi.localF, bi.durF * 0.42, bi.durF * 0.6, 0, 1, ease);
  const ringR = 250;
  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center", marginTop: -140 }}>
        <div
          style={{
            position: "relative",
            width: 500,
            height: 500,
            margin: "0 auto",
            clipPath: `circle(${reveal * 52}% at 50% 50%)`,
          }}
        >
          {founderPhotoUrl ? (
            <Img
              src={assetUrl(founderPhotoUrl)}
              style={{
                width: 500,
                height: 500,
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          ) : (
            <div
              style={{
                width: 500,
                height: 500,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${LAW.indigo}, ${FIRE.copper})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SANS,
                fontSize: 210,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              B
            </div>
          )}
        </div>
        {/* accent ring */}
        <svg
          width={560}
          height={560}
          style={{
            position: "absolute",
            left: "50%",
            top: 250 - 140,
            transform: `translateX(-50%) rotate(${frame * 0.3}deg)`,
          }}
        >
          <circle
            cx={280}
            cy={280}
            r={268}
            fill="none"
            stroke={AMBER}
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 268 * 0.82} ${2 * Math.PI * 268 * 0.18}`}
            strokeDashoffset={2 * Math.PI * 268 * (1 - reveal)}
            opacity={0.8 * reveal}
          />
        </svg>
        <div
          style={{
            marginTop: 50,
            opacity: nameIn,
            transform: `translateY(${(1 - nameIn) * 24}px)`,
          }}
        >
          <GlassPanel
            accent={AMBER}
            style={{ padding: "28px 46px", display: "inline-block" }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontSize: 54,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              BRADY — SIMPLY SCALED
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 31,
                fontWeight: 600,
                color: "rgba(255,255,255,0.82)",
                marginTop: 12,
              }}
            >
              A real person. No agency. He answers his own phone.
            </div>
          </GlassPanel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// BUILT_ME — the thesis + the dashed YOUR BUSINESS window
export const BuiltMe: React.FC<SceneProps & { founderPhotoUrl: string }> = ({
  frame,
  fps,
  bi,
  founderPhotoUrl,
}) => {
  const drawP = ipl(bi.localF, bi.durF * 0.04, bi.durF * 0.3, 0, 1, ease);
  const line1F = bi.durF * 0.24;
  const line2F = bi.durF * 0.52;
  const plugged = ipl(bi.localF, bi.durF * 0.62, bi.durF * 0.85, 0, 1);
  const chips = ["LAW", "TRADES", "REALTY", "CPA"];
  const winX = W * 0.42;
  const winY = 480;
  const winW = W * 0.46;
  const winH = 560;
  const peri = 2 * (winW + winH);
  const pulse =
    bi.localF > bi.durF * 0.7 ? 1 + 0.03 * Math.sin(frame * 0.4) : 1;
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      {/* portrait, left */}
      <div style={{ position: "absolute", left: 60, top: 520 }}>
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${AMBER}66`,
          }}
        >
          {founderPhotoUrl ? (
            <Img
              src={assetUrl(founderPhotoUrl)}
              style={{ width: 300, height: 300, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                background: `linear-gradient(135deg, ${LAW.indigo}, ${FIRE.copper})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SANS,
                fontSize: 130,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              B
            </div>
          )}
        </div>
      </div>
      {/* dashed YOUR BUSINESS window, right */}
      <div
        style={{
          position: "absolute",
          left: winX,
          top: winY,
          width: winW,
          height: winH,
          transform: `scale(${pulse})`,
        }}
      >
        <svg width={winW} height={winH} style={{ overflow: "visible" }}>
          <rect
            x={2}
            y={2}
            width={winW - 4}
            height={winH - 4}
            rx={24}
            fill="rgba(255,255,255,0.025)"
            stroke={CYAN}
            strokeWidth="2.5"
            strokeDasharray="14 10"
            strokeDashoffset={-frame * 0.6}
            opacity={drawP}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: MONO,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: CYAN,
            opacity: drawP,
          }}
        >
          YOUR BUSINESS
        </div>
        {/* connector lines plugging in */}
        <svg
          width={400}
          height={winH}
          style={{
            position: "absolute",
            left: -400,
            top: 0,
            overflow: "visible",
          }}
        >
          {[0.2, 0.5, 0.8].map((t, i) => (
            <line
              key={i}
              x1={0}
              y1={winH * t - 120 + i * 60}
              x2={400}
              y2={winH * t}
              stroke={CYAN}
              strokeWidth="1.5"
              opacity={0.6}
              strokeDasharray={430}
              strokeDashoffset={
                430 * (1 - Math.min(1, Math.max(0, plugged * 3 - i)))
              }
            />
          ))}
        </svg>
        {/* vertical chips */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: winH + 30,
            display: "flex",
            gap: 14,
            justifyContent: "center",
          }}
        >
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 9,
                padding: "8px 16px",
                opacity: ipl(
                  bi.localF,
                  bi.durF * 0.7 + i * 3,
                  bi.durF * 0.7 + i * 3 + 6,
                  0,
                  1,
                ),
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      {/* staged thesis lines */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1180,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 62,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.3,
          }}
        >
          <TypeOn
            text="HE BUILT ME."
            localF={bi.localF}
            startF={line1F}
            cps={1.2}
            cursor={false}
          />
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 52,
            fontWeight: 800,
            color: CYAN,
            lineHeight: 1.3,
            textShadow: `0 0 34px ${CYAN}55`,
          }}
        >
          <TypeOn
            text="HE CAN BUILD ONE FOR YOU."
            localF={bi.localF}
            startF={line2F}
            cps={1.2}
            cursor={false}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// YOUR_LEAK_SCAN — radar sweeps a wireframe storefront; leak tags latch on
export const YourLeakScan: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const wireP = ipl(bi.localF, 0, bi.durF * 0.35, 0, 1, ease);
  const radar = (bi.localF * 6) % 360;
  const tags = [
    { y: 470, label: "MISSED CALLS?", icon: "phone", at: 0.35 },
    { y: 720, label: "INVOICES: STUCK?", icon: "doc", at: 0.5 },
    { y: 980, label: "LEADS: GOING COLD?", icon: "clock", at: 0.65 },
  ];
  const verdict = ipl(bi.localF, bi.durF * 0.85, bi.durF * 0.95, 0, 1, ease);
  const bx = W / 2 - 330;
  // wireframe storefront path
  const peri = 2600;
  return (
    <AbsoluteFill style={{ background: "rgba(8,11,20,0.45)" }}>
      {/* radar ring */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <circle
          cx={W / 2}
          cy={760}
          r={430}
          fill="none"
          stroke={`${CYAN}33`}
          strokeWidth="1.5"
        />
        <circle
          cx={W / 2}
          cy={760}
          r={300}
          fill="none"
          stroke={`${CYAN}22`}
          strokeWidth="1"
        />
        <g transform={`rotate(${radar} ${W / 2} 760)`}>
          <line
            x1={W / 2}
            y1={760}
            x2={W / 2 + 430}
            y2={760}
            stroke={CYAN}
            strokeWidth="2"
            opacity="0.8"
          />
          <path
            d={`M ${W / 2} 760 L ${W / 2 + 430} 760 A 430 430 0 0 0 ${W / 2 + 430 * Math.cos(-0.7)} ${760 + 430 * Math.sin(-0.7)} Z`}
            fill={CYAN}
            opacity="0.06"
          />
        </g>
        {/* wireframe storefront draws itself */}
        <g
          stroke={CYAN}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray={peri}
          strokeDashoffset={peri * (1 - wireP)}
          opacity="0.9"
        >
          <path
            d={`M ${bx} 1050 L ${bx} 640 L ${W / 2} 480 L ${W / 2 + 330} 640 L ${W / 2 + 330} 1050 Z`}
          />
          <rect x={W / 2 - 80} y={840} width={160} height={210} rx={6} />
          <rect x={bx + 70} y={700} width={140} height={110} rx={6} />
          <rect x={W / 2 + 120} y={700} width={140} height={110} rx={6} />
        </g>
        {/* map pin pulse */}
        <circle
          cx={W / 2}
          cy={760}
          r={8 + 6 * Math.abs(Math.sin(frame * 0.12))}
          fill={AMBER}
          opacity="0.9"
        />
      </svg>
      {/* leak tags */}
      {tags.map((t, i) => (
        <div key={i} style={{ position: "absolute", left: 0, top: 0 }}>
          <BracketTarget
            x={W / 2 + 240}
            y={t.y}
            w={60}
            h={60}
            localF={bi.localF}
            startF={bi.durF * t.at}
            accent={WARN}
            label={t.label}
            labelColor={WARN}
          />
        </div>
      ))}
      {/* verdict bar */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 1300,
          opacity: verdict,
          transform: `scaleX(${0.6 + verdict * 0.4})`,
        }}
      >
        <div
          style={{
            background: `${WARN}1A`,
            border: `2px solid ${WARN}`,
            borderRadius: 14,
            padding: "20px 30px",
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: WARN,
          }}
        >
          REVENUE LEAK — FIX AVAILABLE →
        </div>
      </div>
    </AbsoluteFill>
  );
};

// OFFER — dashes resolve into the bright offer card
export const Offer: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const inP = ipl(bi.localF, 0, bi.durF * 0.25, 0, 1, ease);
  const subIn = ipl(bi.localF, bi.durF * 0.4, bi.durF * 0.55, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, rgba(99,102,241,0.16), transparent 70%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: W - 140,
          textAlign: "center",
          opacity: inP,
          transform: `scale(${0.92 + inP * 0.08})`,
        }}
      >
        <GlassPanel accent={CYAN} style={{ padding: "70px 50px" }}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 92,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: "#fff",
              lineHeight: 1.05,
            }}
          >
            FREE 15-MIN
            <br />
            TEARDOWN
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 38,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              marginTop: 24,
              opacity: subIn,
            }}
          >
            of where your money's leaking
          </div>
          <div style={{ marginTop: 44 }}>
            <Stamp
              localF={bi.localF}
              startF={bi.durF * 0.72}
              fps={fps}
              color={GREEN}
              rotate={-8}
              style={{ fontSize: 52 }}
            >
              NO PITCH
            </Stamp>
          </div>
        </GlassPanel>
      </div>
    </AbsoluteFill>
  );
};

// CTA_HOLD — screenshot-ready, alive via HUD only, holds to the last frame
export const CtaHold: React.FC<SceneProps> = ({ frame, fps, bi }) => {
  const offerUp = ipl(bi.localF, 0, 14, 0, 1, ease);
  const heroF = bi.durF * 0.12;
  const chars = "(847) 212-2142".split("");
  const emailIn = ipl(bi.localF, bi.durF * 0.3, bi.durF * 0.42, 0, 1, ease);
  const urgIn = ipl(bi.localF, bi.durF * 0.45, bi.durF * 0.56, 0, 1, ease);
  const urgBreathe =
    0.75 + 0.25 * (0.5 + 0.5 * Math.sin((frame / 64) * Math.PI * 2));
  // digit-group glow re-pulses with the spoken digits (~55%, 70%, 85% of beat)
  const sayPulse =
    Math.max(
      ipl(bi.localF, bi.durF * 0.52, bi.durF * 0.58, 0, 1) *
        ipl(bi.localF, bi.durF * 0.58, bi.durF * 0.64, 1, 0),
      ipl(bi.localF, bi.durF * 0.66, bi.durF * 0.72, 0, 1) *
        ipl(bi.localF, bi.durF * 0.72, bi.durF * 0.78, 1, 0),
      ipl(bi.localF, bi.durF * 0.8, bi.durF * 0.86, 0, 1) *
        ipl(bi.localF, bi.durF * 0.86, bi.durF * 0.92, 1, 0),
    ) * 0.5;
  return (
    <AbsoluteFill style={{ background: "transparent", alignItems: "center" }}>
      {/* offer line holds at top third */}
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 80,
          right: 80,
          textAlign: "center",
          opacity: offerUp,
          fontFamily: SANS,
          fontSize: 44,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        FREE 15-MIN TEARDOWN — <span style={{ color: GREEN }}>NO PITCH</span>
      </div>
      {/* hero number with per-char spring cascade + locked reticle */}
      <div
        style={{
          position: "absolute",
          top: 640,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.26em",
            color: LAW.indigoHi,
            marginBottom: 24,
            opacity: ipl(bi.localF, heroF, heroF + 8, 0, 1),
          }}
        >
          CALL OR TEXT
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textShadow: `0 0 ${50 + sayPulse * 60}px ${LAW.indigo}`,
          }}
        >
          {chars.map((ch, i) => {
            const s = spring({
              frame: Math.max(0, bi.localF - heroF - i * 2),
              fps,
              config: { damping: 13, stiffness: 160 },
            });
            return (
              <span
                key={i}
                style={{
                  fontFamily: SANS,
                  fontSize: 124,
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                  display: "inline-block",
                  transform:
                    bi.localF < 60
                      ? `translateY(${(1 - s) * 60}px)`
                      : undefined,
                  opacity: bi.localF < 60 ? s : 1,
                  whiteSpace: "pre",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ position: "relative", height: 0 }}>
          <BracketTarget
            x={W / 2 - 470}
            y={-150}
            w={940}
            h={160}
            localF={bi.localF}
            startF={heroF + 10}
            accent={LAW.indigoHi}
            pulse
            frame={frame}
          />
        </div>
        <div
          style={{
            marginTop: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            fontFamily: MONO,
            fontSize: 40,
            color: "rgba(255,255,255,0.88)",
            opacity: emailIn,
          }}
        >
          <Icon name="mail" size={34} color="rgba(255,255,255,0.6)" />
          bradyschwartz25@gmail.com
        </div>
        <div
          style={{
            marginTop: 56,
            display: "inline-block",
            fontFamily: SANS,
            fontSize: 33,
            fontWeight: 700,
            color: AMBER,
            border: `2px solid ${AMBER}88`,
            borderRadius: 12,
            padding: "14px 30px",
            opacity: urgIn * urgBreathe,
          }}
        >
          HE ONLY TAKES A FEW BUILDS A MONTH.
        </div>
      </div>
    </AbsoluteFill>
  );
};
