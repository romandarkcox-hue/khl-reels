import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import {
  ConferenceId,
  Standings,
  Team,
  formatDay,
  formatSeason,
} from "./standings";
import { THEMES, Theme } from "./themes";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["cyrillic", "latin"],
});

const PAD = 64;
const ROW_H = 66;
const LOGO = 52;
const COLS = { rank: 64, num: 78, goals: 128, pts: 104 };

export type StandingsCardProps = {
  conferenceId: ConferenceId;
  standings: Standings | null;
};

export const StandingsCard: React.FC<StandingsCardProps> = ({
  conferenceId,
  standings,
}) => {
  const t = THEMES[conferenceId];
  const conference = standings?.conferences.find((c) => c.id === conferenceId);

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        color: t.text,
        background: `linear-gradient(180deg, ${t.bgTop} 0%, ${t.bgBottom} 100%)`,
        padding: PAD,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at 100% 0%, ${t.glow}, transparent 70%)`,
        }}
      />

      {!standings || !conference ? (
        <div style={{ fontSize: 48, margin: "auto" }}>Нет данных таблицы</div>
      ) : (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
          <Header
            t={t}
            conferenceName={conference.name}
            day={formatDay(standings.fetchedAt)}
            season={formatSeason(standings.fetchedAt)}
          />
          <ColumnTitles t={t} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {conference.teams.map((team, i) => {
              const prev = conference.teams[i - 1];
              const showDivider = prev && prev.inPlayoffZone && !team.inPlayoffZone;
              return (
                <React.Fragment key={team.clubId}>
                  {showDivider ? <PlayoffLine t={t} /> : null}
                  <Row t={t} team={team} striped={i % 2 === 0} />
                </React.Fragment>
              );
            })}
          </div>
          <Footer t={t} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Header: React.FC<{ t: Theme; conferenceName: string; day: string; season: string }> = ({
  t,
  conferenceName,
  day,
  season,
}) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 5, color: t.accent }}>
        КХЛ · СЕЗОН {season}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, color: t.muted, marginTop: 18, letterSpacing: 2 }}>
        КОНФЕРЕНЦИЯ
      </div>
      <div style={{ fontSize: 118, fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginTop: 4 }}>
        {conferenceName.toUpperCase()}
      </div>
    </div>
    <div style={{ textAlign: "right", paddingBottom: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: t.muted, letterSpacing: 3 }}>ТАБЛИЦА НА</div>
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>{day}</div>
    </div>
  </div>
);

const cell = (width: number): React.CSSProperties => ({
  width,
  textAlign: "center",
  flexShrink: 0,
});

const ColumnTitles: React.FC<{ t: Theme }> = ({ t }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      fontSize: 22,
      fontWeight: 700,
      color: t.muted,
      letterSpacing: 2,
      padding: "0 16px 12px",
    }}
  >
    <div style={cell(COLS.rank)}>#</div>
    <div style={{ flex: 1, paddingLeft: LOGO + 26 }}>КОМАНДА</div>
    <div style={cell(COLS.num)}>И</div>
    <div style={cell(COLS.num)}>В</div>
    <div style={cell(COLS.num)}>П</div>
    <div style={cell(COLS.goals)}>Ш</div>
    <div style={cell(COLS.pts)}>О</div>
  </div>
);

const Row: React.FC<{ t: Theme; team: Team; striped: boolean }> = ({ t, team, striped }) => {
  const wins = team.w + team.otw + team.sow;
  const losses = team.l + team.otl + team.sol;
  const move = team.prevRank - team.rank;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_H,
        padding: "0 16px",
        borderRadius: 14,
        background: striped ? t.rowA : t.rowB,
        opacity: team.inPlayoffZone ? 1 : 0.55,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ ...cell(COLS.rank), fontSize: 30, fontWeight: 800, color: team.rank === 1 ? t.accent : t.text }}>
        {team.rank}
      </div>
      <div
        style={{
          width: LOGO,
          height: LOGO,
          borderRadius: LOGO / 2,
          background: t.logoBg,
          boxShadow: t.logoShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 6,
          flexShrink: 0,
        }}
      >
        {team.logo ? (
          <Img src={staticFile(team.logo)} style={{ width: LOGO - 10, height: LOGO - 10, objectFit: "contain" }} />
        ) : null}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, paddingLeft: 20, minWidth: 0 }}>
        <span style={{ fontSize: 34, fontWeight: 700, whiteSpace: "nowrap" }}>{team.name}</span>
        {move !== 0 ? (
          <span style={{ fontSize: 22, fontWeight: 800, color: move > 0 ? t.up : t.down }}>
            {move > 0 ? `▲${move}` : `▼${-move}`}
          </span>
        ) : null}
      </div>
      <div style={{ ...cell(COLS.num), fontSize: 30, fontWeight: 500, color: t.muted }}>{team.gp}</div>
      <div style={{ ...cell(COLS.num), fontSize: 30, fontWeight: 500 }}>{wins}</div>
      <div style={{ ...cell(COLS.num), fontSize: 30, fontWeight: 500 }}>{losses}</div>
      <div style={{ ...cell(COLS.goals), fontSize: 28, fontWeight: 500, color: t.muted }}>
        {team.goalsFor}–{team.goalsAgainst}
      </div>
      <div style={{ ...cell(COLS.pts), display: "flex", justifyContent: "center" }}>
        <div
          style={{
            minWidth: 76,
            padding: "6px 0",
            borderRadius: 12,
            background: t.ptsBg,
            fontSize: 34,
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          {team.pts}
        </div>
      </div>
    </div>
  );
};

const PlayoffLine: React.FC<{ t: Theme }> = ({ t }) => {
  const line: React.CSSProperties = {
    flex: 1,
    height: 0,
    borderTop: `3px dashed ${t.accent}`,
    opacity: 0.7,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, height: 40, padding: "0 8px" }}>
      <div style={line} />
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, color: t.accent }}>ЛИНИЯ ПЛЕЙ-ОФФ</div>
      <div style={line} />
    </div>
  );
};

const Footer: React.FC<{ t: Theme }> = ({ t }) => (
  <div
    style={{
      marginTop: "auto",
      display: "flex",
      justifyContent: "space-between",
      fontSize: 21,
      fontWeight: 500,
      color: t.muted,
    }}
  >
    <span>Данные: khl.ru</span>
    <span>В и П с учётом овертаймов и буллитов</span>
  </div>
);
