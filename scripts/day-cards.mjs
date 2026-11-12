// Картинки 4:5 с матчами игрового дня: утренний анонс (время начала)
// и вечерние счета. До 6 матчей одна картинка, больше — две примерно поровну.
//
// Проверка без отправки:  node scripts/day-cards.mjs announce|results [ГГГГ-ММ-ДД]
// Картинки: video/out/announce-1.jpg, results-1.jpg и т. д.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_DIR, downloadLogos, fetchStandings } from "./fetch-standings.mjs";
import { parseGoals } from "./fetch-games.mjs";
import { TOURNAMENT, fail, gameScore, gameStatus, moscowNow, openSession, restPost } from "./khl.mjs";

const VIDEO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "video");
export const OUT_DIR = join(VIDEO_DIR, "out");
const PER_PAGE = 6;

// 7 матчей -> 4 + 3, 8 -> 4 + 4.
function splitPages(matches) {
  if (matches.length <= PER_PAGE) return [matches];
  const half = Math.ceil(matches.length / 2);
  return [matches.slice(0, half), matches.slice(half)];
}

// Матчи дня по календарю khl.ru с местами команд в таблице.
// Сыгранные матчи получают счёт, остальные score: null.
// withGoals: у сыгранных матчей ещё и голы из протокола (для описаний в вечернем посте).
// Таблицу возвращаем тоже: вечерней карусели она нужна для картинок конференций.
export async function fetchDayMatches(day, { withGoals = false } = {}) {
  const session = await openSession("/calendar/");
  const calendar = await restPost(session, "calendar/list");
  const dayGames = calendar.GAMES.flatMap((o) => o?.[day] ?? []).sort((a, b) =>
    a.time_format.localeCompare(b.time_format),
  );

  const standings = await fetchStandings(session);
  await downloadLogos(standings);
  const teamById = new Map();
  for (const c of standings.conferences) {
    for (const t of c.teams) teamById.set(t.clubId, { ...t, conf: c.id });
  }
  const team = (id) => {
    const t = teamById.get(id);
    return {
      id,
      name: t?.name ?? calendar.TEAMS?.[id]?.NAME ?? String(id),
      logo: t?.logo ?? null,
      rank: t?.rank ?? null,
      conf: t?.conf ?? null,
    };
  };

  const matches = [];
  for (const g of dayGames) {
    const score = gameStatus(g) === "final" ? gameScore(g) : null;
    let goals = [];
    if (score && withGoals) {
      const protocol = await restPost(session, "game/protocol", {
        "values[tournament]": TOURNAMENT,
        "values[gameid]": g.id,
      });
      goals = parseGoals(protocol, score.ots);
    }
    matches.push({ time: g.time_format, home: team(g.teama), away: team(g.teamb), score, goals });
  }
  return { matches, standings };
}

// Пишет public/{kind}.json и рисует картинки. Возвращает пути к файлам.
export function renderDayCards(kind, day, matches) {
  const data = { date: day, total: matches.length, pages: splitPages(matches) };
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DIR, `${kind}.json`), JSON.stringify(data, null, 2) + "\n");

  const files = [];
  for (const i of data.pages.keys()) {
    const out = join(OUT_DIR, `${kind}-${i + 1}.jpg`);
    execSync(
      `npx remotion still ${kind}-${i + 1} "${out}" --image-format=jpeg --jpeg-quality=95 --log=error`,
      { cwd: VIDEO_DIR, stdio: "inherit" },
    );
    files.push(out);
  }
  return files;
}

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [kind, day = moscowNow().slice(0, 10)] = process.argv.slice(2);
  if (kind !== "announce" && kind !== "results") fail("укажите announce или results");
  const { matches } = await fetchDayMatches(day);
  const shown = kind === "results" ? matches.filter((m) => m.score) : matches;
  if (!shown.length) fail(`${day}: подходящих матчей нет`);
  const files = renderDayCards(kind, day, shown);
  console.log(`${day}: матчей ${shown.length}, картинки: ${files.join(", ")}`);
}
