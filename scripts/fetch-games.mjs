// Матчи КХЛ за день: счёт, голы и положение команд в таблице после игры.
// Данные для вечернего Reels «Итоги игрового дня».
//
// Запуск:  node scripts/fetch-games.mjs [ГГГГ-ММ-ДД]   (по умолчанию сегодня по Москве)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORY_DIR,
  PUBLIC_DIR,
  downloadLogos,
  fetchStandings,
} from "./fetch-standings.mjs";
import { moscowNow, openSession, restPost, TOURNAMENT } from "./khl.mjs";
import { loadPreviousSnapshot } from "./post-text.mjs";

const REVIEW_PATH = join(PUBLIC_DIR, "review.json");

function addDays(isoDay, days) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function gameStatus(g) {
  if (g.isOnline) return "live";
  if (g.homeScore !== undefined && g.homeScore !== "") return "final";
  return "scheduled";
}

// "Костенко Дмитрий(2)" -> { name: "Дмитрий Костенко", surname: "Костенко", seasonGoals: 2 }
function parsePlayer(raw) {
  if (!raw?.name) return null;
  const m = raw.name.match(/^(.*?)\s*\((\d+)\)\s*$/);
  const full = (m ? m[1] : raw.name).trim();
  const [surname, ...rest] = full.split(/\s+/);
  const first = rest.filter((p) => !/^[А-ЯЁA-Z]\.$/.test(p)).join(" ");
  return {
    name: first ? `${first} ${surname}` : surname,
    surname,
    seasonGoals: m ? Number(m[2]) : null,
  };
}

function parseGoals(protocol, ots) {
  const goals = Object.values(protocol.goals ?? {}).flat();
  return goals
    .map((g) => ({
      period: Number(g.per),
      time: g.pmg_time,
      side: g.teamAB === "A" ? "home" : "away",
      score: `${g.scoreA}:${g.scoreB}`,
      scorer: parsePlayer(g.scorer),
      assists: [parsePlayer(g.assist_1), parsePlayer(g.assist_2)].filter(Boolean),
      strength:
        g.pmg === "БОЛ" ? "pp" : g.pmg === "МЕН" ? "sh" : /пуст/i.test(g.pmg_trans ?? "") ? "en" : null,
      // Победный буллит сайт записывает как «гол» 4-го периода на 65:00.
      shootout: ots === "SO" && Number(g.per) >= 4,
    }))
    .sort((a, b) => a.period - b.period || a.time.localeCompare(b.time));
}

export async function fetchDay(isoDay) {
  const session = await openSession("/calendar/");
  const calendar = await restPost(session, "calendar/list");
  const dayGames = calendar.GAMES.flatMap((o) => o?.[isoDay] ?? []).sort((a, b) =>
    a.time_format.localeCompare(b.time_format),
  );

  const standings = await fetchStandings(session);
  await downloadLogos(standings);
  const teamById = new Map();
  for (const c of standings.conferences) {
    for (const t of c.teams) teamById.set(t.clubId, { ...t, conf: c.id });
  }
  // Место до игрового дня: последний снимок таблицы не позже этого дня.
  const before = loadPreviousSnapshot(HISTORY_DIR, addDays(isoDay, 1));
  const rankBefore = new Map();
  for (const c of before?.conferences ?? []) for (const t of c.teams) rankBefore.set(t.clubId, t.rank);

  const team = (id, score) => {
    const t = teamById.get(id);
    return {
      clubId: id,
      name: t?.name ?? calendar.TEAMS?.[id]?.NAME ?? String(id),
      logo: t?.logo ?? null,
      score: Number(score),
      conf: t?.conf ?? null,
      rank: t?.rank ?? null,
      prevRank: rankBefore.get(id) ?? t?.rank ?? null,
      pts: t?.pts ?? null,
    };
  };

  const matches = [];
  for (const g of dayGames) {
    if (gameStatus(g) !== "final") continue;
    const protocol = await restPost(session, "game/protocol", {
      "values[tournament]": TOURNAMENT,
      "values[gameid]": g.id,
    });
    matches.push({
      id: g.id,
      time: g.time_format,
      ots: g.ots || null, // "OT" | "SO" | null
      periods: Array.isArray(g.scP) ? g.scP : [],
      home: team(g.teama, g.homeScore),
      away: team(g.teamb, g.visitorScore),
      goals: parseGoals(protocol, g.ots),
    });
  }

  const statuses = dayGames.map(gameStatus);
  return {
    date: isoDay,
    fetchedAt: moscowNow(),
    total: dayGames.length,
    finished: statuses.filter((s) => s === "final").length,
    live: statuses.filter((s) => s === "live").length,
    lastStart: dayGames.at(-1)?.time_format ?? null,
    matches,
  };
}

export function saveReview(review) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(REVIEW_PATH, JSON.stringify(review, null, 2) + "\n");
  return REVIEW_PATH;
}

const STRENGTH = { pp: " (бол.)", sh: " (мен.)", en: " (п.в.)" };

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const day = process.argv[2] ?? moscowNow().slice(0, 10);
  const review = await fetchDay(day);
  saveReview(review);

  console.log(`${day}: матчей ${review.total}, завершено ${review.finished}, идёт ${review.live}`);
  for (const m of review.matches) {
    const extra = m.ots === "OT" ? " ОТ" : m.ots === "SO" ? " Б" : "";
    console.log(`\n${m.time}  ${m.home.name} — ${m.away.name}  ${m.home.score}:${m.away.score}${extra}`);
    for (const g of m.goals) {
      const who = g.side === "home" ? m.home.name : m.away.name;
      const assists = g.assists.length ? ` (${g.assists.map((a) => a.surname).join(", ")})` : "";
      const label = g.shootout ? "победный буллит" : `${g.period}п ${g.time}`;
      console.log(`   ${g.score}  ${label}  ${g.scorer?.name ?? "?"} [${who}]${assists}${STRENGTH[g.strength] ?? ""}`);
    }
    for (const t of [m.home, m.away]) {
      console.log(`   → ${t.name}: ${t.rank}-е место (${t.conf === "west" ? "Запад" : "Восток"}), ${t.pts} очк., было ${t.prevRank}-е`);
    }
  }
}
