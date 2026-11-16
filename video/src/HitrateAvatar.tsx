// Аватарка канала «ПРОГНОЗЫ КХЛ | HITRATE AI» (1000×1000, Telegram режет в круг).
// a — прицел с процентом, b — надпись «ПРОГНОЗ КХЛ».

import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { AbsoluteFill } from "remotion";

const { fontFamily } = loadFont("normal", { weights: ["700", "800"], subsets: ["cyrillic", "latin"] });

const GOLD = "#FFC400";
const BG = "radial-gradient(circle at 50% 40%, #2A2D36 0%, #111217 60%, #08090C 100%)";

export const HitrateAvatar: React.FC<{ variant: "a" | "b" }> = ({ variant }) => (
  <AbsoluteFill style={{ background: BG, fontFamily, color: "#F4F5F7", alignItems: "center", justifyContent: "center" }}>
    {variant === "a" ? <Target /> : <Wordmark />}
  </AbsoluteFill>
);

// Прицел: кольца, перекрестие, в центре «%» — «попадание в цель».
const Target: React.FC = () => (
  <div style={{ position: "relative", width: 1000, height: 1000 }}>
    <svg width={1000} height={1000} style={{ position: "absolute", inset: 0 }}>
      <circle cx={500} cy={500} r={330} fill="none" stroke={GOLD} strokeWidth={26} />
      <circle cx={500} cy={500} r={230} fill="none" stroke="rgba(255,196,0,0.35)" strokeWidth={10} />
      {[
        [500, 120, 500, 230],
        [500, 770, 500, 880],
        [120, 500, 230, 500],
        [770, 500, 880, 500],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth={26} strokeLinecap="round" />
      ))}
    </svg>
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 250, fontWeight: 800, lineHeight: 1, color: GOLD, letterSpacing: -6 }}>%</div>
      <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: 10, marginTop: 6 }}>КХЛ</div>
    </div>
  </div>
);

const Wordmark: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 14, color: GOLD }}>HITRATE</div>
    <div style={{ fontSize: 158, fontWeight: 800, lineHeight: 1, letterSpacing: -3, marginTop: 18 }}>ПРОГНОЗ</div>
    <div
      style={{
        marginTop: 26,
        padding: "8px 44px",
        borderRadius: 24,
        background: GOLD,
        color: "#111",
        fontSize: 130,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: 4,
      }}
    >
      КХЛ
    </div>
  </div>
);
