import { loadFont } from "@remotion/google-fonts/Manrope";
import React from "react";
import { AbsoluteFill } from "remotion";
import { clubColor } from "./clubColors";
import {
  ConferenceId,
  Standings,
  Team,
  formatDay,
  formatSeason,
} from "./standings";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["cyrillic", "latin"],
});

const C = {
  bgTop: "#0B1428",
  bgBottom: "#060A14",
  accent: "#5CC8FF",
  text: "#F2F6FF",
  muted: "#8593B3",
  rowA: "rgba(255,255,255,0.055)",
  rowB: "rgba(255,255,255,0.025)",
  up: "#4ADE80",
  down: "#F87171",
};

const PAD = 64;
const ROW_H = 66;
const COLS = { rank: 64, num: 78, goals: 128, pts: 104 };

export type StandingsCardProps = {
  conferenceId: ConferenceId;
  standings: Standings | null;
};

export const StandingsCard: React.FC<StandingsCardProps> = ({
  conferenceId,
  standings,
}) => {
  const conference = standings?.conferences.find((c) => c.id === conferenceId);

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        color: C.text,
        background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`,
        padding: PAD,
      }}
    >
      {/* Холодное свечение в углу */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at 100% 0%, rgba(92,200,255,0.16), transparent 70%)`,
        }}
      />

      {!standings || !conference ? (
        <div style={{ fontSize: 48, margin: "auto" }}>Нет данных таблицы</div>
      ) : (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
          <Header
            conferenceName={conference.name}
            day={formatDay(standings.fetchedAt)}
            season={formatSeason(standings.fetchedAt)}
          />
          <ColumnTitles />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {conference.teams.map((team, i) => {
              const prev = conference.teams[i - 1];
              const showDivider = prev && prev.inPlayoffZone && !team.inPlayoffZone;
              return (
                <React.Fragment key={team.clubId}>
                  {showDivider ? <PlayoffLine /> : null}
                  <Row team={team} striped={i % 2 === 0} />
                </React.Fragment>
              );
            })}
          </div>
          <Footer />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Header: React.FC<{ conferenceName: string; day: string; season: string }> = ({
  conferenceName,
  day,
  season,
}) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 5, color: C.accent }}>
        КХЛ · СЕЗОН {season}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, color: C.muted, marginTop: 18, letterSpacing: 2 }}>
        КОНФЕРЕНЦИЯ
      </div>
      <div style={{ fontSize: 118, fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginTop: 4 }}>
        {conferenceName.toUpperCase()}
      </div>
    </div>
    <div style={{ textAlign: "right", paddingBottom: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.muted, letterSpacing: 3 }}>ТАБЛИЦА НА</div>
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6 }}>{day}</div>
    </div>
  </div>
);

const cell = (width: number): React.CSSProperties => ({
  width,
  textAlign: "center",
  flexShrink: 0,
});

const ColumnTitles: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      fontSize: 22,
      fontWeight: 700,
      color: C.muted,
      letterSpacing: 2,
      padding: "0 16px 12px",
    }}
  >
    <div style={cell(COLS.rank)}>#</div>
    <div style={{ flex: 1, paddingLeft: 28 }}>КОМАНДА</div>
    <div style={cell(COLS.num)}>И</div>
    <div style={cell(COLS.num)}>В</div>
    <div style={cell(COLS.num)}>П</div>
    <div style={cell(COLS.goals)}>Ш</div>
    <div style={cell(COLS.pts)}>О</div>
  </div>
);

const Row: React.FC<{ team: Team; striped: boolean }> = ({ team, striped }) => {
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
        background: striped ? C.rowA : C.rowB,
        opacity: team.inPlayoffZone ? 1 : 0.55,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ ...cell(COLS.rank), fontSize: 30, fontWeight: 800, color: team.rank === 1 ? C.accent : C.text }}>
        {team.rank}
      </div>
      <div
        style={{
          width: 8,
          height: 38,
          borderRadius: 4,
          background: clubColor(team.name),
          marginLeft: 8,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, paddingLeft: 20, minWidth: 0 }}>
        <span style={{ fontSize: 34, fontWeight: 700, whiteSpace: "nowrap" }}>{team.name}</span>
        {move !== 0 ? (
          <span style={{ fontSize: 22, fontWeight: 800, color: move > 0 ? C.up : C.down }}>
            {move > 0 ? `▲${move}` : `▼${-move}`}
          </span>
        ) : null}
      </div>
      <div style={{ ...cell(COLS.num), fontSize: 30, fontWeight: 500, color: C.muted }}>{team.gp}</div>
      <div style={{ ...cell(COLS.num), fontSize: 30, fontWeight: 500 }}>{wins}</div>
      <div style={{ ...cell(COLS.num), fontSize: 30, fontWeight: 500 }}>{losses}</div>
      <div style={{ ...cell(COLS.goals), fontSize: 28, fontWeight: 500, color: C.muted }}>
        {team.goalsFor}–{team.goalsAgainst}
      </div>
      <div style={{ ...cell(COLS.pts), display: "flex", justifyContent: "center" }}>
        <div
          style={{
            minWidth: 76,
            padding: "6px 0",
            borderRadius: 12,
            background: "rgba(92,200,255,0.14)",
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

const PlayoffLine: React.FC = () => {
  const line: React.CSSProperties = {
    flex: 1,
    height: 0,
    borderTop: `3px dashed ${C.accent}`,
    opacity: 0.7,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, height: 40, padding: "0 8px" }}>
      <div style={line} />
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, color: C.accent }}>ЛИНИЯ ПЛЕЙ-ОФФ</div>
      <div style={line} />
    </div>
  );
};

const Footer: React.FC = () => (
  <div
    style={{
      marginTop: "auto",
      display: "flex",
      justifyContent: "space-between",
      fontSize: 21,
      fontWeight: 500,
      color: C.muted,
    }}
  >
    <span>Данные: khl.ru</span>
    <span>В и П с учётом овертаймов и буллитов</span>
  </div>
);
