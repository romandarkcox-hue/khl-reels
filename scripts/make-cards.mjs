// Полный цикл: свежая таблица КХЛ -> две картинки -> альбом в Telegram.
//
// Запуск:  node scripts/make-cards.mjs

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchStandings, saveStandings } from "./fetch-standings.mjs";
import { sendPhotos } from "./send-telegram.mjs";

const VIDEO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "video");
const CARDS = ["west", "east"];

console.log("1/3 Забираю таблицу с khl.ru...");
const standings = await fetchStandings();
saveStandings(standings);

console.log("2/3 Рисую картинки...");
const files = [];
for (const id of CARDS) {
  const out = join(VIDEO_DIR, "out", `${id}.jpg`);
  execSync(
    `npx remotion still ${id} "${out}" --image-format=jpeg --jpeg-quality=95 --log=error`,
    { cwd: VIDEO_DIR, stdio: "inherit" },
  );
  files.push(out);
}

console.log("3/3 Отправляю в Telegram...");
const leaders = standings.conferences
  .map((c) => `${c.name}: ${c.teams[0].name} (${c.teams[0].pts} О)`)
  .join("\n");
await sendPhotos(files, `Таблица КХЛ на ${standings.fetchedAt.slice(0, 10)}\n\nЛидеры:\n${leaders}`);

console.log("Готово:", files.join(", "));
