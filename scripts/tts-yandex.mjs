// Озвучка текста через Яндекс SpeechKit (API v3) в mp3.
// Нужен YANDEX_API_KEY (API-ключ сервисного аккаунта с ролью ai.speechkit-tts.user) в .env.
// Голос настраивается в .env: YANDEX_VOICE, YANDEX_ROLE, YANDEX_SPEED,
// YANDEX_MODEL (для голосов LiveTTS: vasily, sergey, denis — значение livetts).

import { setDefaultResultOrder } from "node:dns";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

// Соединение с SpeechKit по IPv6 иногда обрывается («fetch failed»), поэтому сначала IPv4.
setDefaultResultOrder("ipv4first");

const URL = "https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis";

export const hasTtsKey = () => Boolean(process.env.YANDEX_API_KEY);

export const defaultVoice = () => ({
  voice: process.env.YANDEX_VOICE ?? "ermil",
  role: process.env.YANDEX_ROLE ?? "good",
  speed: process.env.YANDEX_SPEED ?? "1.1",
  model: process.env.YANDEX_MODEL ?? null,
});

// Подготовка текста к чтению вслух: счёт "3:4" читается как «три — четыре».
export function speechText(text) {
  return text.replace(/(\d+):(\d+)/g, "$1 — $2");
}

export async function synthesize(text, outPath, options = defaultVoice()) {
  const { voice, role, speed, model } = options;
  const body = {
    text: speechText(text),
    // Голоса LiveTTS не поддерживают настройку скорости.
    hints: [
      { voice },
      ...(role ? [{ role }] : []),
      ...(speed && model !== "livetts" ? [{ speed: String(speed) }] : []),
    ],
    outputAudioSpec: { containerAudio: { containerAudioType: "MP3" } },
    ...(model ? { model } : {}),
  };
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`SpeechKit ответил ${res.status}: ${raw.slice(0, 300)}`);

  // Ответ приходит потоком JSON-объектов, в каждом кусок аудио в base64.
  const chunks = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    const data = msg.result?.audioChunk?.data ?? msg.audioChunk?.data;
    if (data) chunks.push(Buffer.from(data, "base64"));
  }
  if (!chunks.length) throw new Error(`SpeechKit не вернул аудио: ${raw.slice(0, 300)}`);
  writeFileSync(outPath, Buffer.concat(chunks));
  return outPath;
}
