// Shared palette / typography / geometry for the Simply Scaled reel.

export const LAW = {
  bg: "#080B14",
  bg2: "#0C1020",
  indigo: "#6366F1",
  indigoHi: "#A5B4FC",
  sky: "#7CA8FF",
  text: "#E8ECF6",
  soft: "rgba(232,236,246,0.55)",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(165,180,252,0.18)",
};

export const FIRE = {
  bg: "#0B0805",
  bg2: "#150D06",
  copper: "#F0742A",
  copperHi: "#FFA45C",
  ember: "#FF6B3D",
  emerald: "#34D399",
  info: "#60A5FA",
  amber: "#F5B945",
  text: "#FFF3EA",
  soft: "rgba(255,243,234,0.55)",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(240,116,42,0.22)",
};

// Practice OS (Stolen Mule recreation) surface palette
export const MULE = {
  canvas: "#0a0e17",
  surface: "#111725",
  sunken: "#070a11",
  indigo: "#6366f1",
  indigoHi: "#818cf8",
  text: "#e6eaf2",
  mid: "#9aa6bf",
  ok: "#4ade80",
  okFill: "rgba(22,163,74,0.18)",
  warn: "#fbbf24",
  warnFill: "rgba(217,119,6,0.18)",
  danger: "#f87171",
  dangerFill: "rgba(220,38,38,0.18)",
  border: "rgba(255,255,255,0.10)",
};

export const SANS =
  "'SF Pro Display','SF Pro Text','Helvetica Neue','Inter','Arial',sans-serif";
export const MONO = "'SF Mono','Roboto Mono','Menlo',monospace";
export const W = 1080;
export const H = 1920;

export const lerpHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
