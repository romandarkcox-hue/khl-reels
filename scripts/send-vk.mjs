// Публикация поста на стене группы ВКонтакте: текст + ссылка на тот же пост в Telegram.
//
// Запуск: node scripts/send-vk.mjs https://t.me/KHLtablitca/43 --text-file video/out/announce.txt
//
// Берёт VK_GROUP_TOKEN (ключ сообщества) из .env или окружения.
// Картинки с ключом сообщества в пост не попадают (проверено 2026-10-28):
// photos.getWallUploadServer и загрузка в альбом дают ошибку 27, а «фото для
// сообщений» и картинку-файл (docs.getWallUploadServer) wall.post молча
// выбрасывает; ссылку-вложение отклоняет (link_photo_sizing_rule). Ключ
// пользователя с правом photos VK ID выдаёт только бизнесу по заявке.
// Поэтому в ВК только текст, а ссылка на пост в Telegram с картинками — в нём.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "./env.mjs";
import { sendMessage } from "./send-telegram.mjs";

const API = "https://api.vk.ru/method";
const VERSION = "5.199";

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

// Ссылка на Telegram встаёт перед строкой хэштегов (если она есть в конце).
export function withLink(text, link) {
  if (!link) return text;
  const line = `🖼 Картинки — в Telegram: ${link}`;
  const lines = text.trimEnd().split("\n");
  if (lines.at(-1).startsWith("#")) {
    lines.splice(-1, 0, line, "");
    return lines.join("\n");
  }
  return `${text.trimEnd()}\n\n${line}`;
}

// Пост от имени группы. Возвращает ссылку на него.
export async function sendVkPost(text, link) {
  const [group] = (await callVk("groups.getById")).groups;
  const { post_id } = await callVk("wall.post", {
    owner_id: -group.id,
    from_group: 1,
    message: withLink(text, link),
  });
  return `https://vk.ru/wall-${group.id}_${post_id}`;
}

// Для утреннего и вечернего скриптов: ВК публикуется после Telegram, и его сбой
// не должен ронять запуск. Об ошибке пишем вам в личку Telegram.
export async function sendVkPostSafe(text, link) {
  if (!token) {
    console.log("   ВК пропускаю: не задан VK_GROUP_TOKEN.");
    return;
  }
  try {
    console.log(`   ВК: ${await sendVkPost(text, link)}`);
  } catch (err) {
    console.error(`   ВК не опубликован: ${err.message}`);
    await sendMessage(`⚠️ Пост в ВК не опубликован (в Telegram вышел): ${err.message}`);
  }
}

// Запуск из командной строки
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const textAt = args.indexOf("--text-file");
  const link = args.find((a, i) => !a.startsWith("--") && i !== textAt + 1) ?? "";
  const text = textAt === -1 ? "" : readFileSync(args[textAt + 1], "utf8").trim();
  try {
    console.log("Пост в ВК:", await sendVkPost(text, link));
  } catch (err) {
    console.error(`Ошибка: ${err.message}`);
    process.exit(1);
  }
}
