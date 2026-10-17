import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Logo, SAFE_TOP, formatDay } from "./shared";
import { Review } from "./types";

const plural = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} МАТЧ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} МАТЧА`;
  return `${n} МАТЧЕЙ`;
};

export const Intro: React.FC<{ review: Review }> = ({ review }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 } });

  const logos = review.matches.flatMap((m) => [m.home, m.away]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 900px at 50% 30%, ${C.bg2}, ${C.bg} 70%)`,
        color: C.text,
        alignItems: "center",
        paddingTop: SAFE_TOP + 120,
      }}
    >
      {/* Косые «ледовые» полосы */}
      <AbsoluteFill style={{ overflow: "hidden", opacity: 0.18 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -400 + i * 380 + interpolate(frame, [0, 120], [0, 120]),
              top: -200,
              width: 90,
              height: 2600,
              background: C.accent,
              transform: "rotate(25deg)",
            }}
          />
        ))}
      </AbsoluteFill>

      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: 8,
          color: C.accent,
          opacity: enter(0),
          transform: `translateY(${(1 - enter(0)) * 40}px)`,
        }}
      >
        КХЛ · {formatDay(review.date).toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 190,
          fontWeight: 800,
          lineHeight: 0.95,
          marginTop: 40,
          letterSpacing: -4,
          transform: `scale(${0.8 + 0.2 * enter(4)})`,
          opacity: enter(4),
        }}
      >
        ИТОГИ
      </div>
      <div
        style={{
          fontSize: 92,
          fontWeight: 800,
          color: C.muted,
          letterSpacing: 2,
          opacity: enter(10),
          transform: `translateY(${(1 - enter(10)) * 40}px)`,
        }}
      >
        ИГРОВОГО ДНЯ
      </div>
      <div
        style={{
          marginTop: 60,
          padding: "16px 40px",
          borderRadius: 999,
          background: "rgba(92,200,255,0.16)",
          border: `2px solid ${C.accent}`,
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 4,
          opacity: enter(16),
        }}
      >
        {plural(review.matches.length)}
      </div>

      <div
        style={{
          marginTop: 80,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 26,
          maxWidth: 860,
        }}
      >
        {logos.map((t, i) => {
          const p = enter(22 + i * 3);
          return (
            <div key={`${t.clubId}-${i}`} style={{ opacity: p, transform: `scale(${0.5 + 0.5 * p})` }}>
              <Logo src={t.logo} size={120} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
