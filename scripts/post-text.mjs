// Текст вечернего поста (счета дня + таблицы конференций): заголовок с двумя
// самыми яркими матчами, затем счёт и короткая фраза по каждому матчу.
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

// Насколько победитель уступал по ходу матча: { behind, score } (счёт «хозяева:гости»).
function comeback(g) {
  let worst = { behind: 0, score: null };
  for (const x of g.goals.filter((x) => !x.shootout)) {
    const [h, a] = x.score.split(":").map(Number);
    const behind = g.winner === "home" ? a - h : h - a;
    if (behind > worst.behind) worst = { behind, score: x.score };
  }
  return worst;
}

// Лучший бомбардир матча: [фамилия, голов] или [].
function topScorer(g) {
  const bySurname = new Map();
  for (const x of g.goals) {
    if (!x.shootout && x.scorer) bySurname.set(x.scorer, (bySurname.get(x.scorer) ?? 0) + 1);
  }
  return [...bySurname].sort((a, b) => b[1] - a[1])[0] ?? [];
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

  const back = comeback(g);
  if (back.behind >= 2) out.push(`камбэк с ${back.score}`);

  const [star, starGoals] = topScorer(g);
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

// Заголовок поста — первая строка, её видно в списке чатов Telegram.
// Род команды (для глагола) и винительный падеж там, где он не совпадает с названием.
const GENDER = {
  "Динамо М": "n", "Динамо Мн": "n", "Торпедо": "n",
  "Лада": "f", "Северсталь": "f", "Сибирь": "f",
  "Драконы": "pl",
};
const ACCUSATIVE = { "Лада": "Ладу", "Салават Юлаев": "Салавата Юлаева", "Драконы": "Драконов" };
const VERB_ENDING = { m: "", f: "а", n: "о", pl: "и" };

// Самое яркое в матче одной фразой и его вес: разгром > камбэк > хет-трик >
// сухая победа > овертайм или буллиты > обычная победа.
function headlineEvent(g) {
  const [home, away] = g.score.split(":").map(Number);
  const [winner, loser] = g.winner === "home" ? [g.home, g.away] : [g.away, g.home];
  const [winGoals, loseGoals] = [Math.max(home, away), Math.min(home, away)];
  const margin = winGoals - loseGoals;
  const verb = (stem) => stem + VERB_ENDING[GENDER[winner] ?? "m"];
  const beat = (stem, tail = "", how = "") =>
    `${winner} ${how}${verb(stem)} ${ACCUSATIVE[loser] ?? loser} ${winGoals}:${loseGoals}${tail}`;

  if (margin >= 4) return { weight: 50 + margin, text: beat("разгромил") };
  const back = comeback(g);
  if (back.behind >= 2) {
    const [h, a] = back.score.split(":");
    const from = g.winner === "home" ? `${h}:${a}` : `${a}:${h}`;
    return { weight: 40 + back.behind, text: beat("обыграл", `, отыгравшись с ${from}`) };
  }
  const [star, starGoals] = topScorer(g);
  if (starGoals >= 3) return { weight: 30, text: beat("обыграл", `, хет-трик ${star}`) };
  if (loseGoals === 0) return { weight: 20 + margin, text: beat("обыграл", "", "всухую ") };
  if (g.ots === "SO") return { weight: 10, text: beat("обыграл", " по буллитам") };
  if (g.ots === "OT") return { weight: 10, text: beat("обыграл", " в овертайме") };
  return { weight: margin, text: beat("обыграл") };
}

// Чтобы глагол не повторялся во втором матче заголовка.
const SYNONYMS = [["разгромил", "крупно обыграл"], ["обыграл", "победил"]];

// Два самых ярких матча (если не влезают — один) и дата.
export function headline(facts) {
  const [first, second] = facts.games.map(headlineEvent).sort((a, b) => b.weight - a.weight).map((e) => e.text);
  const tail = ` · итоги ${formatDay(facts.day)}`;
  if (!second) return `🏒 ${first}${tail}`;
  const [word, alt] = SYNONYMS.find(([w]) => first.includes(w) && second.includes(w)) ?? [];
  const two = `🏒 ${first}; ${word ? second.replace(word, alt) : second}${tail}`;
  return two.length <= 120 ? two : `🏒 ${first}${tail}`;
}

function templateLines(facts, perMatch) {
  const lines = [headline(facts), ""];
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
