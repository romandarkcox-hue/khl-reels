// Озвучка текста через Яндекс SpeechKit (API v1) в mp3.
// Нужен YANDEX_API_KEY (API-ключ сервисного аккаунта с ролью ai.speechkit-tts.user) в .env.

import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize";
const VOICE = process.env.YANDEX_VOICE ?? "ermil";
const EMOTION = process.env.YANDEX_EMOTION ?? "good";
const SPEED = process.env.YANDEX_SPEED ?? "1.1";

export const hasTtsKey = () => Boolean(process.env.YANDEX_API_KEY);

// Подготовка текста к чтению вслух: счёт "3:4" читается как «три — четыре».
export function speechText(text) {
  return text.replace(/(\d+):(\d+)/g, "$1 — $2");
}

export async function synthesize(text, outPath) {
  const body = new URLSearchParams({
    text: speechText(text),
    lang: "ru-RU",
    voice: VOICE,
    emotion: EMOTION,
    speed: SPEED,
    format: "mp3",
  });
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Api-Key ${process.env.YANDEX_API_KEY}` },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SpeechKit ответил ${res.status}: ${detail.slice(0, 300)}`);
  }
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}
