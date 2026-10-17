import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, SAFE_TOP } from "./shared";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 900px at 50% 40%, ${C.bg2}, ${C.bg} 70%)`,
        color: C.text,
        alignItems: "center",
        paddingTop: SAFE_TOP + 260,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 8, color: C.accent, opacity: enter(0) }}>
        ЗАВТРА В 7:00
      </div>
      <div
        style={{
          marginTop: 30,
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1.05,
          opacity: enter(4),
          transform: `translateY(${(1 - enter(4)) * 40}px)`,
        }}
      >
        ТАБЛИЦЫ
        <br />
        КОНФЕРЕНЦИЙ
      </div>
      <div style={{ marginTop: 20, fontSize: 40, fontWeight: 600, color: C.muted, opacity: enter(8) }}>
        в утренней карусели
      </div>
      <div
        style={{
          marginTop: 90,
          padding: "26px 60px",
          borderRadius: 999,
          background: C.accent,
          color: "#04101F",
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: 3,
          transform: `scale(${0.7 + 0.3 * enter(14)})`,
          opacity: enter(14),
        }}
      >
        ПОДПИСЫВАЙТЕСЬ
      </div>
    </AbsoluteFill>
  );
};
