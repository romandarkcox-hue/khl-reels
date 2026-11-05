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
import { CHANNEL_LINE, clubTags, fullName } from "./clubs.mjs";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
function formatDay(isoDay) {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}


const CONF_IN = { west: "на Западе", east: "на Востоке" };

// Места двух команд одной строкой: «1-е и 2-е места на Востоке»
// или «9-е на Востоке и 1-е на Западе».
function placesLine(m) {
  const { home: h, away: a } = m;
  if (!h.rank || !a.rank) return null;
  if (h.conf === a.conf) return `Места: ${h.rank}-е и ${a.rank}-е ${CONF_IN[h.conf]}`;
  return `Места: ${h.rank}-е ${CONF_IN[h.conf]} и ${a.rank}-е ${CONF_IN[a.conf]}`;
}

// Один текст для Telegram и ВК (одобрено 05.11): первая строка — заголовок с тем,
// что ищут («матчи КХЛ сегодня», дата), каждый матч отдельным блоком с полными
// названиями клубов, в конце ссылка на канал и хэштеги (общие + клубы дня).
// Подпись в Telegram — не больше 1024 знаков: в загруженный день места
// переезжают в скобки рядом с клубом, потом убираются города.
function postText(day, matches) {
  const tags = `#КХЛ #хоккей #расписаниеКХЛ ${clubTags(matches.flatMap((m) => [m.home.name, m.away.name]))}`;
  const build = (withPlaces, withCity) => {
    const name = (t, inlineRank) =>
      (withCity ? fullName(t.name) : t.name) + (inlineRank && t.rank ? ` (${t.rank}-е)` : "");
    const blocks = matches.map((m) => {
      const lines = [`${m.time} · ${name(m.home, !withPlaces)} — ${name(m.away, !withPlaces)}`];
      const places = withPlaces && placesLine(m);
      if (places) lines.push(places);
      return lines.join("\n");
    });
    return [
      `🏒 Матчи КХЛ сегодня, ${formatDay(day)}: расписание`,
      "",
      blocks.join(withPlaces ? "\n\n" : "\n"),
      "",
      withPlaces ? "Время московское." : "Время московское, в скобках место в конференции.",
      CHANNEL_LINE,
      "",
      tags,
    ].join("\n");
  };
  for (const [p, c] of [[true, true], [false, true], [false, false]]) {
    const text = build(p, c);
    if (text.length <= 1024) return text;
  }
  return build(false, false);
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
