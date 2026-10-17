// Текст для поста-карусели: кто вчера играл, кто поднялся и опустился,
// лидеры и борьба за плей-офф.
//
// Если в .env есть ANTHROPIC_API_KEY, текст пишет Claude по собранным фактам.
// Без ключа (или при любой ошибке API) собирается текст по шаблону.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const CONF_WHERE = { west: "на Западе", east: "на Востоке" };

function addDays(isoDay, days) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDay(isoDay) {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// Сайт пишет даты матчей как "16 окт" или "30 сент".
function isSameDay(label, isoDay) {
  const [, month, day] = isoDay.split("-").map(Number);
  const [labelDay, labelMonth = ""] = String(label).trim().split(/\s+/);
  const want = MONTHS[month - 1];
  const sameMonth =
    labelMonth.slice(0, 3) === want.slice(0, 3) || (month === 5 && labelMonth.startsWith("ма"));
  return Number(labelDay) === day && sameMonth;
}

function points(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} очко`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} очка`;
  return `${n} очков`;
}

// Самый свежий снимок таблицы до указанного дня (или null, если его нет).
export function loadPreviousSnapshot(historyDir, isoDay) {
  if (!existsSync(historyDir)) return null;
  const days = readdirSync(historyDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < isoDay)
    .sort();
  if (!days.length) return null;
  return JSON.parse(readFileSync(join(historyDir, days.at(-1)), "utf8"));
}

export function buildFacts(standings, previous) {
  const today = standings.fetchedAt.slice(0, 10);
  const yesterday = addDays(today, -1);
  const teams = standings.conferences.flatMap((c) => c.teams.map((t) => ({ ...t, conf: c.id })));

  // Вчерашние матчи (у каждой команды свои последние 5, поэтому убираем повторы).
  const games = new Map();
  for (const t of teams) {
    for (const m of t.lastMatches ?? []) {
      if (isSameDay(m.date, yesterday) && !games.has(m.id)) {
        games.set(m.id, { home: m.home, away: m.away, score: m.score });
      }
    }
  }

  // Движение в таблице относительно прошлого снимка.
  const moves = [];
  if (previous) {
    const prev = new Map();
    for (const c of previous.conferences) for (const t of c.teams) prev.set(t.clubId, t);
    for (const t of teams) {
      const p = prev.get(t.clubId);
      if (!p) continue;
      moves.push({
        name: t.name,
        conf: t.conf,
        from: p.rank,
        to: t.rank,
        enteredPlayoffZone: !p.inPlayoffZone && t.inPlayoffZone,
        leftPlayoffZone: p.inPlayoffZone && !t.inPlayoffZone,
      });
    }
  }

  const conferences = standings.conferences.map((c) => {
    const lastIn = c.teams.filter((t) => t.inPlayoffZone).at(-1);
    const firstOut = c.teams.find((t) => !t.inPlayoffZone);
    return {
      id: c.id,
      name: c.name,
      leader: { name: c.teams[0].name, pts: c.teams[0].pts },
      second: { name: c.teams[1].name, pts: c.teams[1].pts },
      playoffLine: lastIn && firstOut
        ? { lastIn: { name: lastIn.name, pts: lastIn.pts }, firstOut: { name: firstOut.name, pts: firstOut.pts } }
        : null,
    };
  });

  return {
    today,
    yesterday,
    games: [...games.values()],
    hasPrevious: Boolean(previous),
    rose: moves.filter((m) => m.to < m.from).sort((a, b) => (b.from - b.to) - (a.from - a.to)),
    fell: moves.filter((m) => m.to > m.from).sort((a, b) => (a.from - a.to) - (b.from - b.to)),
    enteredPlayoffZone: moves.filter((m) => m.enteredPlayoffZone).map((m) => m.name),
    leftPlayoffZone: moves.filter((m) => m.leftPlayoffZone).map((m) => m.name),
    conferences,
  };
}

function hashtags(facts) {
  const tags = ["#КХЛ", "#хоккей", "#таблицаКХЛ", "#KHL"];
  for (const c of facts.conferences) tags.push(`#${c.leader.name.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, "")}`);
  return [...new Set(tags)].join(" ");
}

export function templateText(facts) {
  const lines = [`🏒 Таблица КХЛ на ${formatDay(facts.today)}`, ""];

  if (facts.games.length) {
    lines.push(`Матчи ${formatDay(facts.yesterday)}:`);
    for (const g of facts.games) lines.push(`${g.home} — ${g.away} ${g.score}`);
  } else {
    lines.push(`${formatDay(facts.yesterday)} матчей не было.`);
  }
  lines.push("");

  if (facts.rose.length) {
    lines.push(`📈 Поднялись: ${facts.rose.map((m) => `${m.name} (${m.from} → ${m.to})`).join(", ")}`);
  }
  if (facts.fell.length) {
    lines.push(`📉 Опустились: ${facts.fell.map((m) => `${m.name} (${m.from} → ${m.to})`).join(", ")}`);
  }
  if (facts.enteredPlayoffZone.length) {
    lines.push(`🔥 В зону плей-офф: ${facts.enteredPlayoffZone.join(", ")}`);
  }
  if (facts.leftPlayoffZone.length) {
    lines.push(`❄️ Выпали из восьмёрки: ${facts.leftPlayoffZone.join(", ")}`);
  }
  if (facts.rose.length || facts.fell.length) lines.push("");

  for (const c of facts.conferences) {
    const gap = c.leader.pts - c.second.pts;
    lines.push(
      `👑 Лидер ${CONF_WHERE[c.id]}: ${c.leader.name}, ${points(c.leader.pts)}` +
        (gap > 0
          ? `. Ближайший преследователь — ${c.second.name} (−${gap})`
          : `. Столько же набрал ${c.second.name}`),
    );
  }
  for (const c of facts.conferences) {
    if (!c.playoffLine) continue;
    const { lastIn, firstOut } = c.playoffLine;
    lines.push(
      `⚔️ Борьба за 8-е место ${CONF_WHERE[c.id]}: ${lastIn.name} (${lastIn.pts}) и ${firstOut.name} (${firstOut.pts})`,
    );
  }

  lines.push("", "Листайте карусель: Запад ➡️ Восток", "", hashtags(facts));
  return lines.join("\n");
}

const SYSTEM_PROMPT = `Ты ведёшь Instagram-аккаунт про хоккей и каждое утро пишешь подпись к посту-карусели с таблицами конференций КХЛ (картинка 1 — Запад, картинка 2 — Восток).

Пиши по-русски, живо, но без выдумок: используй только факты из присланных данных. Если чего-то в данных нет (например, сравнения со вчерашней таблицей), просто не упоминай это.

Структура подписи:
- первая строка: цепляющий заголовок с датой и эмодзи;
- 3–5 коротких предложений: главное из вчерашних матчей, кто поднялся и кто опустился, интрига у линии плей-офф, лидеры;
- счёт матчей можно дать коротким списком;
- в конце строка «Листайте карусель: Запад ➡️ Восток» и 5–8 хэштегов (#КХЛ, #хоккей и названия команд из новостей дня).

Не больше 1500 символов. Выведи только текст подписи, без пояснений.`;

async function aiText(facts, draft) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // При отказе модели запрос сам повторится на подходящей резервной модели.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Данные дня (JSON):\n${JSON.stringify(facts, null, 2)}\n\nЧерновик по шаблону (можно опираться на него):\n${draft}`,
      },
    ],
  });
  if (response.stop_reason !== "end_turn") {
    throw new Error(`модель остановилась с причиной ${response.stop_reason}`);
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("пустой ответ");
  return text;
}

// Возвращает { text, source: "ai" | "template" }.
export async function writePostText(facts) {
  const draft = templateText(facts);
  if (!process.env.ANTHROPIC_API_KEY) return { text: draft, source: "template" };
  try {
    return { text: await aiText(facts, draft), source: "ai" };
  } catch (err) {
    console.warn(`Claude API не сработал (${err.message}), беру текст по шаблону`);
    return { text: draft, source: "template" };
  }
}
