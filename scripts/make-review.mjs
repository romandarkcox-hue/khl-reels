// Reels «Итоги игрового дня КХЛ»: матчи дня -> текст -> озвучка -> видео -> Telegram.
//
// Запуск:  node scripts/make-review.mjs [ГГГГ-ММ-ДД] [--partial] [--no-send]
//   --partial  собрать ролик, даже если не все матчи дня закончились
//   --no-send  не отправлять в Telegram

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchDay, saveReview } from "./fetch-games.mjs";
import { PUBLIC_DIR } from "./fetch-standings.mjs";
import { moscowNow } from "./khl.mjs";
import { writeReviewScript } from "./review-script.mjs";
import { sendMessage, sendVideo } from "./send-telegram.mjs";
import { hasTtsKey, synthesize } from "./tts-yandex.mjs";

const VIDEO_DIR = join(PUBLIC_DIR, "..");
const OUT_DIR = join(VIDEO_DIR, "out");
const VOICE_DIR = join(PUBLIC_DIR, "voice");
const MUSIC = "music/track.mp3";
const FPS = 30;
const MIN_SECONDS = { intro: 3.5, match: 9, outro: 4 };

const args = process.argv.slice(2);
const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? moscowNow().slice(0, 10);
const partial = args.includes("--partial");
const send = !args.includes("--no-send");

function audioSeconds(path) {
  const out = execSync(
    `npx remotion ffprobe -v error -show_entries format=duration -of csv=p=0 "${path}"`,
    { cwd: VIDEO_DIR, encoding: "utf8" },
  );
  return Number.parseFloat(out.trim());
}

console.log(`1/5 Матчи за ${day}...`);
const review = await fetchDay(day);
console.log(`   матчей ${review.total}, завершено ${review.finished}, идёт ${review.live}`);
if (!review.matches.length) {
  console.log("Завершённых матчей нет, ролик не нужен.");
  process.exit(0);
}
if (review.finished < review.total && !partial) {
  console.log("Ещё не все матчи закончились. Запустите позже или с флагом --partial.");
  process.exit(0);
}

console.log("2/5 Пишу текст озвучки...");
const script = await writeReviewScript(review);
console.log(`   текст: ${script.source === "ai" ? "Claude API" : "шаблон"}`);

console.log(`3/5 Озвучка: ${hasTtsKey() ? "Яндекс SpeechKit" : "ключа SpeechKit нет, ролик без голоса"}...`);
mkdirSync(VOICE_DIR, { recursive: true });
const scenes = [];
for (const scene of script.scenes) {
  let voice = null;
  let voiceFrames = null;
  let seconds = scene.text.length / 14 + 1; // примерная длительность чтения без голоса
  if (hasTtsKey()) {
    const file = `voice/${day}-${scene.id}.mp3`;
    // Сеть до SpeechKit иногда обрывается, поэтому до пяти попыток с паузой.
    for (let attempt = 1; attempt <= 5 && !voice; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, attempt * 2000));
      try {
        await synthesize(scene.text, join(PUBLIC_DIR, file));
        voice = file;
        const voiceSeconds = audioSeconds(join(PUBLIC_DIR, file));
        voiceFrames = Math.ceil(voiceSeconds * FPS);
        seconds = voiceSeconds + 0.8;
      } catch (err) {
        console.warn(`   озвучка сцены ${scene.id}, попытка ${attempt}: ${err.message}`);
      }
    }
  }
  seconds = Math.max(seconds, MIN_SECONDS[scene.type]);
  scenes.push({ ...scene, voice, voiceFrames, frames: Math.ceil(seconds * FPS) });
}

// Ролик с «дырой» в озвучке не собираем и не отправляем.
const silent = hasTtsKey() ? scenes.filter((s) => !s.voice).map((s) => s.id) : [];
if (silent.length) {
  console.error(`Ошибка: не удалось озвучить сцены ${silent.join(", ")}. Ролик не собран, запустите ещё раз.`);
  process.exit(1);
}

const music = existsSync(join(PUBLIC_DIR, MUSIC)) ? MUSIC : null;
saveReview({ ...review, scenes, music, caption: script.caption });
const total = scenes.reduce((s, x) => s + x.frames, 0) / FPS;
console.log(`   длительность ${total.toFixed(1)} с, музыка: ${music ? "есть" : "нет"}`);

console.log("4/5 Рендер видео...");
mkdirSync(OUT_DIR, { recursive: true });
const videoPath = join(OUT_DIR, "review.mp4");
execSync(`npx remotion render review "${videoPath}" --codec=h264 --crf=23 --log=error`, {
  cwd: VIDEO_DIR,
  stdio: "inherit",
});
writeFileSync(join(OUT_DIR, "review-caption.txt"), script.caption + "\n");
const sizeMb = statSync(videoPath).size / 1024 / 1024;
console.log(`   ${videoPath} (${sizeMb.toFixed(1)} МБ)`);

if (send) {
  console.log("5/5 Отправляю в Telegram...");
  await sendVideo(videoPath, `Reels «Итоги дня» за ${day}. Подпись — следующим сообщением.`);
  await sendMessage(script.caption);
} else {
  console.log("5/5 Отправка в Telegram пропущена (--no-send).");
}
console.log("Готово.");
