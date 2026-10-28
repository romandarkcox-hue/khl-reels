// Вечер после последнего матча дня → Telegram-канал и группа ВК, два поста:
// 1) картинка со счетами и текст с описанием матчей; 2) таблицы «Запад» и «Восток».
// Снимок таблицы дня пишется в data/history/.
//
// Запуск:  node scripts/make-evening.mjs [ГГГГ-ММ-ДД] [--partial] [--to-me | --no-send]
//   по умолчанию сегодня по Москве; без --partial ждёт, пока закончатся все матчи
//   и заполнятся их протоколы (сразу после сирены протокол на сайте пустой);
//   --to-me присылает посты в личку вместо канала, --no-send только рисует.

import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OUT_DIR, fetchDayMatches, renderDayCards } from "./day-cards.mjs";
import { HISTORY_DIR, saveStandings } from "./fetch-standings.mjs";
import { fail, moscowNow } from "./khl.mjs";
import { buildFacts, loadPreviousSnapshot, tablesText, writePostText } from "./post-text.mjs";
import { channelId, sendPost } from "./send-telegram.mjs";
import { sendVkPostSafe } from "./send-vk.mjs";

const VIDEO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "video");
// Появляется только после публикации в канал: по нему воркфлоу понимает, ставить ли метку дня.
const POSTED_FLAG = join(OUT_DIR, "evening-posted");

const args = process.argv.slice(2);
const partial = args.includes("--partial");
const toMe = args.includes("--to-me");
const noSend = args.includes("--no-send");
const day = args.find((a) => !a.startsWith("--")) ?? moscowNow().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`дата должна быть в виде ГГГГ-ММ-ДД, а не «${day}»`);

rmSync(POSTED_FLAG, { force: true });
console.log(`1/4 Матчи и таблица за ${day}...`);
const { matches, standings } = await fetchDayMatches(day, { withGoals: true });
const played = matches.filter((m) => m.score);
console.log(`   матчей ${matches.length}, сыграно ${played.length}`);
if (!played.length) {
  console.log("   сыгранных матчей нет, пост не нужен.");
  process.exit(0);
}
if (played.length < matches.length && !partial) {
  console.log("   ещё не все матчи закончились (для поста по сыгранным добавьте --partial).");
  process.exit(0);
}
// В протоколе столько же голов, сколько в счёте (победный буллит тоже записан голом).
const noProtocol = played.filter((m) => m.goals.length < m.score.home + m.score.away);
if (noProtocol.length && !partial) {
  const names = noProtocol.map((m) => `${m.home.name} — ${m.away.name}`).join(", ");
  console.log(`   протоколы ещё не заполнены: ${names}. Жду (без ожидания: --partial).`);
  process.exit(0);
}
// Прошлый снимок читаем до сохранения сегодняшнего. Снимок дня пишем только
// при публикации в канал, пробные запуски его не трогают.
const previous = loadPreviousSnapshot(HISTORY_DIR, day);
saveStandings(standings, day, { writeSnapshot: !noSend && !toMe });

console.log("2/4 Рисую картинки...");
const resultFiles = renderDayCards("results", day, played);
const tableFiles = [];
for (const id of ["west", "east"]) {
  const out = join(OUT_DIR, `${id}.jpg`);
  execSync(`npx remotion still ${id} "${out}" --image-format=jpeg --jpeg-quality=95 --log=error`, {
    cwd: VIDEO_DIR,
    stdio: "inherit",
  });
  tableFiles.push(out);
}

console.log("3/4 Пишу тексты постов...");
const facts = buildFacts(standings, previous, day, played);
const { text, source } = await writePostText(facts);
const tables = tablesText(day);
writeFileSync(join(OUT_DIR, "evening.txt"), text + "\n");
writeFileSync(join(OUT_DIR, "tables.txt"), tables + "\n");
console.log(`   текст: ${source === "ai" ? "Claude API" : "шаблон"}`);

if (noSend) {
  console.log("4/4 Отправку пропускаю (--no-send).");
} else {
  console.log(`4/4 Публикую ${toMe ? "вам в личку" : `в канал ${channelId}`}: итоги, затем таблицы...`);
  const chat = toMe ? undefined : channelId;
  const resultsLink = await sendPost(resultFiles, text, chat);
  const tablesLink = await sendPost(tableFiles, tables, chat);
  if (!toMe) {
    writeFileSync(POSTED_FLAG, new Date().toISOString() + "\n");
    await sendVkPostSafe(resultFiles, text, resultsLink);
    await sendVkPostSafe(tableFiles, tables, tablesLink);
  }
}

console.log(
  "Готово:",
  [...resultFiles, ...tableFiles, join(OUT_DIR, "evening.txt"), join(OUT_DIR, "tables.txt")].join(", "),
);
