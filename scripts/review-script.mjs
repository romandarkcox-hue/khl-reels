// Текст озвучки и подпись для Reels «Итоги игрового дня».
//
// Сцены: заставка, по сцене на каждый матч, финал.
// Если в .env есть ANTHROPIC_API_KEY, текст пишет Claude по фактам,
// иначе (или при ошибке API) собирается по шаблону.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const CONF_WHERE = { west: "на Западе", east: "на Востоке" };

function formatDay(isoDay) {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// Ключевые факты матча, из которых собирается рассказ.
export function matchStory(m) {
  const winnerSide = m.home.score > m.away.score ? "home" : "away";
  const winner = m[winnerSide];
  const loser = m[winnerSide === "home" ? "away" : "home"];
  const regular = m.goals.filter((g) => !g.shootout);

  // Самое большое отставание победителя по ходу матча.
  let worst = { deficit: 0, score: null };
  let home = 0;
  let away = 0;
  for (const g of regular) {
    if (g.side === "home") home++;
    else away++;
    const own = winnerSide === "home" ? home : away;
    const other = winnerSide === "home" ? away : home;
    if (other - own > worst.deficit) worst = { deficit: other - own, score: `${own}:${other}` };
  }

  // Победная шайба: гол победителя, после которого проигравший уже не догнал.
  const winnerGoals = regular.filter((g) => g.side === winnerSide);
  const shootoutGoal = m.goals.find((g) => g.shootout);
  const decisive = m.ots === "SO" ? shootoutGoal : winnerGoals[loser.score];

  const byScorer = new Map();
  for (const g of regular) {
    if (!g.scorer) continue;
    byScorer.set(g.scorer.name, (byScorer.get(g.scorer.name) ?? 0) + 1);
  }
  const multi = [...byScorer].filter(([, n]) => n >= 2).map(([name, n]) => ({ name, n }));

  return {
    winner,
    loser,
    comebackFrom: worst.deficit >= 2 ? worst.score : null,
    shutout: loser.score === 0,
    decisive: decisive?.scorer?.name ?? null,
    multi,
  };
}

function scoreLine(m) {
  const extra = m.ots === "OT" ? " в овертайме" : m.ots === "SO" ? " по буллитам" : "";
  return `${m.home.score}:${m.away.score}${extra}`;
}

function matchText(m) {
  const s = matchStory(m);
  const parts = [`${m.home.name} — ${m.away.name}, ${scoreLine(m)}.`];

  if (s.comebackFrom) {
    parts.push(`${s.winner.name} отыгрывается, уступая ${s.comebackFrom}, и побеждает.`);
  } else if (s.shutout) {
    parts.push(`${s.winner.name} побеждает всухую.`);
  }
  for (const { name, n } of s.multi) {
    parts.push(n === 2 ? `${name} оформляет дубль.` : n === 3 ? `${name} оформляет хет-трик.` : `${name} забрасывает ${n} шайбы.`);
  }
  if (s.decisive) {
    parts.push(
      m.ots === "SO"
        ? `Победный буллит реализует ${s.decisive}.`
        : `Победную шайбу забрасывает ${s.decisive}.`,
    );
  }

  const w = s.winner;
  if (w.rank && w.conf) {
    const where = CONF_WHERE[w.conf];
    parts.push(
      w.prevRank && w.rank < w.prevRank
        ? `${w.name} поднимается на ${w.rank}-е место ${where}.`
        : `${w.name} — ${w.rank}-е место ${where}, ${plural(w.pts, "очко", "очка", "очков")}.`,
    );
  }
  return parts.join(" ");
}

export function templateScript(review) {
  const n = review.matches.length;
  const scenes = [
    {
      id: "intro",
      type: "intro",
      text: `Итоги игрового дня КХЛ, ${formatDay(review.date)}. ${n === 1 ? "Сыгран 1 матч" : `Сыграно ${plural(n, "матч", "матча", "матчей")}`}.`,
    },
    ...review.matches.map((m) => ({ id: `m${m.id}`, type: "match", matchId: m.id, text: matchText(m) })),
    {
      id: "outro",
      type: "outro",
      text: "Таблицы конференций — завтра утром в карусели. Подписывайтесь, чтобы не пропустить!",
    },
  ];

  const caption = [
    `🏒 Итоги игрового дня КХЛ, ${formatDay(review.date)}`,
    "",
    ...review.matches.map((m) => `${m.home.name} — ${m.away.name} ${scoreLine(m)}`),
    "",
    "Таблицы конференций — завтра в 7:00 в карусели.",
    "",
    [
      "#КХЛ", "#хоккей", "#KHL", "#итогидня",
      ...review.matches.flatMap((m) => [m.home.name, m.away.name].map((t) => `#${t.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, "")}`)),
    ].join(" "),
  ].join("\n");

  return { scenes, caption };
}

const SYSTEM_PROMPT = `Ты — спортивный комментатор Instagram-аккаунта про КХЛ. Пишешь текст озвучки для вертикального ролика «Итоги игрового дня»: заставка, по сцене на каждый матч, финал. Текст будет читать синтезатор речи.

Правила:
- Только факты из присланных данных. Не выдумывай моменты, которых нет в данных.
- Заставка: 1 предложение (дата и число матчей).
- Сцена матча: 2–4 коротких живых предложения, 8–15 секунд чтения: счёт (и овертайм/буллиты), главный сюжет (камбэк, сухая победа, дубль), автор победной шайбы, место победителя в конференции.
- Финал: 1–2 предложения: таблицы — завтра утром в карусели, призыв подписаться.
- Пиши так, чтобы удобно читалось вслух: без скобок, эмодзи и сокращений. Названия команд не склоняй (пиши как в данных), подбирай глаголы в настоящем времени, чтобы не ошибиться в роде.
- caption — подпись к Reels: заголовок с датой и эмодзи, список матчей со счётом, 5–8 хэштегов. До 1500 символов.`;

const SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: { matchId: { type: "integer" }, text: { type: "string" } },
        required: ["matchId", "text"],
        additionalProperties: false,
      },
    },
    outro: { type: "string" },
    caption: { type: "string" },
  },
  required: ["intro", "matches", "outro", "caption"],
  additionalProperties: false,
};

async function aiScript(review, draft) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { betaJSONSchemaOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/json-schema");
  const client = new Anthropic();
  const facts = review.matches.map((m) => ({ ...m, story: matchStory(m) }));
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // При отказе модели запрос сам повторится на подходящей резервной модели.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { format: betaJSONSchemaOutputFormat(SCHEMA) },
    messages: [
      {
        role: "user",
        content: `Дата: ${review.date}\nМатчи (JSON):\n${JSON.stringify(facts, null, 2)}\n\nЧерновик по шаблону:\n${draft.scenes.map((s) => s.text).join("\n")}`,
      },
    ],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new Error(`модель остановилась с причиной ${response.stop_reason}`);
  }
  const out = response.parsed_output;
  const textById = new Map(out.matches.map((m) => [m.matchId, m.text]));
  return {
    scenes: draft.scenes.map((s) => ({
      ...s,
      text:
        s.type === "intro" ? out.intro : s.type === "outro" ? out.outro : textById.get(s.matchId) ?? s.text,
    })),
    caption: out.caption,
  };
}

// Возвращает { scenes, caption, source: "ai" | "template" }.
export async function writeReviewScript(review) {
  const draft = templateScript(review);
  if (!process.env.ANTHROPIC_API_KEY) return { ...draft, source: "template" };
  try {
    return { ...(await aiScript(review, draft)), source: "ai" };
  } catch (err) {
    console.warn(`Claude API не сработал (${err.message}), беру текст по шаблону`);
    return { ...draft, source: "template" };
  }
}
