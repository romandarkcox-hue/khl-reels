// Текст вечернего поста (счета дня + таблицы конференций): итоги матчей,
// кто поднялся и опустился, лидеры и борьба за плей-офф.
//
// Если в .env есть ANTHROPIC_API_KEY, текст пишет Claude по собранным фактам.
// Без ключа (или при любой ошибке API) собирается текст по шаблону.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import "./env.mjs";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const OTS_LABEL = { OT: " (ОТ)", SO: " (Б)" };

function formatDay(isoDay) {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
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

// day — игровой день, matches — его сыгранные матчи из day-cards.mjs.
export function buildFacts(standings, previous, day, matches) {
  const teams = standings.conferences.flatMap((c) => c.teams.map((t) => ({ ...t, conf: c.id })));
  const games = matches.map((m) => ({
    home: m.home.name,
    away: m.away.name,
    score: `${m.score.home}:${m.score.away}`,
    ots: m.score.ots, // "OT" | "SO" | null
    winner: m.score.home > m.score.away ? "home" : "away",
    // Голы из протокола: кто, когда, при каком счёте (для описания матча).
    goals: (m.goals ?? []).map((g) => ({
      side: g.side,
      scorer: g.scorer?.surname ?? null,
      score: g.score,
      period: g.period,
      time: g.time,
      shootout: g.shootout,
    })),
  }));

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
    day,
    games,
    hasPrevious: Boolean(previous),
    rose: moves.filter((m) => m.to < m.from).sort((a, b) => (b.from - b.to) - (a.from - a.to)),
    fell: moves.filter((m) => m.to > m.from).sort((a, b) => (a.from - a.to) - (b.from - b.to)),
    enteredPlayoffZone: moves.filter((m) => m.enteredPlayoffZone).map((m) => m.name),
    leftPlayoffZone: moves.filter((m) => m.leftPlayoffZone).map((m) => m.name),
    conferences,
  };
}

// Подпись к картинкам в Telegram — не больше 1024 знаков.
export const MAX_POST_LENGTH = 1024;

const HASHTAGS = "#КХЛ #хоккей #итогидня";

// Подпись второго вечернего поста — таблиц конференций.
export function tablesText(day) {
  return [
    `📊 Таблица КХЛ после игрового дня ${formatDay(day)}`,
    "",
    "Запад ➡️ Восток",
    "",
    "#КХЛ #хоккей #таблицаКХЛ",
  ].join("\n");
}

// Только результаты: кто с кем сыграл и кто победил.
// Самое интересное о матче по протоколу, по убыванию важности:
// буллит или овертайм, камбэк, хет-трик или дубль, сухая победа или разгром,
// иначе автор победной шайбы. Возвращает список коротких фраз.
function matchHighlights(g) {
  const goals = g.goals.filter((x) => !x.shootout);
  const won = (x) => x.side === g.winner;
  const [home, away] = g.score.split(":").map(Number);
  const winGoals = Math.max(home, away);
  const loseGoals = Math.min(home, away);
  const out = [];

  const so = g.goals.find((x) => x.shootout && won(x));
  const ot = g.ots === "OT" ? goals.filter(won).at(-1) : null;
  if (so?.scorer) out.push(`победный буллит — ${so.scorer}`);
  else if (ot?.scorer) out.push(`в овертайме забил ${ot.scorer}`);

  // Камбэк: насколько победитель уступал по ходу матча.
  let worst = 0;
  let worstScore = null;
  for (const x of goals) {
    const [h, a] = x.score.split(":").map(Number);
    const behind = g.winner === "home" ? a - h : h - a;
    if (behind > worst) [worst, worstScore] = [behind, x.score];
  }
  if (worst >= 2) out.push(`камбэк с ${worstScore}`);

  const bySurname = new Map();
  for (const x of goals) if (x.scorer) bySurname.set(x.scorer, (bySurname.get(x.scorer) ?? 0) + 1);
  const [star, starGoals] = [...bySurname].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (starGoals >= 3) out.push(`хет-трик ${star}`);
  else if (starGoals === 2) out.push(`дубль ${star}`);

  if (loseGoals === 0) out.push("сухая победа");
  else if (winGoals - loseGoals >= 4) out.push("разгром");

  if (!so && !ot) {
    // Победная шайба: гол, после которого у победителя стало на один больше, чем забил проигравший.
    const gwg = goals.filter(won)[loseGoals];
    if (gwg?.scorer && !out.some((p) => p.includes(gwg.scorer))) {
      out.push(`победная шайба — ${gwg.scorer} (${gwg.period}-й период)`);
    }
  }
  return out;
}

function templateLines(facts, perMatch) {
  const lines = [`🏒 Итоги дня КХЛ, ${formatDay(facts.day)}`, ""];
  for (const g of facts.games) {
    const winner = g.winner === "home" ? g.home : g.away;
    const story = matchHighlights(g).slice(0, perMatch).join(", ");
    lines.push(
      `${g.home} — ${g.away} ${g.score}${OTS_LABEL[g.ots] ?? ""}`,
      `✅ ${winner}${story ? `: ${story}` : ""}.`,
      "",
    );
  }
  lines.push(HASHTAGS);
  return lines.join("\n");
}

// В загруженный день описания сокращаются, чтобы текст поместился под картинками.
export function templateText(facts) {
  for (const perMatch of [3, 2, 1, 0]) {
    const text = templateLines(facts, perMatch);
    if (text.length <= MAX_POST_LENGTH) return text;
  }
  return templateLines(facts, 0);
}

const SYSTEM_PROMPT = `Ты ведёшь Telegram-канал про хоккей и каждый вечер после матчей КХЛ пишешь подпись к посту с картинкой счетов матчей дня (таблицы конференций выходят отдельным постом).

Пиши по-русски, коротко и без выдумок: используй только факты из присланных данных.

Структура подписи:
- первая строка: заголовок с датой и эмодзи;
- по каждому матчу: команды, счёт (ots: OT — овертайм, SO — буллиты), кто победил и одна короткая живая фраза о самом интересном по голам (камбэк, дубль, победный гол, буллит);
- никаких рассуждений про таблицу, лидеров, плей-офф и прочих очевидных вещей: только результаты;
- в конце хэштеги: ${HASHTAGS}.

Не больше 900 символов: текст должен поместиться в подпись к картинкам. Выведи только текст подписи, без пояснений.`;

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
    const text = await aiText(facts, draft);
    if (text.length > MAX_POST_LENGTH) throw new Error(`текст длиннее ${MAX_POST_LENGTH} знаков`);
    return { text, source: "ai" };
  } catch (err) {
    console.warn(`Claude API не сработал (${err.message}), беру текст по шаблону`);
    return { text: draft, source: "template" };
  }
}
