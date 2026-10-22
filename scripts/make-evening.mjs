// Вечерний пост после последнего матча дня: счета матчей, таблицы «Запад» и «Восток»
// и текст с итогами → Telegram-канал. Снимок таблицы дня пишется в data/history/.
//
// Запуск:  node scripts/make-evening.mjs [ГГГГ-ММ-ДД] [--partial] [--to-me | --no-send]
//   по умолчанию сегодня по Москве; без --partial ждёт, пока закончатся все матчи;
//   --to-me присылает пост в личку вместо канала, --no-send только рисует.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OUT_DIR, fetchDayMatches, renderDayCards } from "./day-cards.mjs";
import { HISTORY_DIR, saveStandings } from "./fetch-standings.mjs";
import { fail, moscowNow } from "./khl.mjs";
import { buildFacts, loadPreviousSnapshot, writePostText } from "./post-text.mjs";
import { channelId, sendPost } from "./send-telegram.mjs";

const VIDEO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "video");

const args = process.argv.slice(2);
const partial = args.includes("--partial");
const toMe = args.includes("--to-me");
const noSend = args.includes("--no-send");
const day = args.find((a) => !a.startsWith("--")) ?? moscowNow().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`дата должна быть в виде ГГГГ-ММ-ДД, а не «${day}»`);

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
// Прошлый снимок читаем до сохранения сегодняшнего. Снимок дня пишем только
// при публикации в канал, пробные запуски его не трогают.
const previous = loadPreviousSnapshot(HISTORY_DIR, day);
saveStandings(standings, day, { writeSnapshot: !noSend && !toMe });

console.log("2/4 Рисую картинки...");
const files = renderDayCards("results", day, played);
for (const id of ["west", "east"]) {
  const out = join(OUT_DIR, `${id}.jpg`);
  execSync(`npx remotion still ${id} "${out}" --image-format=jpeg --jpeg-quality=95 --log=error`, {
    cwd: VIDEO_DIR,
    stdio: "inherit",
  });
  files.push(out);
}

console.log("3/4 Пишу текст поста...");
const facts = buildFacts(standings, previous, day, played);
const { text, source } = await writePostText(facts);
writeFileSync(join(OUT_DIR, "evening.txt"), text + "\n");
console.log(`   текст: ${source === "ai" ? "Claude API" : "шаблон"}${previous ? "" : ", прошлого снимка таблицы нет"}`);

if (noSend) {
  console.log("4/4 Отправку пропускаю (--no-send).");
} else {
  console.log(`4/4 Публикую ${toMe ? "вам в личку" : `в канал ${channelId}`}...`);
  await sendPost(files, text, toMe ? undefined : channelId);
}

console.log("Готово:", [...files, join(OUT_DIR, "evening.txt")].join(", "));
