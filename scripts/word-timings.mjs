// Время каждого слова в озвучке: Whisper.cpp слушает mp3 и находит, когда звучат слова.
// Whisper может ошибиться в написании фамилий, поэтому слова на экране берём из
// нашего текста, а у Whisper только время: тексты сопоставляются по буквам.
//
// Whisper и модель скачиваются один раз в папку whisper.cpp/ (около 150 МБ, не в Git).

import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WHISPER_DIR = join(ROOT, "whisper.cpp");
const WHISPER_VERSION = "1.5.5";
const MODEL = "base";

let ready = null;
export function prepareWhisper() {
  ready ??= (async () => {
    await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false });
    await downloadWhisperModel({ model: MODEL, folder: WHISPER_DIR, printOutput: false });
  })();
  return ready;
}

// Только буквы и цифры в нижнем регистре: так сравниваем наш текст и текст Whisper.
const norm = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "");

// Слова сцены, как они пойдут на экран. Знаки без букв («—») приклеиваются к предыдущему слову.
export function splitWords(text) {
  const words = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    if (!norm(raw) && words.length) words[words.length - 1] += ` ${raw}`;
    else words.push(raw);
  }
  return words;
}

// Запасной вариант без Whisper: время делится пропорционально длине слов.
export function proportionalTimings(text, durationMs) {
  const words = splitWords(text);
  const total = words.reduce((s, w) => s + w.length + 1, 0);
  let t = 0;
  return words.map((w) => {
    const startMs = Math.round(t);
    t += ((w.length + 1) / total) * durationMs;
    return { text: w, startMs, endMs: Math.round(t) };
  });
}

// Сопоставление двух строк по буквам (расстояние Левенштейна с обратным ходом).
// Для каждой буквы строки a возвращает индекс совпавшей буквы в b или -1.
function alignChars(a, b) {
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j - 1] + cost, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const map = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    if (d[i][j] === d[i - 1][j - 1] + cost) {
      map[i - 1] = j - 1;
      i--;
      j--;
    } else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return map;
}

export async function wordTimings(mp3Path, text, durationMs) {
  await prepareWhisper();
  mp3Path = resolve(mp3Path);
  const wav = mp3Path.replace(/\.mp3$/, ".wav");
  execSync(`npx remotion ffmpeg -y -loglevel error -i "${mp3Path}" -ar 16000 -ac 1 "${wav}"`, {
    cwd: join(ROOT, "video"),
  });
  let captions;
  try {
    const output = await transcribe({
      inputPath: wav,
      whisperPath: WHISPER_DIR,
      whisperCppVersion: WHISPER_VERSION,
      model: MODEL,
      language: "ru",
      tokenLevelTimestamps: true,
      printOutput: false,
    });
    captions = toCaptions({ whisperCppOutput: output }).captions;
  } finally {
    rmSync(wav, { force: true });
  }

  // Буквы Whisper со временем: внутри слова время распределяется равномерно.
  let heard = "";
  const heardMs = [];
  for (const c of captions) {
    const chars = norm(c.text);
    for (let k = 0; k < chars.length; k++) {
      heard += chars[k];
      heardMs.push(c.startMs + ((c.endMs - c.startMs) * k) / chars.length);
    }
  }

  const words = splitWords(text);
  let ours = "";
  const wordOfChar = [];
  words.forEach((w, idx) => {
    for (const ch of norm(w)) {
      ours += ch;
      wordOfChar.push(idx);
    }
  });
  if (!heard || !ours) throw new Error("Whisper ничего не распознал");

  // Начало слова = время первой его буквы, которую удалось сопоставить.
  const map = alignChars(ours, heard);
  const starts = new Array(words.length).fill(null);
  map.forEach((j, i) => {
    const w = wordOfChar[i];
    if (j >= 0 && starts[w] === null) starts[w] = heardMs[j];
  });

  // Пропуски заполняем между соседями, время не должно идти назад.
  for (let w = 0; w < words.length; w++) {
    if (starts[w] !== null) continue;
    const prev = w > 0 ? starts[w - 1] : 0;
    let next = w + 1;
    while (next < words.length && starts[next] === null) next++;
    const nextMs = next < words.length ? starts[next] : durationMs;
    starts[w] = prev + (nextMs - prev) / (next - w + 1);
  }
  for (let w = 1; w < words.length; w++) starts[w] = Math.max(starts[w], starts[w - 1] + 60);

  return words.map((w, idx) => ({
    text: w,
    startMs: Math.round(starts[idx]),
    endMs: Math.round(idx + 1 < words.length ? starts[idx + 1] : durationMs),
  }));
}

// Проверка вручную: node scripts/word-timings.mjs файл.mp3 "текст"
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, text] = process.argv.slice(2);
  if (!existsSync(file)) throw new Error(`Нет файла ${file}`);
  console.log("Готовлю Whisper (первый раз скачивается около 150 МБ)...");
  for (const w of await wordTimings(file, text, 60000)) {
    console.log(`${(w.startMs / 1000).toFixed(2).padStart(6)} с  ${w.text}`);
  }
}
