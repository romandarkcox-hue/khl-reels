// Отправка текста или видео в Telegram через бота.
//
// Текст:  node scripts/send-telegram.mjs "Привет"
// Видео:  node scripts/send-telegram.mjs --video out/reel.mp4 "Подпись"
// Альбом: node scripts/send-telegram.mjs --photos a.jpg b.jpg --caption "Подпись"
//
// Берёт TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID из переменных окружения
// или из файла .env в корне проекта (если он есть).

import { existsSync, statSync, openAsBlob } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // лимит Telegram для ботов

function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

// На GitHub Actions файла .env нет, там значения придут из секретов.
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token) fail("не задан TELEGRAM_BOT_TOKEN (в .env или в окружении)");
if (!chatId) fail("не задан TELEGRAM_CHAT_ID (в .env или в окружении)");

async function callTelegram(method, body) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      body,
    });
  } catch (err) {
    fail(`не удалось связаться с Telegram: ${err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    fail(`Telegram ответил ${res.status}: ${data.description ?? "без описания"}`);
  }
  return data.result;
}

export async function sendMessage(text) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("text", text);
  return callTelegram("sendMessage", form);
}

export async function sendVideo(videoPath, caption = "") {
  if (!existsSync(videoPath)) fail(`файл не найден: ${videoPath}`);
  const size = statSync(videoPath).size;
  if (size > MAX_VIDEO_BYTES) {
    fail(`видео ${(size / 1024 / 1024).toFixed(1)} МБ, а боту можно не больше 50 МБ`);
  }
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("supports_streaming", "true");
  if (caption) form.append("caption", caption);
  form.append("video", await openAsBlob(videoPath), basename(videoPath));
  return callTelegram("sendVideo", form);
}

// Несколько фото одним альбомом (2–10 штук). Подпись показывается под альбомом.
export async function sendPhotos(photoPaths, caption = "") {
  if (photoPaths.length < 2 || photoPaths.length > 10) {
    fail(`в альбоме должно быть от 2 до 10 фото, а передано ${photoPaths.length}`);
  }
  const form = new FormData();
  form.append("chat_id", chatId);
  const media = [];
  for (const [i, path] of photoPaths.entries()) {
    if (!existsSync(path)) fail(`файл не найден: ${path}`);
    form.append(`photo${i}`, await openAsBlob(path), basename(path));
    media.push({
      type: "photo",
      media: `attach://photo${i}`,
      ...(i === 0 && caption ? { caption } : {}),
    });
  }
  form.append("media", JSON.stringify(media));
  return callTelegram("sendMediaGroup", form);
}

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === "--photos") {
    const captionAt = args.indexOf("--caption");
    const photos = args.slice(1, captionAt === -1 ? undefined : captionAt);
    const caption = captionAt === -1 ? "" : args.slice(captionAt + 1).join(" ");
    await sendPhotos(photos, caption);
    console.log(`Альбом отправлен: ${photos.length} фото`);
  } else if (args[0] === "--video") {
    const [, videoPath, ...rest] = args;
    if (!videoPath) fail("укажите путь к видео после --video");
    await sendVideo(videoPath, rest.join(" "));
    console.log(`Видео отправлено: ${videoPath}`);
  } else {
    const text = args.join(" ");
    if (!text) fail('укажите текст, например: node scripts/send-telegram.mjs "Привет"');
    await sendMessage(text);
    console.log("Сообщение отправлено.");
  }
}
