// Канал «ПРОГНОЗЫ КХЛ | HITRATE AI» (t.me/prognozykkhl).
//
// Утро:  node scripts/hitrate.mjs predict [ДЕНЬ] [--to-me | --no-send]
//   прогноз на матчи дня → картинка + подпись. При публикации в канал прогноз
//   записывается в журнал data/predictions/ДЕНЬ.json (повторно — нельзя).
// Вечер: node scripts/hitrate.mjs check [ДЕНЬ] [--to-me | --no-send]
//   сверяет прогноз из журнала со счетами, пересчитывает HitRate.
//   Без журнала (пробный запуск) прогноз считается заново по матчам до этого дня.
//
// HitRate канала — доля угаданных «уверенных» прогнозов (фаворит 60% и выше)
// по всем дням журнала. Угадан = фаворит выиграл, в том числе в ОТ или по буллитам.

import "./hitrate-env.mjs";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clubTags, fullName } from "./clubs.mjs";
import { OUT_DIR } from "./day-cards.mjs";
import { PUBLIC_DIR, downloadLogos, fetchStandings } from "./fetch-standings.mjs";
import { fail, gameScore, gameStatus, moscowNow, openSession, restPost } from "./khl.mjs";
import { PREDICTIONS_DIR, predictDay, savePredictions } from "./predict.mjs";
import { channelId, sendPost } from "./send-telegram.mjs";

const VIDEO_DIR = join(PUBLIC_DIR, "..");
const CHANNEL_LINE = "Прогнозы на КХЛ каждый день — t.me/prognozykkhl";
const DISCLAIMER = "Прогноз — расчёт модели по статистике, а не совет делать ставки.";
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dateText = (day) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const pct = (p) => `${Math.round(p.prob * 100)}%`;
const favName = (p) => fullName(p[p.favorite].name);
const pair = (p) => `${fullName(p.home.name)} — ${fullName(p.away.name)}`;

// Ожидаемые шайбы (справочно, в HitRate не входят). Заметно больше среднего по лиге → ⚡,
// заметно меньше → 🧱. Старые записи журнала без goals — пустая строка.
const GOALS_DIFF = 0.4;
const goalsMark = (p) =>
  p.goals == null ? "" : p.goals >= p.leagueGoals + GOALS_DIFF ? "⚡" : p.goals <= p.leagueGoals - GOALS_DIFF ? "🧱" : "";
// 5,4 шайбы (дробное — всегда «шайбы»), 6 шайб, 4 шайбы.
export const goalsWord = (x) => (Number.isInteger(x) && (x % 10 < 2 || x % 10 > 4 || (x % 100 >= 12 && x % 100 <= 14)) ? "шайб" : "шайбы");
const goalsText = (p) => (p.goals == null ? "" : `${goalsMark(p)}~${String(p.goals).replace(".", ",")} ${goalsWord(p.goals)}`);
function goalsLegend(predictions) {
  const p = predictions.find((x) => x.goals != null);
  if (!p) return [];
  const avg = String(p.leagueGoals).replace(".", ",");
  return [`🏒 Шайбы — сколько ждём в матче (в среднем по лиге ${avg}). ⚡ больше обычного, 🧱 плотная игра`];
}

// Логотипы: те же файлы, что у основного канала (public/logos/ID.png).
async function logoMap() {
  const session = await openSession("/standings/");
  const standings = await fetchStandings(session);
  await downloadLogos(standings);
  const map = new Map();
  for (const c of standings.conferences) for (const t of c.teams) if (t.logo) map.set(t.clubId, t.logo);
  return map;
}

// HitRate по всем дням журнала, где уже есть проверка.
function totalHitrate() {
  let hits = 0;
  let total = 0;
  if (!existsSync(PREDICTIONS_DIR)) return { hits, total };
  for (const f of readdirSync(PREDICTIONS_DIR).filter((f) => f.endsWith(".json"))) {
    const j = JSON.parse(readFileSync(join(PREDICTIONS_DIR, f), "utf8"));
    for (const p of j.predictions) {
      if (p.confident && typeof p.hit === "boolean") {
        total++;
        if (p.hit) hits++;
      }
    }
  }
  return { hits, total };
}

const hitrateLine = ({ hits, total }) =>
  total
    ? `📈 HitRate уверенных прогнозов: ${Math.round((100 * hits) / total)}% (${hits} из ${total})`
    : "📈 HitRate уверенных прогнозов: считаем с сегодняшнего дня";

function tags(predictions) {
  const names = predictions.flatMap((p) => [p.home.name, p.away.name]);
  return `#КХЛ #прогнозыКХЛ #хоккей ${clubTags(names)}`;
}

function predictText(day, predictions, hitrate) {
  const confident = predictions.filter((p) => p.confident).sort((a, b) => b.prob - a.prob);
  const rest = predictions.filter((p) => !p.confident);
  const lines = [`🎯 Прогнозы КХЛ на ${dateText(day)} · HitRate AI`, ""];
  if (confident.length) {
    lines.push(confident.length === 1 ? "🔥 Уверенный прогноз дня" : "🔥 Уверенные прогнозы дня");
    for (const p of confident) {
      lines.push(`${p.time} ${pair(p)}`, `→ победа: ${favName(p)}, ${pct(p)}${p.goals == null ? "" : " · " + goalsText(p)}`);
    }
  } else {
    lines.push("🔥 Уверенных прогнозов сегодня нет: все матчи примерно равные");
  }
  if (rest.length) {
    lines.push("", "📊 Остальные матчи");
    for (const p of rest) lines.push(`${p.time} ${pair(p)} · ${favName(p)} ${pct(p)}${p.goals == null ? "" : " · " + goalsText(p)}`);
  }
  lines.push("", ...goalsLegend(predictions), hitrateLine(hitrate), "", DISCLAIMER, CHANNEL_LINE, "", tags(predictions));
  return lines.join("\n");
}

function checkText(day, predictions, hitrate) {
  const done = predictions.filter((p) => typeof p.hit === "boolean");
  const hits = done.filter((p) => p.hit).length;
  const line = (p) =>
    `${p.hit ? "✅" : "❌"} ${fullName(p.home.name)} ${p.score.home}:${p.score.away}${p.score.ots ? (p.score.ots === "OT" ? " ОТ" : " Б") : ""} ${fullName(p.away.name)} (прогноз: ${favName(p)}, ${pct(p)})`;
  const confident = done.filter((p) => p.confident);
  const lines = [`🧾 Проверка прогнозов на ${dateText(day)}: угадали ${hits} из ${done.length}`, ""];
  if (confident.length) {
    lines.push(confident.length === 1 ? "🔥 Уверенный прогноз" : "🔥 Уверенные прогнозы");
    lines.push(...confident.map(line), "");
  }
  const rest = done.filter((p) => !p.confident);
  if (rest.length) lines.push("📊 Остальные матчи", ...rest.map(line), "");
  lines.push(hitrateLine(hitrate), "", CHANNEL_LINE, "", tags(predictions));
  return lines.join("\n");
}

function render(kind, data) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DIR, `${kind}.json`), JSON.stringify(data, null, 2) + "\n");
  const out = join(OUT_DIR, `${kind}.jpg`);
  execSync(`npx remotion still ${kind} "${out}" --image-format=jpeg --jpeg-quality=95 --log=error`, {
    cwd: VIDEO_DIR,
    stdio: "inherit",
  });
  return out;
}

const cardMatches = (predictions, logos) =>
  predictions.map((p) => ({
    ...p,
    home: { name: p.home.name, logo: logos.get(p.home.id) ?? null },
    away: { name: p.away.name, logo: logos.get(p.away.id) ?? null },
  }));

async function publish(file, text, mode) {
  if (mode === "no-send") return "";
  const chat = mode === "to-me" ? undefined : channelId;
  const link = await sendPost([file], text, chat);
  console.log(mode === "to-me" ? "Отправлено в личку." : `Опубликовано: ${link}`);
  return link;
}

async function morning(day, mode) {
  const all = await predictDay(day);
  // Начавшиеся матчи не прогнозируем: прогноз «по ходу игры» сделал бы HitRate нечестным.
  // (Пробные запуски за прошедшие дни показывают все матчи.)
  const strict = mode === "channel" || day === moscowNow().slice(0, 10);
  const predictions = strict ? all.filter((p) => !p.started) : all;
  const skipped = all.length - predictions.length;
  if (skipped) console.warn(`Уже начались, без прогноза: ${skipped} матч(а)`);
  if (!predictions.length) return console.log(`${day}: матчей для прогноза нет`);
  for (const p of predictions) delete p.started;
  const file = join(PREDICTIONS_DIR, `${day}.json`);
  if (mode === "channel" && existsSync(file)) return console.log(`Прогноз на ${day} уже опубликован, ничего не делаю.`);
  const hitrate = totalHitrate();
  const logos = await logoMap();
  const image = render("predict", { date: day, matches: cardMatches(predictions, logos), hitrate });
  const text = predictText(day, predictions, hitrate);
  console.log(`\n${text}\n\nКартинка: ${image}`);
  // В журнал пишем до публикации: если Telegram упадёт, повторный запуск не сделает новый прогноз задним числом.
  if (mode === "channel") savePredictions(day, predictions);
  await publish(image, text, mode);
}

async function evening(day, mode) {
  const file = join(PREDICTIONS_DIR, `${day}.json`);
  const journal = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  if (!journal && mode === "channel") return console.log(`Прогноза на ${day} в журнале нет, проверять нечего.`);
  if (journal?.checkedAt && mode === "channel") return console.log(`Проверка за ${day} уже опубликована.`);
  const predictions = journal?.predictions ?? (await predictDay(day));
  if (!predictions.length) return console.log(`${day}: матчей нет`);

  const session = await openSession("/calendar/");
  const calendar = await restPost(session, "calendar/list");
  const games = new Map(calendar.GAMES.flatMap((o) => o?.[day] ?? []).filter(Boolean).map((g) => [g.id, g]));
  for (const p of predictions) {
    const g = games.get(p.gameId);
    if (!g || gameStatus(g) !== "final") continue;
    p.score = gameScore(g);
    const homeWon = p.score.home > p.score.away;
    p.hit = (p.favorite === "home") === homeWon;
  }
  const unfinished = predictions.filter((p) => typeof p.hit !== "boolean").length;
  if (unfinished) console.warn(`Ещё не закончились или отменены: ${unfinished} матч(а), в проверку не вошли`);

  if (mode === "channel") {
    journal.checkedAt = moscowNow();
    writeFileSync(file, JSON.stringify(journal, null, 2) + "\n");
  }
  // HitRate: журнал + (для пробного запуска) уверенные прогнозы этого дня
  const hitrate = totalHitrate();
  if (mode !== "channel" || !journal) {
    for (const p of predictions) if (p.confident && typeof p.hit === "boolean" && !journal) {
      hitrate.total++;
      if (p.hit) hitrate.hits++;
    }
  }
  const logos = await logoMap();
  const checked = predictions.filter((p) => typeof p.hit === "boolean");
  const image = render("check", { date: day, matches: cardMatches(checked, logos), hitrate });
  const text = checkText(day, predictions, hitrate);
  console.log(`\n${text}\n\nКартинка: ${image}`);
  await publish(image, text, mode);
}

const args = process.argv.slice(2);
const kind = args[0];
const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? moscowNow().slice(0, 10);
const mode = args.includes("--no-send") ? "no-send" : args.includes("--to-me") ? "to-me" : "channel";
if (kind === "predict") await morning(day, mode);
else if (kind === "check") await evening(day, mode);
else fail("укажите predict или check, например: node scripts/hitrate.mjs predict --no-send");
