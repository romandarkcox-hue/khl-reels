// Публикация поста на стене группы ВКонтакте: те же картинки и текст.
//
// Запуск: node scripts/send-vk.mjs a.jpg b.jpg --text-file video/out/announce.txt [--delayed]
//   --delayed — отложенная запись через месяц (видна только администраторам), для проверки.
//
// Основной способ (с 2026-11-10): ключ пользователя-администратора VK_USER_TOKEN
// (права wall, photos, groups, offline). С ним картинки идут обычными фото, все
// в одной записи (до 10). Номер группы — VK_GROUP_ID (по умолчанию khltable).
//
// Запасной способ — VK_GROUP_TOKEN (ключ сообщества), картинки гифками:
// Обычные картинки с ключом сообщества в пост не попадают (проверено 2026-10-28):
// photos.getWallUploadServer и загрузка в альбом дают ошибку 27, а «фото для
// сообщений» и jpg-файл (docs.getWallUploadServer) wall.post молча выбрасывает;
// ссылку-вложение отклоняет (link_photo_sizing_rule). Гифку-файл ВК показывает.
// Поэтому каждая картинка перегоняется в GIF (ffmpeg из Remotion) и прикрепляется
// документом. Если с гифками не вышло — текст и ссылка на пост в Telegram.

import { execSync } from "node:child_process";
import { openAsBlob, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "./env.mjs";
import { sendMessage } from "./send-telegram.mjs";

const API = "https://api.vk.ru/method";
const VERSION = "5.199";
const VIDEO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "video");

const token = process.env.VK_GROUP_TOKEN;
const userToken = process.env.VK_USER_TOKEN;
const GROUP_ID = Number(process.env.VK_GROUP_ID || 232858456);

async function callVk(method, params = {}, key = token) {
  if (!key) throw new Error("не задан ключ ВК (VK_USER_TOKEN или VK_GROUP_TOKEN)");
  const body = new URLSearchParams({ ...params, access_token: key, v: VERSION });
  const res = await fetch(`${API}/${method}`, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    throw new Error(`ВК ответил на ${method}: ${data.error.error_code} ${data.error.error_msg}`);
  }
  if (!data.response) throw new Error(`ВК ответил на ${method} без данных (HTTP ${res.status})`);
  return data.response;
}

// GIF рядом с исходной картинкой. Своя палитра под картинку, чтобы градиент фона
// не шёл полосами.
function toGif(path) {
  const src = resolve(path);
  const out = src.replace(/\.[^.]+$/, "") + ".gif";
  const filter = "split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a";
  execSync(`npx remotion ffmpeg -y -loglevel error -i "${src}" -vf "${filter}" "${out}"`, {
    cwd: VIDEO_DIR,
    stdio: "inherit",
  });
  return out;
}

// Самая большая ширина превью-картинки документа (0 — превью ещё нет).
function previewWidth(doc) {
  const sizes = doc?.preview?.photo?.sizes ?? [];
  return Math.max(0, ...sizes.map((s) => s.width || 0));
}

// Превью-картинку гифки ВК готовит не сразу: в ответе docs.save она бывает 0×0 и
// появляется через несколько секунд (опыт 05.11). Запись, опубликованная раньше,
// навсегда остаётся просто файлом «….gif» без картинки. Поэтому ждём превью.
async function waitPreview(docId, { timeoutMs = 60000, stepMs = 3000 } = {}) {
  const started = Date.now();
  for (;;) {
    const [doc] = await callVk("docs.getById", { docs: docId });
    const width = previewWidth(doc);
    if (width > 0) {
      console.log(`   ВК: ${docId} превью готово (${width} px) через ${Math.round((Date.now() - started) / 1000)} с`);
      return true;
    }
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

// Копия гифки с другим содержимым файла (комментарий перед концом GIF, картинка
// не меняется), чтобы при повторе ВК обработал её как новый файл.
function freshCopy(gif, attempt) {
  if (attempt === 1) return gif;
  const data = readFileSync(gif);
  const note = Buffer.from(`retry ${attempt} ${Date.now()}`);
  const comment = Buffer.concat([Buffer.from([0x21, 0xfe, note.length]), note, Buffer.from([0x00])]);
  const out = gif.replace(/\.gif$/, `-${attempt}.gif`);
  writeFileSync(out, Buffer.concat([data.subarray(0, data.length - 1), comment, Buffer.from([0x3b])]));
  return out;
}

// Сервер загрузки ВК иногда отвечает страницей ошибки вместо JSON (утро 30.10),
// а превью иногда не появляется. Поэтому загрузка повторяется: до 3 попыток с паузой,
// каждый раз с новым адресом.
export async function uploadDoc(groupId, gif, { tries = 3, pauseMs = 5000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const file = freshCopy(gif, attempt);
      const server = await callVk("docs.getWallUploadServer", { group_id: groupId });
      const form = new FormData();
      form.append("file", await openAsBlob(file, { type: "image/gif" }), basename(gif));
      const res = await fetch(server.upload_url, { method: "POST", body: form });
      const raw = await res.text();
      let uploaded;
      try {
        uploaded = JSON.parse(raw);
      } catch {
        throw new Error(`сервер загрузки ВК ответил не JSON (HTTP ${res.status}): ${raw.slice(0, 80)}`);
      }
      if (!uploaded.file) {
        throw new Error(`ВК не принял гифку ${basename(gif)} (HTTP ${res.status}): ${raw.slice(0, 80)}`);
      }
      const { doc } = await callVk("docs.save", { file: uploaded.file, title: basename(gif) });
      const docId = `${doc.owner_id}_${doc.id}`;
      if (!(await waitPreview(docId))) {
        throw new Error(`ВК не сделал превью для ${basename(gif)} (документ ${docId}) за минуту`);
      }
      return `doc${docId}`;
    } catch (e) {
      if (attempt >= tries) throw e;
      console.log(`   ВК: попытка ${attempt} не вышла (${e.message}), повтор через ${pauseMs / 1000} с`);
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
}

async function uploadGif(groupId, path) {
  return uploadDoc(groupId, toGif(path));
}

// Обычное фото на стену группы (только ключ пользователя). Сервер загрузки ВК
// иногда сбоит (ошибка 500, пустой ответ — 10.11), поэтому до 5 попыток.
async function uploadPhoto(groupId, path, { tries = 5, pauseMs = 5000 } = {}) {
  const type = /\.png$/i.test(path) ? "image/png" : "image/jpeg";
  for (let attempt = 1; ; attempt++) {
    try {
      const server = await callVk("photos.getWallUploadServer", { group_id: groupId }, userToken);
      const form = new FormData();
      form.append("photo", await openAsBlob(resolve(path), { type }), basename(path));
      const res = await fetch(server.upload_url, { method: "POST", body: form });
      const raw = await res.text();
      let up;
      try {
        up = JSON.parse(raw);
      } catch {
        throw new Error(`сервер загрузки ВК ответил не JSON (HTTP ${res.status}): ${raw.slice(0, 80)}`);
      }
      if (!up.photo || up.photo === "[]") {
        throw new Error(`ВК не принял картинку ${basename(path)}: ${raw.slice(0, 80)}`);
      }
      const [photo] = await callVk(
        "photos.saveWallPhoto",
        { group_id: groupId, server: up.server, photo: up.photo, hash: up.hash },
        userToken,
      );
      return `photo${photo.owner_id}_${photo.id}`;
    } catch (e) {
      if (attempt >= tries) throw e;
      console.log(`   ВК: фото, попытка ${attempt} не вышла (${e.message}), повтор через ${pauseMs / 1000} с`);
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
}

// Все картинки обычными фото в одной записи. Возвращает ссылку на запись.
export async function sendVkPhotoPost(photoPaths, text, { delayed = false } = {}) {
  const attachments = [];
  for (const path of photoPaths.slice(0, 10)) attachments.push(await uploadPhoto(GROUP_ID, path));
  return wallPost(GROUP_ID, text, attachments, { key: userToken, delayed });
}

// Ссылка на Telegram встаёт перед строкой хэштегов (если она есть в конце).
function withLink(text, link) {
  if (!link) return text;
  const line = `🖼 Картинки — в Telegram: ${link}`;
  const lines = text.trimEnd().split("\n");
  if (lines.at(-1).startsWith("#")) {
    lines.splice(-1, 0, line, "");
    return lines.join("\n");
  }
  return `${text.trimEnd()}\n\n${line}`;
}

async function groupId() {
  if (!token) return GROUP_ID;
  const [group] = (await callVk("groups.getById")).groups;
  return group.id;
}

// delayed — отложенная запись через 30 дней: её видят только администраторы.
async function wallPost(id, message, attachments = [], { key = userToken || token, delayed = false } = {}) {
  const params = { owner_id: -id, from_group: 1, message, attachments: attachments.join(",") };
  if (delayed) params.publish_date = Math.floor(Date.now() / 1000) + 30 * 86400;
  const { post_id } = await callVk("wall.post", params, key);
  return `https://vk.ru/wall-${id}_${post_id}`;
}

// Пост с гифками от имени группы. В одну запись ВК берёт только одну гифку
// (две → «Exceeded max amount of doc attachments», 2026-10-28), поэтому каждая
// гифка идёт своей записью. Публикуем с конца: наверху стены окажется запись
// с текстом и первой картинкой, под ней остальные по порядку. Запись с одной
// гифкой без текста ВК не принимает, поэтому у остальных подпись — первая
// строка текста с номером: «… (2/2)».
// Возвращает ссылки на записи (первая — с текстом).
export async function sendVkPost(photoPaths, text) {
  const id = await groupId();
  const attachments = [];
  for (const path of photoPaths) attachments.push(await uploadGif(id, path));
  if (attachments.length === 0) return [await wallPost(id, text)];
  const title = text.trim().split("\n")[0];
  const links = [];
  for (let i = attachments.length - 1; i >= 0; i--) {
    const message = i === 0 ? text : `${title} (${i + 1}/${attachments.length})`;
    links.unshift(await wallPost(id, message, [attachments[i]]));
  }
  return links;
}

// Для утреннего и вечернего скриптов: ВК публикуется после Telegram, и его сбой
// не должен ронять запуск. Порядок: обычные фото (ключ пользователя) → гифки
// (ключ сообщества) → текст со ссылкой на Telegram. Об ошибках пишем в личку Telegram.
export async function sendVkPostSafe(photoPaths, text, link) {
  if (!token && !userToken) {
    console.log("   ВК пропускаю: не заданы VK_USER_TOKEN и VK_GROUP_TOKEN.");
    return;
  }
  if (userToken) {
    try {
      console.log(`   ВК (фото): ${await sendVkPhotoPost(photoPaths, text)}`);
      return;
    } catch (err) {
      console.error(`   ВК с фото не вышло: ${err.message}`);
      await sendMessage(`⚠️ ВК: обычные фото не загрузились (${err.message}), пробую запасной способ.`);
      if (!token) {
        try {
          console.log(`   ВК (текст): ${await wallPost(GROUP_ID, withLink(text, link))}`);
        } catch (err2) {
          await sendMessage(`⚠️ Пост в ВК не опубликован (в Telegram вышел): ${err2.message}`);
        }
        return;
      }
    }
  }
  try {
    console.log(`   ВК: ${(await sendVkPost(photoPaths, text)).join(", ")}`);
    return;
  } catch (err) {
    console.error(`   ВК с гифками не вышло: ${err.message}`);
    try {
      console.log(`   ВК (текст): ${await wallPost(await groupId(), withLink(text, link))}`);
      await sendMessage(`⚠️ Пост в ВК вышел без картинок (только текст): ${err.message}`);
    } catch (err2) {
      console.error(`   ВК не опубликован: ${err2.message}`);
      await sendMessage(`⚠️ Пост в ВК не опубликован (в Telegram вышел): ${err2.message}`);
    }
  }
}

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const textFile = valueOf("--text-file");
  const photos = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--text-file");
  const text = textFile ? readFileSync(textFile, "utf8").trim() : "";
  const delayed = args.includes("--delayed");
  try {
    if (userToken) console.log("Пост в ВК:", await sendVkPhotoPost(photos, text, { delayed }));
    else console.log("Пост в ВК:", (await sendVkPost(photos, text)).join(", "));
  } catch (err) {
    console.error(`Ошибка: ${err.message}`);
    process.exit(1);
  }
}
