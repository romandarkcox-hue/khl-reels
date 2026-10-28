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

// Матч без настоящих клубов: две цветные «эмблемы» с полосками-названиями,
// посередине время или счёт.
const DemoMatch: React.FC<{ left: string; right: string; center: string; note?: string }> = ({
  left,
  right,
  center,
  note,
}) => {
  const team = (color: string, align: "flex-start" | "flex-end") => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: align, gap: 14 }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: color }} />
      </div>
      <div style={{ width: 150, height: 14, borderRadius: 7, background: "rgba(242,246,252,0.55)" }} />
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "30px 36px",
        borderRadius: 28,
        background: C.row,
        borderLeft: `8px solid ${left}`,
        borderRight: `8px solid ${right}`,
      }}
    >
      {team(left, "flex-start")}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            padding: "6px 26px",
            borderRadius: 18,
            background: "rgba(79,195,247,0.14)",
          }}
        >
          {center}
        </div>
        {note && (
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: C.muted }}>{note}</div>
        )}
      </div>
      {team(right, "flex-end")}
    </div>
  );
};

const StoryTitle: React.FC<{ over: string; title: React.ReactNode; sub?: React.ReactNode }> = ({
  over,
  title,
  sub,
}) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 8, color: C.accent }}>{over}</div>
    <div style={{ fontSize: 116, fontWeight: 800, lineHeight: 1.0, marginTop: 20 }}>{title}</div>
    {sub && (
      <div style={{ fontSize: 38, fontWeight: 500, color: C.muted, marginTop: 30, lineHeight: 1.4 }}>
        {sub}
      </div>
    )}
  </div>
);

export type BrandStoryProps = { slide: 1 | 2 | 3 };

// Живая обложка ВК для телефона, 1080×1920. Сверху и снизу экран закрывают
// кнопки приложения и название группы, поэтому всё главное в середине.
export const BrandStory: React.FC<BrandStoryProps> = ({ slide }) => (
  <AbsoluteFill style={{ fontFamily, color: C.text }}>
    <Background glowAt="85% 15%" glowSize="1000px 900px" />
    {/* Красная линия и круг вбрасывания, как на льду */}
    <div style={{ position: "absolute", left: 0, right: 0, top: 957, height: 6, background: "rgba(79,195,247,0.07)" }} />
    <div
      style={{
        position: "absolute",
        left: 540 - 420,
        top: 960 - 420,
        width: 840,
        height: 840,
        borderRadius: "50%",
        border: "6px solid rgba(79,195,247,0.07)",
      }}
    />
    <AbsoluteFill style={{ padding: "380px 90px 520px", justifyContent: "center", gap: 70 }}>
      {slide === 1 && (
        <>
          <StoryTitle
            over="КХЛ · СЕЗОН 2026/27"
            title={<>Турнирная<br />таблица<br />КХЛ</>}
            sub={<>Каждый игровой день:<br />матчи, счета и таблицы</>}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {DEMO_ROWS.slice(0, 3).map((row, i) => (
              <DemoRow key={i} place={i + 1} color={row.color} width={row.width} pts={row.pts} height={92} />
            ))}
          </div>
        </>
      )}
      {slide === 2 && (
        <>
          <StoryTitle over="КАЖДОЕ УТРО В 7:00" title={<>Матчи<br />дня</>} sub="Время начала и место команд в таблице" />
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <DemoMatch left="#43A047" right="#E53935" center="19:00" note="МСК" />
            <DemoMatch left="#1E88E5" right="#FBC02D" center="19:30" note="МСК" />
          </div>
        </>
      )}
      {slide === 3 && (
        <>
          <StoryTitle over="КАЖДЫЙ ВЕЧЕР" title={<>Счета<br />и таблицы</>} sub="Итоги дня и таблицы «Запад» и «Восток»" />
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <DemoMatch left="#8E24AA" right="#1E88E5" center="3 : 2" note="ОТ" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
              {DEMO_ROWS.slice(2, 5).map((row, i) => (
                <React.Fragment key={i}>
                  {i === 2 && <div style={{ borderTop: `3px dashed ${C.line}`, margin: "4px 0" }} />}
                  <DemoRow place={i + 7} color={row.color} width={row.width} pts={row.pts - 8} height={80} />
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </AbsoluteFill>
  </AbsoluteFill>
);
