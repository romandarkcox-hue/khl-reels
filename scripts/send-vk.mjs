// Публикация поста на стене группы ВКонтакте: картинки + текст.
//
// Запуск: node scripts/send-vk.mjs a.jpg b.jpg --text-file video/out/announce.txt
//
// Берёт VK_GROUP_TOKEN (ключ сообщества) из .env или окружения.
// Обычная загрузка фото на стену (photos.getWallUploadServer) с ключом сообщества
// не работает (ошибка 27), поэтому грузим картинки как «фото для сообщений»:
// они принадлежат группе и прикрепляются к посту.

import { openAsBlob, readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import "./env.mjs";
import { sendMessage } from "./send-telegram.mjs";

const API = "https://api.vk.ru/method";
const VERSION = "5.199";
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

const token = process.env.VK_GROUP_TOKEN;

async function callVk(method, params = {}) {
  if (!token) throw new Error("не задан VK_GROUP_TOKEN (в .env или в окружении)");
  const body = new URLSearchParams({ ...params, access_token: token, v: VERSION });
  const res = await fetch(`${API}/${method}`, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    throw new Error(`ВК ответил на ${method}: ${data.error.error_code} ${data.error.error_msg}`);
  }
  if (!data.response) throw new Error(`ВК ответил на ${method} без данных (HTTP ${res.status})`);
  return data.response;
}

async function uploadPhoto(path) {
  const server = await callVk("photos.getMessagesUploadServer", { peer_id: 0 });
  const form = new FormData();
  // Без типа файла сервер ВК молча не принимает картинку (photo приходит пустым).
  const type = TYPES[extname(path).toLowerCase()] ?? "image/jpeg";
  form.append("photo", await openAsBlob(path, { type }), basename(path));
  const res = await fetch(server.upload_url, { method: "POST", body: form });
  const uploaded = await res.json();
  if (!uploaded.photo || uploaded.photo === "[]") {
    throw new Error(`ВК не принял картинку ${basename(path)}`);
  }
  const [photo] = await callVk("photos.saveMessagesPhoto", uploaded);
  return `photo${photo.owner_id}_${photo.id}_${photo.access_key}`;
}

// Пост от имени группы. Возвращает ссылку на него.
export async function sendVkPost(photoPaths, text) {
  const [group] = (await callVk("groups.getById")).groups;
  const attachments = [];
  for (const path of photoPaths) attachments.push(await uploadPhoto(path));
  const { post_id } = await callVk("wall.post", {
    owner_id: -group.id,
    from_group: 1,
    message: text,
    attachments: attachments.join(","),
  });
  return `https://vk.ru/wall-${group.id}_${post_id}`;
}

// Для утреннего и вечернего скриптов: ВК публикуется после Telegram, и его сбой
// не должен ронять запуск. Об ошибке пишем вам в личку Telegram.
export async function sendVkPostSafe(photoPaths, text) {
  if (!token) {
    console.log("   ВК пропускаю: не задан VK_GROUP_TOKEN.");
    return;
  }
  try {
    console.log(`   ВК: ${await sendVkPost(photoPaths, text)}`);
  } catch (err) {
    console.error(`   ВК не опубликован: ${err.message}`);
    await sendMessage(`⚠️ Пост в ВК не опубликован (в Telegram вышел): ${err.message}`);
  }
}

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const textAt = args.indexOf("--text-file");
  const photos = args.slice(0, textAt === -1 ? undefined : textAt);
  const text = textAt === -1 ? "" : readFileSync(args[textAt + 1], "utf8").trim();
  try {
    console.log("Пост в ВК:", await sendVkPost(photos, text));
  } catch (err) {
    console.error(`Ошибка: ${err.message}`);
    process.exit(1);
  }
}
