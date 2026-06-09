import React from "react";
import { AbsoluteFill, Img, spring, staticFile } from "remotion";
import { FIRE, LAW, SANS } from "./theme";

import {
  BeatInfo,
  Bloom,
  DotGrid,
  Icon,
  LightSweep,
  ease,
  ipl,
} from "./helpers";

// brand assets arrive as bare filenames the pipeline drops into public/
const assetUrl = (u: string) => (u.startsWith("http") ? u : staticFile(u));

// ════════════════════════════════════════════════════════════════════════════
//  CLOSING ACT — proof turn → founder (a real person) → CTA hold.
// ════════════════════════════════════════════════════════════════════════════

// PROOF_TURN — two worlds side by side → "now imagine yours"
export const ProofTurn: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
}> = ({ frame, fps, bi }) => {
  const inP = ipl(bi.localF, 0, 14, 0, 1, ease);
  const morph = ipl(bi.localF, bi.durF * 0.55, bi.durF * 0.78, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, #0b0d16 0%, #050609 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.2} frame={frame} />
      <div style={{ display: "flex", gap: 40, opacity: inP }}>
        {/* law card */}
        <div
          style={{
            width: 380,
            height: 540,
            background: LAW.bg2,
            borderRadius: 28,
            border: `2px solid ${LAW.indigo}88`,
            boxShadow: `0 0 60px ${LAW.indigo}55`,
            padding: 30,
            opacity: 1 - morph * 0.6,
            transform: `translateX(${-morph * 60}px) scale(${1 - morph * 0.1})`,
          }}
        >
          <Icon name="scale" size={64} color={LAW.indigoHi} />
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 38,
              color: "#fff",
              marginTop: 16,
            }}
          >
            A law firm
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 26,
              color: LAW.indigoHi,
              marginTop: 8,
            }}
          >
            Every case in one place
          </div>
        </div>
        {/* restoration → your business card */}
        <div
          style={{
            width: 380,
            height: 540,
            background: morph > 0.5 ? "rgba(255,255,255,0.04)" : FIRE.bg2,
            borderRadius: 28,
            border: `2px ${morph > 0.5 ? "dashed" : "solid"} ${
              morph > 0.5 ? "#fff" : FIRE.copper
            }88`,
            boxShadow: `0 0 60px ${
              morph > 0.5 ? "rgba(255,255,255,0.3)" : FIRE.copper + "55"
            }`,
            padding: 30,
          }}
        >
          {morph < 0.5 ? (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                <Icon name="hardhat" size={58} color={FIRE.copperHi} />
                <Icon name="droplet" size={58} color={FIRE.info} />
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 38,
                  color: "#fff",
                  marginTop: 16,
                }}
              >
                A repair company
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  color: FIRE.copperHi,
                  marginTop: 8,
                }}
              >
                $612k in jobs tracked
              </div>
            </>
          ) : (
            <div style={{ opacity: morph }}>
              <Icon name="spark" size={60} color="#fff" />
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 40,
                  color: "#fff",
                  marginTop: 16,
                }}
              >
                YOUR business
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  color: "#fff",
                  marginTop: 18,
                  lineHeight: 1.7,
                }}
              >
                YOUR jobs
                <br />
                YOUR customers
                <br />
                YOUR money
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 430,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: inP,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 38,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          Two real businesses. One person built both.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 600,
            color: LAW.indigoHi,
            marginTop: 12,
            opacity: morph,
          }}
        >
          Whatever you do, I build the software that runs it.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// FOUNDER — a real person you can call. Uses founder.jpg when provided,
// otherwise a designed monogram card; both get the name lower-third.
export const Founder: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
  founderPhotoUrl: string;
}> = ({ frame, fps, bi, founderPhotoUrl }) => {
  const inP = ipl(bi.localF, 0, 12, 0, 1, ease);
  const nameIn = ipl(bi.localF, bi.durF * 0.16, bi.durF * 0.36, 0, 1, ease);
  const push = 1 + ipl(bi.localF, 0, bi.durF, 0, 0.04);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #0c1020 0%, #050608 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.16} frame={frame} />
      {/* the two dashboards ghosting behind */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 420,
          width: 300,
          height: 420,
          background: LAW.bg2,
          border: `1px solid ${LAW.indigo}44`,
          borderRadius: 22,
          opacity: 0.35 * inP,
          transform: "rotate(-7deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 480,
          width: 300,
          height: 420,
          background: FIRE.bg2,
          border: `1px solid ${FIRE.copper}44`,
          borderRadius: 22,
          opacity: 0.35 * inP,
          transform: "rotate(7deg)",
        }}
      />
      <div
        style={{
          textAlign: "center",
          opacity: inP,
          transform: `scale(${push})`,
        }}
      >
        {founderPhotoUrl ? (
          <Img
            src={assetUrl(founderPhotoUrl)}
            style={{
              width: 460,
              height: 560,
              objectFit: "cover",
              borderRadius: 32,
              border: "2px solid rgba(255,255,255,0.25)",
              boxShadow: `0 30px 90px rgba(0,0,0,0.7), 0 0 60px ${LAW.indigo}33`,
            }}
          />
        ) : (
          <div
            style={{
              width: 460,
              height: 460,
              borderRadius: "50%",
              margin: "0 auto",
              background: `linear-gradient(135deg, ${LAW.indigo}, ${FIRE.copper})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontSize: 200,
              fontWeight: 800,
              color: "#fff",
              boxShadow: `0 30px 90px rgba(0,0,0,0.7), 0 0 70px ${LAW.indigo}44`,
            }}
          >
            B
          </div>
        )}
        <div
          style={{
            marginTop: 36,
            opacity: nameIn,
            transform: `translateY(${(1 - nameIn) * 20}px)`,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 52,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            Brady · Simply Scaled
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 32,
              fontWeight: 600,
              color: "rgba(255,255,255,0.78)",
              marginTop: 10,
            }}
          >
            I build these myself. No agency, no runaround.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// CLOSE_CTA — wordmark lands, then the phone number is the hero. Email +
// urgency + offer all visible, everything held to the literal last frame.
export const CloseCta: React.FC<{
  frame: number;
  fps: number;
  bi: BeatInfo;
  brand: string;
  phone: string;
  email: string;
  offer: string;
  logoUrl: string;
}> = ({ frame, fps, bi, brand, phone, email, offer, logoUrl }) => {
  const logoSpring = spring({
    frame: bi.localF,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.8 },
  });
  const sweep = ipl(bi.localF, 8, 30, -1, 2);
  // phase 2: phone hero — early (28% in) and held to the end
  const phoneStart = bi.durF * 0.28;
  const wordUp = ipl(bi.localF, phoneStart - 6, phoneStart + 8, 0, 1, ease);
  const phoneIn = ipl(bi.localF, phoneStart, phoneStart + 10, 0, 1, ease);
  const pulse = 1 + 0.03 * Math.sin(bi.localF / 6);
  const emailIn = ipl(bi.localF, phoneStart + 12, phoneStart + 22, 0, 1, ease);
  const offerIn = ipl(bi.localF, phoneStart + 18, phoneStart + 28, 0, 1, ease);
  const urgencyIn = ipl(bi.localF, bi.durF * 0.72, bi.durF * 0.82, 0, 1, ease);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, #0c1020 0%, #050608 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DotGrid color={LAW.indigo} opacity={0.24} frame={frame} />
      <Bloom color="rgba(99,102,241,0.3)" />
      <div
        style={{
          textAlign: "center",
          transform: `translateY(${-wordUp * 430}px)`,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            transform: `scale(${(0.7 + logoSpring * 0.3) * (1 - wordUp * 0.25)})`,
            opacity: logoSpring,
          }}
        >
          {logoUrl ? (
            <Img
              src={assetUrl(logoUrl)}
              style={{ height: 150, objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                position: "relative",
                fontFamily: SANS,
                fontSize: 108,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#fff",
              }}
            >
              {brand}
              <LightSweep p={sweep} />
            </div>
          )}
          <div
            style={{
              height: 8,
              borderRadius: 4,
              marginTop: 16,
              background: "linear-gradient(90deg, #6366F1, #F0742A)",
              opacity: logoSpring,
            }}
          />
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.8)",
            marginTop: 26,
            opacity: logoSpring * (1 - wordUp),
          }}
        >
          Custom software + AI for local businesses
        </div>
      </div>
      {/* phone hero */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: phoneIn,
          transform: `scale(${pulse})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 26,
            fontFamily: SANS,
            fontSize: 118,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.01em",
            textShadow: `0 0 50px ${LAW.indigo}`,
          }}
        >
          <Icon name="phone" size={86} color={LAW.indigoHi} />
          {phone}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 700,
            color: LAW.indigoHi,
            marginTop: 12,
          }}
        >
          Call or text
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            marginTop: 22,
            opacity: emailIn,
          }}
        >
          <Icon name="mail" size={32} color="rgba(255,255,255,0.7)" />
          {email}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 430,
          left: 80,
          right: 80,
          textAlign: "center",
          opacity: offerIn,
          fontFamily: SANS,
          fontSize: 36,
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.4,
        }}
      >
        {offer}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 340,
          left: 80,
          right: 80,
          textAlign: "center",
          opacity: urgencyIn,
          fontFamily: SANS,
          fontSize: 30,
          fontWeight: 700,
          color: LAW.indigoHi,
        }}
      >
        I only take a few builds a month.
      </div>
    </AbsoluteFill>
  );
};
