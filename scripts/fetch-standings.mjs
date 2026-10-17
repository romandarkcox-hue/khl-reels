// Забирает турнирную таблицу КХЛ (регулярка) с khl.ru,
// сохраняет её в video/public/standings.json, скачивает логотипы клубов
// и кладёт снимок дня в data/history/ГГГГ-ММ-ДД.json.
//
// Запуск:  node scripts/fetch-standings.mjs

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CONFERENCE_NAMES = { west: "Запад", east: "Восток" };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "video", "public");
const OUTPUT_PATH = join(PUBLIC_DIR, "standings.json");
const LOGOS_DIR = join(PUBLIC_DIR, "logos");
export const HISTORY_DIR = join(ROOT, "data", "history");

function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

// Защита от ботов на khl.ru и img.khl.ru сначала ставит cookie и делает
// редирект на тот же адрес, поэтому редиректы проходим вручную, сохраняя cookie.
async function fetchWithCookies(url, cookies, headers = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, ...headers, Cookie: cookieHeader(cookies) },
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      url = new URL(res.headers.get("location") ?? url, url).href;
      continue;
    }
    return res;
  }
  throw new Error("бесконечные перенаправления (защита от ботов не пропустила)");
}

async function openStandingsPage(cookies) {
  let res;
  try {
    res = await fetchWithCookies(`${SITE}/standings/`, cookies, {
      "Accept-Language": "ru-RU,ru;q=0.9",
    });
  } catch (err) {
    fail(`не удалось открыть khl.ru: ${err.message}`);
  }
  if (!res.ok) fail(`khl.ru ответил ${res.status} на странице таблицы`);
  return res.text();
}

function cookieHeader(cookies) {
  return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}

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

// Время по Москве (UTC+3) в формате ISO.
function moscowNow() {
  const msk = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return msk.toISOString().replace(/\.\d+Z$/, "+03:00");
}

export async function fetchStandings() {
  const cookies = new Map();
  const html = await openStandingsPage(cookies);
  const sessid = html.match(/"bitrix_sessid":"([0-9a-f]+)"/)?.[1];
  if (!sessid) fail("не нашёл bitrix_sessid на странице таблицы");

  const form = new FormData();
  form.append("values[type]", "regular");
  form.append("sessid", sessid);

  let res;
  try {
    res = await fetch(`${SITE}/rest/standings/regular/`, {
      method: "POST",
      body: form,
      headers: {
        "User-Agent": USER_AGENT,
        Referer: `${SITE}/standings/`,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader(cookies),
      },
    });
  } catch (err) {
    fail(`не удалось получить таблицу: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== "success") {
    fail(`khl.ru не отдал таблицу (код ${res.status}, статус ${body?.status ?? "нет JSON"})`);
  }

  const conferences = (body.data?.json?.conferences ?? []).map((conf) => {
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

export function saveStandings(standings) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(standings, null, 2) + "\n");

  // Снимок дня нужен, чтобы завтра понять, кто поднялся и кто опустился.
  mkdirSync(HISTORY_DIR, { recursive: true });
  const day = standings.fetchedAt.slice(0, 10);
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
