// Картинка канала «ПРОГНОЗЫ КХЛ | HITRATE AI»: утром прогнозы на день,
// вечером та же раскладка со счетами и отметкой «угадали / нет».
// Данные: public/predict.json или public/check.json (пишет scripts/hitrate-card.mjs).

import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { formatWeekday } from "./announce";
import { formatDay, formatSeason } from "./standings";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["cyrillic", "latin"],
});

export type PredictKind = "predict" | "check";

export type PredictTeam = { name: string; logo: string | null };

export type PredictMatch = {
  time: string;
  home: PredictTeam;
  away: PredictTeam;
  favorite: "home" | "away";
  prob: number; // вероятность победы фаворита, 0.5–1
  confident: boolean;
  score?: { home: number; away: number; ots: "OT" | "SO" | null } | null;
  hit?: boolean | null; // вечером: угадан ли победитель
  goals?: number; // ожидаемый тотал (справочно)
  leagueGoals?: number; // средний тотал лиги
};

export type PredictData = {
  date: string;
  matches: PredictMatch[];
  hitrate: { hits: number; total: number } | null; // по уверенным прогнозам
};

export type PredictCardProps = { kind: PredictKind; data: PredictData | null };

// Графит и золото: «ставка сыграла».
const C = {
  bgTop: "#1A1C22",
  bgBottom: "#0B0C10",
  glow: "rgba(255,196,0,0.14)",
  gold: "#FFC400",
  text: "#F4F5F7",
  muted: "#8B909C",
  row: "rgba(255,255,255,0.05)",
  rowConfident: "rgba(255,196,0,0.10)",
  hit: "#2BD576",
  miss: "#FF4D5E",
};

const PAD = 64;
const OTS_LABEL = { OT: "ОТ", SO: "Б" };

export const PredictCard: React.FC<PredictCardProps> = ({ kind, data }) => {
  if (!data?.matches.length) {
    return (
      <AbsoluteFill style={{ background: C.bgBottom, color: C.text, fontFamily }}>
        <div style={{ margin: "auto", fontSize: 48 }}>Нет данных прогноза</div>
      </AbsoluteFill>
    );
  }
  const n = data.matches.length;
  const gap = 14;
  const rowH = Math.min(170, Math.floor((860 - gap * (n - 1)) / n));

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
        style={{ background: `radial-gradient(900px 600px at 100% 0%, ${C.glow}, transparent 70%)` }}
      />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
        <Header kind={kind} date={data.date} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap }}>
          {data.matches.map((m, i) => (
            <Row key={i} match={m} kind={kind} h={rowH} />
          ))}
        </div>
        <Footer hitrate={data.hitrate} />
      </div>
    </AbsoluteFill>
  );
};

const Header: React.FC<{ kind: PredictKind; date: string }> = ({ kind, date }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 5, color: C.gold }}>
        HITRATE AI · КХЛ {formatSeason(date)}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, color: C.muted, marginTop: 18, letterSpacing: 2 }}>
        {kind === "predict" ? "КТО ПОБЕДИТ" : "ПРОВЕРКА ПРОГНОЗОВ"}
      </div>
      <div style={{ fontSize: 112, fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginTop: 4 }}>
        {kind === "predict" ? "ПРОГНОЗ" : "ИТОГИ"}
      </div>
    </div>
    <div style={{ textAlign: "right", paddingBottom: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: 3 }}>
        {formatWeekday(date).toUpperCase()}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>{formatDay(date)}</div>
    </div>
  </div>
);

const Row: React.FC<{ match: PredictMatch; kind: PredictKind; h: number }> = ({ match, kind, h }) => {
  const big = h >= 150;
  const logo = big ? 92 : Math.max(56, h - 50);
  const checked = kind === "check" && match.hit !== undefined && match.hit !== null;
  const edge = checked ? (match.hit ? C.hit : C.miss) : match.confident ? C.gold : "transparent";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        height: h,
        padding: "0 24px",
        borderRadius: 20,
        background: match.confident ? C.rowConfident : C.row,
        border: `3px solid ${match.confident ? "rgba(255,196,0,0.55)" : "transparent"}`,
        borderLeft: `10px solid ${edge}`,
      }}
    >
      <Team team={match.home} align="left" fav={match.favorite === "home"} logo={logo} />
      <Center match={match} kind={kind} />
      <Team team={match.away} align="right" fav={match.favorite === "away"} logo={logo} />
      {match.confident ? (
        <div
          style={{
            position: "absolute",
            top: -3,
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "4px 14px",
            borderRadius: 10,
            background: C.gold,
            color: "#111",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 3,
          }}
        >
          УВЕРЕННЫЙ
        </div>
      ) : null}
    </div>
  );
};

// Заметно результативнее среднего по лиге — оранжевым, заметно «суше» — голубым.
const goalsColor = (m: PredictMatch) => {
  if (m.goals == null || m.leagueGoals == null) return C.muted;
  if (m.goals >= m.leagueGoals + 0.4) return "#FF9F43";
  if (m.goals <= m.leagueGoals - 0.4) return "#6EC6FF";
  return C.muted;
};

const Center: React.FC<{ match: PredictMatch; kind: PredictKind }> = ({ match, kind }) => {
  const pct = Math.round(match.prob * 100);
  const score = kind === "check" ? match.score : null;
  const pill = (content: React.ReactNode, color: string) => (
    <div
      style={{
        padding: "6px 16px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
        fontSize: 38,
        fontWeight: 800,
        color,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {content}
    </div>
  );
  return (
    <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {score ? (
        pill(`${score.home} : ${score.away}`, C.text)
      ) : (
        pill(`${pct}%`, match.confident ? C.gold : C.text)
      )}
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 3,
          marginTop: 8,
          color: score ? (match.hit ? C.hit : C.miss) : C.muted,
        }}
      >
        {score
          ? `${match.hit ? "УГАДАЛИ" : "МИМО"}${score.ots ? " · " + OTS_LABEL[score.ots] : ""} · ${pct}%`
          : `${match.time} МСК`}
      </div>
      {!score && match.goals != null ? (
        <div style={{ fontSize: 17, fontWeight: 700, color: goalsColor(match), marginTop: 4, letterSpacing: 1 }}>
          ~{String(match.goals).replace(".", ",")}{" "}
          {Number.isInteger(match.goals) && (match.goals % 10 < 2 || match.goals % 10 > 4) ? "шайб" : "шайбы"}
        </div>
      ) : null}
    </div>
  );
};

const Team: React.FC<{ team: PredictTeam; align: "left" | "right"; fav: boolean; logo: number }> = ({
  team,
  align,
  fav,
  logo,
}) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: align === "left" ? "row" : "row-reverse",
      alignItems: "center",
      gap: 18,
    }}
  >
    <div
      style={{
        width: logo,
        height: logo,
        borderRadius: logo / 2,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        opacity: fav ? 1 : 0.55,
        boxShadow: fav ? `0 0 0 4px ${C.gold}` : "none",
      }}
    >
      {team.logo ? (
        <Img src={staticFile(team.logo)} style={{ width: logo * 0.82, height: logo * 0.82, objectFit: "contain" }} />
      ) : null}
    </div>
    <div
      style={{
        minWidth: 0,
        fontSize: team.name.length > 11 ? 27 : 32,
        fontWeight: 800,
        textAlign: align,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: fav ? C.text : C.muted,
      }}
    >
      {team.name}
    </div>
  </div>
);

const Footer: React.FC<{ hitrate: PredictData["hitrate"] }> = ({ hitrate }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 28,
      fontSize: 24,
      fontWeight: 700,
      color: C.muted,
    }}
  >
    <span>Вероятность победы фаворита · модель на статистике</span>
    <span style={{ color: C.gold, fontWeight: 800 }}>
      {hitrate && hitrate.total
        ? `HITRATE ${Math.round((100 * hitrate.hits) / hitrate.total)}% · ${hitrate.hits}/${hitrate.total}`
        : "HITRATE · СТАРТ"}
    </span>
  </div>
);
