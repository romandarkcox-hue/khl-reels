// Быстрая проверка для вечернего воркфлоу: сколько матчей в игровой день
// и сколько из них закончилось. Только календарь, без протоколов и логотипов.
//
// Запуск:  node scripts/review-status.mjs ГГГГ-ММ-ДД
// На GitHub Actions дописывает total=, finished=, live= в $GITHUB_OUTPUT.

import { appendFileSync } from "node:fs";
import { fail, gameStatus, moscowNow, openSession, restPost } from "./khl.mjs";

const day = process.argv[2] ?? moscowNow().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`дата должна быть в виде ГГГГ-ММ-ДД, а не «${day}»`);

const session = await openSession("/calendar/");
const calendar = await restPost(session, "calendar/list");
const statuses = calendar.GAMES.flatMap((o) => o?.[day] ?? []).map(gameStatus);

const result = {
  total: statuses.length,
  finished: statuses.filter((s) => s === "final").length,
  live: statuses.filter((s) => s === "live").length,
};
console.log(`${day}: матчей ${result.total}, завершено ${result.finished}, идёт ${result.live}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(result).map(([k, v]) => `${k}=${v}\n`).join(""),
  );
}
