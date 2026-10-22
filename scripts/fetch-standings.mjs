// Забирает турнирную таблицу КХЛ (регулярка) с khl.ru,
// сохраняет её в video/public/standings.json, скачивает логотипы клубов
// и кладёт снимок дня в data/history/ГГГГ-ММ-ДД.json.
//
// Запуск:  node scripts/fetch-standings.mjs

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, fetchWithCookies, moscowNow, openSession, restPost } from "./khl.mjs";

const CONFERENCE_NAMES = { west: "Запад", east: "Восток" };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = join(ROOT, "video", "public");
const OUTPUT_PATH = join(PUBLIC_DIR, "standings.json");
const LOGOS_DIR = join(PUBLIC_DIR, "logos");
export const HISTORY_DIR = join(ROOT, "data", "history");

// Поле приходит то строкой с JSON, то готовым массивом.
function parseMaybeJson(value, fallback) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toTeam(row, inPlayoffZone) {
  const [goalsFor, goalsAgainst] = String(row.s.g).split("-").map(Number);
  const lastMatches = parseMaybeJson(row.team_last_matches, []).map((m) => ({
    date: m.date,
    home: m.team_1,
    away: m.team_2,
    score: String(m.team_score).replace(/\s*—\s*/, ":"),
    win: m.win,
    id: m.link,
  }));
  return {
    rank: row.r,
    name: row.name,
    clubId: row.clubid,
    logo: `logos/${row.clubid}.png`,
    logoUrl: row.img ? `https:${row.img}` : null,
    gp: row.s.gp,
    w: row.s.w,
    otw: row.s.otw,
    sow: row.s.sow,
    otl: row.s.otl,
    sol: row.s.sol,
    l: row.s.l,
    pts: row.s.pts,
    goalsFor,
    goalsAgainst,
    inPlayoffZone,
    prevRank: row.live?.position?.old ?? row.r,
    lastMatches,
    nextOpponent: parseMaybeJson(row.team_next_match, null),
  };
}

export async function fetchStandings(session) {
  session ??= await openSession("/standings/");
  const data = await restPost(session, "standings/regular", { "values[type]": "regular" });

  const conferences = (data?.json?.conferences ?? []).map((conf) => {
    const teams = [];
    let inPlayoffZone = true;
    for (const row of conf.rows) {
      if (row.type === "divider") {
        inPlayoffZone = false;
        continue;
      }
      teams.push(toTeam(row, inPlayoffZone));
    }
    return { id: conf.item, name: CONFERENCE_NAMES[conf.item] ?? conf.item, teams };
  });

  for (const id of Object.keys(CONFERENCE_NAMES)) {
    const conf = conferences.find((c) => c.id === id);
    if (!conf?.teams.length) fail(`в ответе нет команд конференции «${CONFERENCE_NAMES[id]}»`);
  }

  return { fetchedAt: moscowNow(), conferences };
}

// Логотипы скачиваются один раз и дальше берутся из папки.
// Если логотип достать не удалось, у команды будет logo: null.
export async function downloadLogos(standings) {
  mkdirSync(LOGOS_DIR, { recursive: true });
  const cookies = new Map();
  for (const team of standings.conferences.flatMap((c) => c.teams)) {
    const path = join(PUBLIC_DIR, team.logo);
    if (!existsSync(path) && team.logoUrl) {
      const res = await fetchWithCookies(team.logoUrl, cookies).catch(() => null);
      const isImage = res?.ok && res.headers.get("content-type")?.startsWith("image/");
      if (isImage) writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    }
    if (!existsSync(path)) {
      console.warn(`Не удалось скачать логотип «${team.name}», будет без него`);
      team.logo = null;
    }
  }
}

// day — под какой датой сохранить снимок (вечером это игровой день,
// даже если таблицу забрали уже после полуночи). writeSnapshot: false — для пробных
// запусков, чтобы не перезаписать настоящий снимок дня.
export function saveStandings(standings, day = standings.fetchedAt.slice(0, 10), { writeSnapshot = true } = {}) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(standings, null, 2) + "\n");

  if (!writeSnapshot) return OUTPUT_PATH;
  // Снимок дня нужен, чтобы завтра понять, кто поднялся и кто опустился.
  mkdirSync(HISTORY_DIR, { recursive: true });
  const snapshot = {
    fetchedAt: standings.fetchedAt,
    conferences: standings.conferences.map((c) => ({
      id: c.id,
      teams: c.teams.map(({ rank, name, clubId, gp, pts, inPlayoffZone }) => ({
        rank,
        name,
        clubId,
        gp,
        pts,
        inPlayoffZone,
      })),
    })),
  };
  writeFileSync(join(HISTORY_DIR, `${day}.json`), JSON.stringify(snapshot, null, 2) + "\n");
  return OUTPUT_PATH;
}

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const standings = await fetchStandings();
  await downloadLogos(standings);
  saveStandings(standings);

  for (const conf of standings.conferences) {
    console.log(`\n== Конференция «${conf.name}» ==`);
    let shownDivider = false;
    for (const t of conf.teams) {
      if (!t.inPlayoffZone && !shownDivider) {
        console.log("   ---------- линия плей-офф ----------");
        shownDivider = true;
      }
      console.log(
        `${String(t.rank).padStart(2)}. ${t.name.padEnd(15)} И ${String(t.gp).padStart(2)}  О ${String(t.pts).padStart(2)}  ${t.goalsFor}-${t.goalsAgainst}`,
      );
    }
  }
  console.log(`\nСохранено: ${OUTPUT_PATH} (на ${standings.fetchedAt})`);
}
