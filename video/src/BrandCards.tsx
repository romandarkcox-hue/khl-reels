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

export type BrandStoryProps = { slide: 1 | 2 | 3 };

// Безопасная зона живой обложки на телефоне (замер по скриншоту пользователя 05.11):
// приложение ВК показывает в шапке группы только середину слайда (~x 95–1000,
// y 410–1340), сверху на неё ложатся кнопки «назад» и «настройки» (y до ~620),
// снизу слева — аватарка (x 140–350, y 1120–1330). Всё главное — в прямоугольнике
// SAFE, по центру и крупно. Ниже — то, что видно только при открытии на весь экран.
const SAFE = { left: 170, top: 640, width: 740, height: 460 };

const StoryHead: React.FC<{ over: string; title: React.ReactNode; sub: string }> = ({ over, title, sub }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 7, color: C.accent }}>{over}</div>
    <div style={{ fontSize: 112, fontWeight: 800, lineHeight: 1.02, marginTop: 14, letterSpacing: -2 }}>
      {title}
    </div>
    <div style={{ fontSize: 36, fontWeight: 500, color: C.muted, marginTop: 20 }}>{sub}</div>
  </div>
);

// Одна строка матча в безопасной зоне: эмблемы-кружки и время или счёт по центру.
const MiniMatch: React.FC<{ left: string; right: string; center: string }> = ({ left, right, center }) => {
  const badge = (color: string) => (
    <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: color }} />
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: 560,
        padding: "18px 28px",
        borderRadius: 26,
        background: C.row,
      }}
    >
      {badge(left)}
      <div style={{ fontSize: 64, fontWeight: 800 }}>{center}</div>
      {badge(right)}
    </div>
  );
};

const SLIDES: Record<1 | 2 | 3, { over: string; title: React.ReactNode; sub: string; demo: React.ReactNode }> = {
  1: {
    over: "СЕЗОН 2026/27",
    title: <>Таблица КХЛ</>,
    sub: "матчи · счета · таблицы",
    demo: (
      <div style={{ width: 560, display: "flex", flexDirection: "column", gap: 12 }}>
        {DEMO_ROWS.slice(0, 2).map((row, i) => (
          <DemoRow key={i} place={i + 1} color={row.color} width={row.width} pts={row.pts} height={70} />
        ))}
      </div>
    ),
  },
  2: {
    over: "КАЖДОЕ УТРО В 7:00",
    title: <>Матчи дня</>,
    sub: "время и места в таблице",
    demo: <MiniMatch left="#43A047" right="#E53935" center="19:30" />,
  },
  3: {
    over: "КАЖДЫЙ ВЕЧЕР",
    title: <>Счета дня</>,
    sub: "итоги и таблицы конференций",
    demo: <MiniMatch left="#8E24AA" right="#1E88E5" center="3 : 2" />,
  },
};

// Живая обложка ВК для телефона, 1080×1920.
export const BrandStory: React.FC<BrandStoryProps> = ({ slide }) => {
  const s = SLIDES[slide];
  return (
    <AbsoluteFill style={{ fontFamily, color: C.text }}>
      <Background glowAt="50% 38%" glowSize="900px 700px" />
      <div
        style={{
          position: "absolute",
          ...SAFE,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
        }}
      >
        <StoryHead over={s.over} title={s.title} sub={s.sub} />
        {s.demo}
      </div>
    </AbsoluteFill>
  );
};
