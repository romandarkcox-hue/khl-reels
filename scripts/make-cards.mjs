// Полный цикл: свежая таблица КХЛ -> две картинки + текст поста -> Telegram.
//
// Запуск:  node scripts/make-cards.mjs

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORY_DIR,
  downloadLogos,
  fetchStandings,
  saveStandings,
} from "./fetch-standings.mjs";
import { buildFacts, loadPreviousSnapshot, writePostText } from "./post-text.mjs";
import { sendMessage, sendPhotos } from "./send-telegram.mjs";

const VIDEO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "video");
const OUT_DIR = join(VIDEO_DIR, "out");
const CARDS = ["west", "east"];

console.log("1/4 Забираю таблицу с khl.ru...");
const standings = await fetchStandings();
await downloadLogos(standings);
// Прошлый снимок читаем до сохранения сегодняшнего.
const previous = loadPreviousSnapshot(HISTORY_DIR, standings.fetchedAt.slice(0, 10));
saveStandings(standings);

console.log("2/4 Рисую картинки...");
const files = [];
for (const id of CARDS) {
  const out = join(OUT_DIR, `${id}.jpg`);
  execSync(
    `npx remotion still ${id} "${out}" --image-format=jpeg --jpeg-quality=95 --log=error`,
    { cwd: VIDEO_DIR, stdio: "inherit" },
  );
  files.push(out);
}

console.log("3/4 Пишу текст поста...");
const facts = buildFacts(standings, previous);
const { text, source } = await writePostText(facts);
writeFileSync(join(OUT_DIR, "post.txt"), text + "\n");
console.log(`   текст: ${source === "ai" ? "Claude API" : "шаблон"}${previous ? "" : ", вчерашнего снимка ещё нет"}`);

console.log("4/4 Отправляю в Telegram...");
await sendPhotos(files, `Карусель на ${standings.fetchedAt.slice(0, 10)}. Текст поста — следующим сообщением.`);
await sendMessage(text);

console.log("Готово:", [...files, join(OUT_DIR, "post.txt")].join(", "));
