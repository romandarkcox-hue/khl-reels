// Забирает турнирную таблицу КХЛ (регулярка) с khl.ru
// и сохраняет её в video/public/standings.json.
//
// Запуск:  node scripts/fetch-standings.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CONFERENCE_NAMES = { west: "Запад", east: "Восток" };
const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "video",
  "public",
  "standings.json",
);

function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

// Защита от ботов на khl.ru сначала ставит cookie и делает редирект
// на тот же адрес, поэтому редиректы проходим вручную, сохраняя cookie.
async function openStandingsPage(cookies) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${SITE}/standings/`, {
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "ru-RU,ru;q=0.9",
          Cookie: cookieHeader(cookies),
        },
      });
    } catch (err) {
      fail(`не удалось открыть khl.ru: ${err.message}`);
    }
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) continue;
    if (!res.ok) fail(`khl.ru ответил ${res.status} на странице таблицы`);
    return res.text();
  }
  fail("khl.ru бесконечно перенаправляет (защита от ботов не пропустила)");
}

function cookieHeader(cookies) {
  return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}

function toTeam(row, inPlayoffZone) {
  const [goalsFor, goalsAgainst] = String(row.s.g).split("-").map(Number);
  return {
    rank: row.r,
    name: row.name,
    clubId: row.clubid,
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

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const standings = await fetchStandings();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(standings, null, 2) + "\n");

  for (const conf of standings.conferences) {
    console.log(`\n== Конференция «${conf.name}» ==`);
    let shownDivider = false;
    for (const t of conf.teams) {
      if (!t.inPlayoffZone && !shownDivider) {
        console.log("   ---------- линия плей-офф ----------");
        shownDivider = true;
      }
      const move = t.prevRank - t.rank;
      const arrow = move > 0 ? `↑${move}` : move < 0 ? `↓${-move}` : "";
      console.log(
        `${String(t.rank).padStart(2)}. ${t.name.padEnd(15)} И ${String(t.gp).padStart(2)}  О ${String(t.pts).padStart(2)}  ${t.goalsFor}-${t.goalsAgainst} ${arrow}`,
      );
    }
  }
  console.log(`\nСохранено: ${OUTPUT_PATH} (на ${standings.fetchedAt})`);
}
