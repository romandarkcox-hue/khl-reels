// Утренний анонс: матчи игрового дня с временем начала и местом команд в таблице.
// Публикуется в Telegram-канал и в группу ВК.
// Картинка 4:5 (до 6 матчей) или две, если матчей больше. Нет матчей — ничего не делаем.
//
// Запуск:  node scripts/make-announce.mjs [ГГГГ-ММ-ДД] [--to-me | --no-send]
//   по умолчанию сегодня по Москве и публикация в канал;
//   --to-me присылает пост в личку вместо канала, --no-send только рисует.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, fetchDayMatches, renderDayCards } from "./day-cards.mjs";
import { fail, moscowNow } from "./khl.mjs";
import { channelId, sendPost } from "./send-telegram.mjs";
import { sendVkPostSafe } from "./send-vk.mjs";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const CONF_SHORT = { west: "Запад", east: "Восток" };

function formatDay(isoDay) {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

function teamLabel(t) {
  return t.rank ? `${t.name} (${t.rank}-е, ${CONF_SHORT[t.conf]})` : t.name;
}

function matchesWord(n) {
  const [d, dd] = [n % 10, n % 100];
  if (d === 1 && dd !== 11) return "матч";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "матча";
  return "матчей";
}

// Заголовок — первая строка, её видно в списке чатов Telegram. Главный матч —
// пара команд, которые в сумме выше всех в таблице.
function headline(day, matches) {
  const date = ` · ${formatDay(day)}`;
  const pair = (m) => `${m.home.name}${m.home.rank ? ` (${m.home.rank}-е)` : ""} — ${m.away.name}${m.away.rank ? ` (${m.away.rank}-е)` : ""}`;
  if (matches.length === 1) {
    return `🏒 Сегодня в КХЛ один матч: ${pair(matches[0])}, начало в ${matches[0].time}${date}`;
  }
  const count = `${matches.length} ${matchesWord(matches.length)}`;
  const ranked = matches.filter((m) => m.home.rank && m.away.rank);
  if (!ranked.length) return `🏒 Сегодня в КХЛ ${count}${date}`;
  const main = ranked.reduce((best, m) =>
    m.home.rank + m.away.rank < best.home.rank + best.away.rank ? m : best);
  return `🏒 Сегодня в КХЛ ${count}, главный: ${pair(main)}${date}`;
}

function postText(day, matches) {
  const lines = matches.map((m) => `${m.time}  ${teamLabel(m.home)} — ${teamLabel(m.away)}`);
  return [
    headline(day, matches),
    "",
    ...lines,
    "",
    "Время московское. В скобках место в таблице конференции.",
    "",
    "#КХЛ #хоккей #KHL #матчидня",
  ].join("\n");
}

const args = process.argv.slice(2);
const noSend = args.includes("--no-send");
const toMe = args.includes("--to-me");
const day = args.find((a) => !a.startsWith("--")) ?? moscowNow().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`дата должна быть в виде ГГГГ-ММ-ДД, а не «${day}»`);

console.log(`1/4 Матчи на ${day}...`);
const { matches } = await fetchDayMatches(day);
if (!matches.length) {
  console.log("   матчей нет, анонс не нужен.");
  process.exit(0);
}
console.log(`   матчей ${matches.length}`);

console.log("2/4 Рисую картинки...");
const files = renderDayCards("announce", day, matches);

console.log("3/4 Пишу текст поста...");
const text = postText(day, matches);
writeFileSync(join(OUT_DIR, "announce.txt"), text + "\n");

if (noSend) {
  console.log("4/4 Отправку пропускаю (--no-send).");
} else {
  console.log(`4/4 Публикую ${toMe ? "вам в личку" : `в канал ${channelId}`}...`);
  const link = await sendPost(files, text, toMe ? undefined : channelId);
  if (!toMe) await sendVkPostSafe(files, text, link);
}

console.log("Готово:", [...files, join(OUT_DIR, "announce.txt")].join(", "));
