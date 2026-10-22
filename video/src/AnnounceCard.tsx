import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import {
  Announce,
  AnnounceMatch,
  AnnounceTeam,
  DayCardKind,
  MatchScore,
  formatWeekday,
} from "./announce";
import { clubColor } from "./clubColors";
import { formatDay, formatSeason } from "./standings";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["cyrillic", "latin"],
});

const PAD = 64;

// Обычные строки и крупные (когда на картинке 1–2 матча): в крупных логотип над названием.
const SIZES = {
  normal: {
    rowH: 142,
    logo: 84,
    center: 156,
    name: 32,
    rank: 21,
    pill: 36,
    label: 18,
  },
  big: {
    rowH: 360,
    logo: 156,
    center: 220,
    name: 40,
    rank: 24,
    pill: 60,
    label: 22,
  },
};
type Size = (typeof SIZES)["normal"];

// Вечерний лёд: тёмно-синий фон и холодный голубой акцент.
const C = {
  bgTop: "#0D1F3D",
  bgBottom: "#050B18",
  glow: "rgba(79,195,247,0.18)",
  accent: "#4FC3F7",
  text: "#F2F6FC",
  muted: "#8A9BB8",
  row: "rgba(255,255,255,0.06)",
  pillBg: "rgba(79,195,247,0.14)",
};

const CONF_NAMES = { west: "Запад", east: "Восток" };

const TITLES: Record<
  DayCardKind,
  { over: string; title: string; footer: string; empty: string }
> = {
  announce: {
    over: "СЕГОДНЯ ИГРАЮТ",
    title: "МАТЧИ ДНЯ",
    footer: "Место в таблице своей конференции",
    empty: "Нет данных анонса",
  },
  results: {
    over: "ИГРОВОЙ ДЕНЬ",
    title: "ИТОГИ ДНЯ",
    footer: "Место в таблице конференции после матча",
    empty: "Нет данных о счетах",
  },
};

const OTS_LABEL = { OT: "ОТ", SO: "Б" };

export type AnnounceCardProps = {
  kind: DayCardKind;
  page: number; // с нуля
  announce: Announce | null;
};

export const AnnounceCard: React.FC<AnnounceCardProps> = ({
  kind,
  page,
  announce,
}) => {
  const matches = announce?.pages[page];
  const pageCount = announce?.pages.length ?? 0;
  const titles = TITLES[kind];

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        color: C.text,
        background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`,
        padding: PAD,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at 100% 0%, ${C.glow}, transparent 70%)`,
        }}
      />

      {!announce || !matches ? (
        <div style={{ fontSize: 48, margin: "auto" }}>{titles.empty}</div>
      ) : (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Header
            over={titles.over}
            title={titles.title}
            date={announce.date}
            page={page}
            pageCount={pageCount}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {matches.map((m, i) => (
              <Row
                key={i}
                match={m}
                size={matches.length <= 2 ? SIZES.big : SIZES.normal}
              />
            ))}
          </div>
          <Footer text={titles.footer} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Header: React.FC<{
  over: string;
  title: string;
  date: string;
  page: number;
  pageCount: number;
}> = ({ over, title, date, page, pageCount }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 24,
    }}
  >
    <div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 5,
          color: C.accent,
        }}
      >
        КХЛ · СЕЗОН {formatSeason(date)}
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: C.muted,
          marginTop: 18,
          letterSpacing: 2,
        }}
      >
        {over}
      </div>
      <div
        style={{
          fontSize: 118,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: -2,
          marginTop: 4,
        }}
      >
        {title}
      </div>
    </div>
    <div style={{ textAlign: "right", paddingBottom: 10 }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: 3,
        }}
      >
        {formatWeekday(date).toUpperCase()}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>
        {formatDay(date)}
      </div>
      {pageCount > 1 ? (
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: C.accent,
            marginTop: 8,
          }}
        >
          {page + 1} / {pageCount}
        </div>
      ) : null}
    </div>
  </div>
);

const Row: React.FC<{ match: AnnounceMatch; size: Size }> = ({
  match: { time, home, away, score },
  size,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      height: size.rowH,
      padding: "0 22px",
      borderRadius: 20,
      background: C.row,
      borderLeft: `8px solid ${clubColor(home.name)}`,
      borderRight: `8px solid ${clubColor(away.name)}`,
    }}
  >
    <TeamSide
      team={home}
      align="left"
      size={size}
      lost={score ? score.home < score.away : false}
    />
    <div
      style={{
        width: size.center,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {score ? (
        <Score score={score} size={size} />
      ) : (
        <Pill size={size}>{time}</Pill>
      )}
      <div
        style={{
          fontSize: size.label,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: 3,
          marginTop: 8,
        }}
      >
        {score ? (score.ots ? OTS_LABEL[score.ots] : "ФИНАЛ") : "МСК"}
      </div>
    </div>
    <TeamSide
      team={away}
      align="right"
      size={size}
      lost={score ? score.away < score.home : false}
    />
  </div>
);

const Pill: React.FC<{ children: React.ReactNode; size: Size }> = ({
  children,
  size,
}) => (
  <div
    style={{
      padding: "6px 14px",
      borderRadius: 14,
      background: C.pillBg,
      fontSize: size.pill,
      fontWeight: 800,
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

const Score: React.FC<{ score: MatchScore; size: Size }> = ({
  score,
  size,
}) => {
  const side = (goals: number, won: boolean) => (
    <span style={{ color: won ? C.text : C.muted }}>{goals}</span>
  );
  return (
    <Pill size={size}>
      {side(score.home, score.home > score.away)}
      <span style={{ color: C.muted, margin: "0 6px" }}>:</span>
      {side(score.away, score.away > score.home)}
    </Pill>
  );
};

const TeamSide: React.FC<{
  team: AnnounceTeam;
  align: "left" | "right";
  size: Size;
  lost: boolean;
}> = ({ team, align, size, lost }) => {
  const big = size === SIZES.big;
  const textAlign = big ? "center" : align;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: big
          ? "column"
          : align === "left"
            ? "row"
            : "row-reverse",
        alignItems: "center",
        gap: big ? 22 : 18,
      }}
    >
      <div
        style={{
          width: size.logo,
          height: size.logo,
          borderRadius: size.logo / 2,
          background: "#FFFFFF",
          boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          opacity: lost ? 0.6 : 1,
        }}
      >
        {team.logo ? (
          <Img
            src={staticFile(team.logo)}
            style={{
              width: size.logo * 0.83,
              height: size.logo * 0.83,
              objectFit: "contain",
            }}
          />
        ) : null}
      </div>
      <div style={{ minWidth: 0, maxWidth: "100%", textAlign }}>
        <div
          style={{
            fontSize: size.name,
            fontWeight: 800,
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: lost ? C.muted : C.text,
          }}
        >
          {team.name}
        </div>
        {team.rank && team.conf ? (
          <div
            style={{
              fontSize: size.rank,
              fontWeight: 700,
              color: C.muted,
              marginTop: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: C.accent }}>{team.rank}-е</span> место ·{" "}
            {CONF_NAMES[team.conf]}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Footer: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      marginTop: 24,
      display: "flex",
      justifyContent: "space-between",
      fontSize: 21,
      fontWeight: 500,
      color: C.muted,
    }}
  >
    <span>Данные: khl.ru</span>
    <span>{text}</span>
  </div>
);
