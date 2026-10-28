import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { AbsoluteFill } from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["cyrillic", "latin"],
});

// Те же цвета, что у картинок постов («вечерний лёд»).
const C = {
  bgTop: "#0D1F3D",
  bgBottom: "#050B18",
  glow: "rgba(79,195,247,0.22)",
  accent: "#4FC3F7",
  text: "#F2F6FC",
  muted: "#8A9BB8",
  row: "rgba(255,255,255,0.07)",
  line: "rgba(79,195,247,0.35)",
};

const Background: React.FC<{ glowAt: string; glowSize: string }> = ({ glowAt, glowSize }) => (
  <>
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)` }}
    />
    <AbsoluteFill
      style={{ background: `radial-gradient(${glowSize} at ${glowAt}, ${C.glow}, transparent 70%)` }}
    />
  </>
);

// Строки «таблицы» без настоящих клубов: место, цветная метка, полоска-название, очки.
const DEMO_ROWS = [
  { color: "#E53935", width: 0.78, pts: 38 },
  { color: "#FBC02D", width: 0.64, pts: 35 },
  { color: "#43A047", width: 0.7, pts: 33 },
  { color: "#1E88E5", width: 0.56, pts: 30 },
  { color: "#8E24AA", width: 0.62, pts: 28 },
];

const DemoRow: React.FC<{
  place: number;
  color: string;
  width: number;
  pts?: number;
  height: number;
}> = ({ place, color, width, pts, height }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: height * 0.3,
      height,
      padding: `0 ${height * 0.35}px`,
      borderRadius: height * 0.22,
      background: C.row,
    }}
  >
    <div
      style={{
        width: height * 0.6,
        fontSize: height * 0.42,
        fontWeight: 800,
        color: place <= 3 ? C.accent : C.muted,
        textAlign: "center",
      }}
    >
      {place}
    </div>
    <div
      style={{ width: height * 0.36, height: height * 0.36, borderRadius: "50%", background: color }}
    />
    <div style={{ flex: 1 }}>
      <div
        style={{
          width: `${width * 100}%`,
          height: height * 0.16,
          borderRadius: height * 0.08,
          background: "rgba(242,246,252,0.55)",
        }}
      />
    </div>
    {pts !== undefined && (
      <div style={{ fontSize: height * 0.4, fontWeight: 800, color: C.text }}>{pts}</div>
    )}
  </div>
);

export type BrandAvatarProps = { variant: "a" | "b" };

// Аватарка 1000×1000: ВК показывает её кругом, всё важное в центре.
export const BrandAvatar: React.FC<BrandAvatarProps> = ({ variant }) => (
  <AbsoluteFill style={{ fontFamily, color: C.text }}>
    <Background glowAt="50% 30%" glowSize="700px 600px" />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 860,
          height: 860,
          borderRadius: "50%",
          border: `10px solid ${C.line}`,
        }}
      />
      {variant === "a" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 300, fontWeight: 800, lineHeight: 1, letterSpacing: -8 }}>
            КХЛ
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: 18,
              color: C.accent,
              paddingLeft: 18,
            }}
          >
            ТАБЛИЦА
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
          <div style={{ width: 560, display: "flex", flexDirection: "column", gap: 22 }}>
            {DEMO_ROWS.slice(0, 3).map((row, i) => (
              <DemoRow key={i} place={i + 1} color={row.color} width={row.width} height={104} />
            ))}
          </div>
          <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>
            КХЛ
          </div>
        </div>
      )}
    </AbsoluteFill>
  </AbsoluteFill>
);

// Обложка 1920×768. На телефоне края обрезаются, поэтому всё держим ближе к центру.
export const BrandCover: React.FC = () => (
  <AbsoluteFill style={{ fontFamily, color: C.text }}>
    <Background glowAt="80% 10%" glowSize="1100px 700px" />
    {/* Синяя линия и круг вбрасывания, как на льду */}
    <div
      style={{
        position: "absolute",
        left: 1003,
        top: 0,
        bottom: 0,
        width: 14,
        background: "rgba(79,195,247,0.08)",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 1010 - 330,
        top: 384 - 330,
        width: 660,
        height: 660,
        borderRadius: "50%",
        border: "6px solid rgba(79,195,247,0.08)",
      }}
    />
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 120,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 760 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: C.accent }}>
          СЕЗОН 2026/27
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.02, marginTop: 18 }}>
          Турнирная
          <br />
          таблица КХЛ
        </div>
        <div style={{ fontSize: 30, fontWeight: 500, color: C.muted, marginTop: 34, lineHeight: 1.45 }}>
          Утром — матчи дня
          <br />
          Вечером — счета и таблицы конференций
        </div>
      </div>
      <div style={{ width: 520, display: "flex", flexDirection: "column", gap: 14 }}>
        {DEMO_ROWS.map((row, i) => (
          <React.Fragment key={i}>
            {i === 4 && (
              <div style={{ height: 0, borderTop: `3px dashed ${C.line}`, margin: "6px 0" }} />
            )}
            <DemoRow place={i + 1} color={row.color} width={row.width} pts={row.pts} height={76} />
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
