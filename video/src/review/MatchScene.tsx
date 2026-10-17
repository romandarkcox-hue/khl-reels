import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clubColor } from "../clubColors";
import { C, HEIGHT, Logo, SAFE_TOP, WIDTH } from "./shared";
import { Goal, Match, MatchTeam } from "./types";

const CONF_WHERE = { west: "Запад", east: "Восток" };
const STRENGTH = { pp: "БОЛ", sh: "МЕН", en: "П.В." };

// Сцена матча из трёх фаз: противостояние → голы → таблица.
export const MatchScene: React.FC<{ match: Match; frames: number }> = ({ match, frames }) => {
  const frame = useCurrentFrame();
  const goalsStart = Math.round(Math.min(Math.max(frames * 0.35, 3 * 30), 5 * 30));
  const tableStart = Math.round(frames * 0.78);

  const toGoals = interpolate(frame, [goalsStart - 8, goalsStart + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const toTable = interpolate(frame, [tableStart - 8, tableStart + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: C.bg, color: C.text }}>
      {/* Противостояние уходит в размытие и затемнение под панелями голов и таблицы */}
      <AbsoluteFill style={{ filter: `blur(${toGoals * 18}px)`, transform: `scale(${1 + toGoals * 0.06})` }}>
        <Faceoff match={match} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.bg, opacity: toGoals * 0.93 }} />
      {toGoals > 0 ? (
        <AbsoluteFill style={{ opacity: toGoals * (1 - toTable) }}>
          <ScoreHeader match={match} />
          <GoalList match={match} startFrame={goalsStart} />
        </AbsoluteFill>
      ) : null}
      {toTable > 0 ? (
        <AbsoluteFill style={{ opacity: toTable }}>
          <ScoreHeader match={match} />
          <TablePanel match={match} startFrame={tableStart} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// Экран, разделённый по диагонали: сверху хозяева, снизу гости, по центру счёт.
const Faceoff: React.FC<{ match: Match }> = ({ match }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inHome = spring({ frame, fps, config: { damping: 200 } });
  const inAway = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const inScore = spring({ frame: frame - 12, fps, config: { damping: 12, mass: 0.6 } });

  // Линия раздела на 40% высоты, чтобы всё важное было выше субтитров.
  const splitY = HEIGHT * 0.4;
  const half = (team: MatchTeam, top: boolean, p: number) => {
    const color = clubColor(team.name);
    const clip = top
      ? "polygon(0 0, 100% 0, 100% 37%, 0 43%)"
      : "polygon(0 43%, 100% 37%, 100% 100%, 0 100%)";
    return (
      <AbsoluteFill
        style={{
          clipPath: clip,
          background: `linear-gradient(${top ? 160 : 340}deg, ${color} 0%, #0A0F1E 85%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: top ? SAFE_TOP + 10 : splitY + 175,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            transform: `translateX(${(1 - p) * (top ? -WIDTH : WIDTH)}px)`,
          }}
        >
          <Logo src={team.logo} size={210} />
          <div style={{ fontSize: 76, fontWeight: 800, textAlign: "center", lineHeight: 1 }}>{team.name}</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 5, color: "rgba(255,255,255,0.7)" }}>
            {top ? "ХОЗЯЕВА" : "ГОСТИ"}
          </div>
        </div>
      </AbsoluteFill>
    );
  };

  const ots = match.ots === "OT" ? "ОВЕРТАЙМ" : match.ots === "SO" ? "БУЛЛИТЫ" : null;

  return (
    <AbsoluteFill>
      {half(match.home, true, inHome)}
      {half(match.away, false, inAway)}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: splitY - 110,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${inScore})`,
        }}
      >
        <div
          style={{
            padding: "18px 64px",
            borderRadius: 36,
            background: "#060912",
            border: "3px solid rgba(255,255,255,0.12)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: 6,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {match.home.score}:{match.away.score}
        </div>
        {ots ? (
          <div
            style={{
              marginTop: -18,
              padding: "8px 26px",
              borderRadius: 999,
              background: C.accent,
              color: "#04101F",
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 4,
            }}
          >
            {ots}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const ScoreHeader: React.FC<{ match: Match }> = ({ match }) => (
  <div
    style={{
      position: "absolute",
      top: SAFE_TOP,
      left: 60,
      right: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <TeamTag team={match.home} />
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 96, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
        {match.home.score}:{match.away.score}
      </div>
      {match.ots ? (
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: C.accent }}>
          {match.ots === "OT" ? "ОВЕРТАЙМ" : "БУЛЛИТЫ"}
        </div>
      ) : null}
    </div>
    <TeamTag team={match.away} />
  </div>
);

const TeamTag: React.FC<{ team: MatchTeam }> = ({ team }) => (
  <div style={{ width: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
    <Logo src={team.logo} size={130} />
    <div style={{ fontSize: 36, fontWeight: 800, textAlign: "center", lineHeight: 1.1 }}>{team.name}</div>
  </div>
);

const GoalList: React.FC<{ match: Match; startFrame: number }> = ({ match, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const goals = match.goals;
  // Список должен заканчиваться выше субтитров (около y = 1300).
  const compact = goals.length > 6;
  const rowH = goals.length > 9 ? 62 : compact ? 72 : 88;

  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_TOP + 280,
        left: 50,
        right: 50,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 10,
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: C.accent, marginBottom: 8 }}>
        {goals.length ? "ГОЛЫ" : "БЕЗ ГОЛОВ"}
      </div>
      {goals.map((g, i) => {
        const p = spring({ frame: frame - startFrame - 6 - i * 5, fps, config: { damping: 200 } });
        return <GoalRow key={i} goal={g} match={match} height={rowH} progress={p} />;
      })}
    </div>
  );
};

const GoalRow: React.FC<{ goal: Goal; match: Match; height: number; progress: number }> = ({
  goal,
  match,
  height,
  progress,
}) => {
  const team = goal.side === "home" ? match.home : match.away;
  const label = goal.shootout ? "Б" : goal.time;
  const strength = goal.strength ? STRENGTH[goal.strength] : goal.shootout ? "ПОБЕДНЫЙ БУЛЛИТ" : null;

  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "0 22px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.06)",
        borderLeft: `8px solid ${clubColor(team.name)}`,
        opacity: progress,
        transform: `translateX(${(1 - progress) * 80}px)`,
      }}
    >
      <div style={{ width: 120, fontSize: 30, fontWeight: 700, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
        {label}
      </div>
      <Logo src={team.logo} size={height - 30} shadow="none" />
      <div style={{ width: 92, fontSize: 36, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{goal.score}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 34, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {goal.scorer?.name ?? "—"}
          {goal.scorer?.seasonGoals ? (
            <span style={{ color: C.muted, fontWeight: 700 }}> ({goal.scorer.seasonGoals})</span>
          ) : null}
        </div>
        {goal.assists.length ? (
          <div style={{ fontSize: 24, fontWeight: 500, color: C.muted, whiteSpace: "nowrap" }}>
            {goal.assists.map((a) => a.surname).join(", ")}
          </div>
        ) : null}
      </div>
      {strength ? (
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 10,
            background: "rgba(92,200,255,0.16)",
            color: C.accent,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 2,
          }}
        >
          {strength}
        </div>
      ) : null}
    </div>
  );
};

const TablePanel: React.FC<{ match: Match; startFrame: number }> = ({ match, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const teams = [match.home, match.away].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div style={{ position: "absolute", top: SAFE_TOP + 340, left: 50, right: 50 }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: C.accent, marginBottom: 24 }}>
        ПОЛОЖЕНИЕ В ТАБЛИЦЕ
      </div>
      {teams.map((t, i) => {
        const p = spring({ frame: frame - startFrame - 4 - i * 6, fps, config: { damping: 200 } });
        const move = t.prevRank && t.rank ? t.prevRank - t.rank : 0;
        return (
          <div
            key={t.clubId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "26px 28px",
              marginBottom: 18,
              borderRadius: 24,
              background: "rgba(255,255,255,0.07)",
              opacity: p,
              transform: `translateY(${(1 - p) * 40}px)`,
            }}
          >
            <div style={{ width: 110, fontSize: 64, fontWeight: 800, textAlign: "center" }}>{t.rank ?? "—"}</div>
            <Logo src={t.logo} size={96} shadow="none" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 42, fontWeight: 800 }}>{t.name}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: C.muted }}>
                {t.conf ? `Конференция «${CONF_WHERE[t.conf]}»` : ""}
                {move !== 0 ? (
                  <span style={{ color: move > 0 ? C.up : C.down, fontWeight: 800 }}>
                    {"  "}
                    {move > 0 ? `▲${move}` : `▼${-move}`}
                  </span>
                ) : null}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, fontWeight: 800 }}>{t.pts ?? "—"}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>ОЧКИ</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
