// Прогнозы на матчи КХЛ для канала «ПРОГНОЗЫ КХЛ | HITRATE AI».
//
// Модель — рейтинг Эло: у каждой команды число, победа над сильным даёт больше,
// крупная победа — чуть больше, победа в ОТ/буллитах — меньше. Рейтинги считаем
// по всем матчам прошлого сезона и текущего; летом составы меняются, поэтому
// к новому сезону рейтинг наполовину возвращается к среднему (1500).
// Настройки подобраны на сезоне 2025/26 и проверены на 2026/27 (16.11.2026):
// все матчи — 56%, «уверенные» (фаворит 60% и выше) — около 65%.
//
// Проверка без записи:  node scripts/predict.mjs [ГГГГ-ММ-ДД]
// С записью в журнал:   node scripts/predict.mjs [ДЕНЬ] --save   → data/predictions/ДЕНЬ.json

import "./env.mjs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOURNAMENT, gameScore, gameStatus, moscowNow, openSession, restPost } from "./khl.mjs";

export const PREV_TOURNAMENT = 1369; // регулярный чемпионат 2025/26
const K = 14; // скорость изменения рейтинга
const HOME = 15; // преимущество своей площадки в очках рейтинга
const CARRY = 0.5; // какая доля рейтинга переходит в новый сезон
export const CONFIDENT = 0.6; // с какой вероятности фаворит считается «уверенным»

export const PREDICTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "predictions");

const winProb = (home, away) => 1 / (1 + 10 ** (-(home + HOME - away) / 400));

// Сыгранные матчи турнира по порядку.
function playedGames(calendar) {
  return calendar.GAMES.flatMap((o) => Object.values(o ?? {}).flat())
    .filter((g) => g && gameStatus(g) === "final")
    .sort((a, b) => (a.date + a.time_format).localeCompare(b.date + b.time_format));
}

function updateElo(elo, games) {
  for (const g of games) {
    const { home, away, ots } = gameScore(g);
    const eh = elo.get(g.teama) ?? 1500;
    const ea = elo.get(g.teamb) ?? 1500;
    const p = winProb(eh, ea);
    const homeWon = home > away;
    const result = homeWon ? (ots ? 0.75 : 1) : ots ? 0.25 : 0;
    const margin = Math.log(Math.abs(home - away) + 1) + 0.5;
    elo.set(g.teama, eh + K * margin * (result - p));
    elo.set(g.teamb, ea - K * margin * (result - p));
  }
}

// Рейтинги команд по матчам, сыгранным до дня `day` (сами матчи дня не учитываются).
export async function ratingsBefore(day, session) {
  const prev = await restPost(session, "calendar/list", { "values[tournament]": PREV_TOURNAMENT });
  const cur = await restPost(session, "calendar/list");
  const elo = new Map();
  updateElo(elo, playedGames(prev));
  for (const [id, r] of elo) elo.set(id, 1500 + CARRY * (r - 1500));
  updateElo(elo, playedGames(cur).filter((g) => g.date < day));
  return { elo, calendar: cur };
}

// Прогноз на каждый матч дня.
export async function predictDay(day) {
  const session = await openSession("/calendar/");
  const { elo, calendar } = await ratingsBefore(day, session);
  const name = (id) => calendar.TEAMS?.[id]?.NAME ?? String(id);
  const games = calendar.GAMES.flatMap((o) => o?.[day] ?? [])
    .filter(Boolean)
    .sort((a, b) => a.time_format.localeCompare(b.time_format));

  return games.map((g) => {
    const pHome = winProb(elo.get(g.teama) ?? 1500, elo.get(g.teamb) ?? 1500);
    const homeFav = pHome >= 0.5;
    const prob = homeFav ? pHome : 1 - pHome;
    return {
      gameId: g.id,
      time: g.time_format,
      started: gameStatus(g) !== "scheduled",
      home: { id: g.teama, name: name(g.teama), rating: Math.round(elo.get(g.teama) ?? 1500) },
      away: { id: g.teamb, name: name(g.teamb), rating: Math.round(elo.get(g.teamb) ?? 1500) },
      favorite: homeFav ? "home" : "away",
      prob: Math.round(prob * 100) / 100,
      confident: prob >= CONFIDENT,
    };
  });
}

// Записывает прогнозы дня в журнал. Уже записанный день не перезаписываем:
// прогноз должен быть сделан до матчей, иначе HitRate будет нечестным.
export function savePredictions(day, predictions) {
  const file = join(PREDICTIONS_DIR, `${day}.json`);
  if (existsSync(file)) throw new Error(`прогноз на ${day} уже записан: ${file}`);
  mkdirSync(PREDICTIONS_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ day, madeAt: moscowNow(), model: { K, HOME, CARRY }, predictions }, null, 2) + "\n");
  return file;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const day = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? moscowNow().slice(0, 10);
  const predictions = await predictDay(day);
  if (!predictions.length) {
    console.log(`${day}: матчей нет`);
    process.exit(0);
  }
  for (const p of predictions) {
    const fav = p[p.favorite].name;
    console.log(
      `${p.time}  ${p.home.name} (${p.home.rating}) — ${p.away.name} (${p.away.rating})  →  ${fav} ${Math.round(p.prob * 100)}%${p.confident ? "  🔥" : ""}`,
    );
  }
  if (process.argv.includes("--save")) console.log("Записано:", savePredictions(day, predictions));
}
