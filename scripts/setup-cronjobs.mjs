// Будильники на cron-job.org: в нужное время просят GitHub запустить воркфлоу.
// Расписание GitHub иногда пропускает запуски, а cron-job.org срабатывает точно.
// Дубли не страшны: воркфлоу сами проверяют метки в data/posted/.
//
// Запуск:  node scripts/setup-cronjobs.mjs          создать или обновить задания
//          node scripts/setup-cronjobs.mjs --list   показать задания и последний ответ
//
// Нужны в .env: CRONJOB_API_KEY (cron-job.org → Settings → API) и
// GH_DISPATCH_TOKEN (fine-grained токен GitHub: репозиторий khl-reels, Actions: Read and write).

import "./env.mjs";

const API = "https://api.cron-job.org";
const REPO = "romandarkcox-hue/khl-reels";
const POST = 1; // код метода POST в API cron-job.org

const JOBS = [
  {
    title: "KHL: Анонс 7:00",
    oldTitles: ["KHL: Карусель 6:45"], // так задание называлось раньше
    workflow: "morning-cards.yml",
    hours: [7],
    minutes: [0],
  },
  {
    // Те же проверки, что у расписания GitHub: с 20:10 до 01:50 МСК каждые 20 минут.
    title: "KHL: Итоги дня",
    workflow: "evening-review.yml",
    hours: [20, 21, 22, 23, 0, 1],
    minutes: [10, 30, 50],
  },
];

const key = process.env.CRONJOB_API_KEY;
const ghToken = process.env.GH_DISPATCH_TOKEN;
if (!key) throw new Error("Нет CRONJOB_API_KEY в .env");

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`cron-job.org ответил ${res.status} на ${method} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const jobBody = (job) => ({
  url: `https://api.github.com/repos/${REPO}/actions/workflows/${job.workflow}/dispatches`,
  title: job.title,
  enabled: true,
  saveResponses: true,
  requestMethod: POST,
  schedule: {
    timezone: "Europe/Moscow",
    expiresAt: 0,
    hours: job.hours,
    minutes: job.minutes,
    mdays: [-1],
    months: [-1],
    wdays: [-1],
  },
  extendedData: {
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
  },
  // Письмо на почту аккаунта, если GitHub перестал принимать запуск (например, истёк токен).
  notification: { onFailure: true, onSuccess: false, onDisable: true },
});

const { jobs } = await api("GET", "/jobs");

if (process.argv.includes("--list")) {
  for (const j of jobs) {
    const next = j.nextExecution ? new Date(j.nextExecution * 1000).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "—";
    console.log(`${j.title}: ${j.enabled ? "включено" : "выключено"}, следующий запуск ${next} МСК, последний ответ ${j.lastStatus} (${j.lastDuration ?? "—"} мс)`);
  }
  process.exit(0);
}

if (!ghToken) throw new Error("Нет GH_DISPATCH_TOKEN в .env");
for (const job of JOBS) {
  const existing = jobs.find((j) => j.title === job.title || job.oldTitles?.includes(j.title));
  if (existing) {
    await api("PATCH", `/jobs/${existing.jobId}`, { job: jobBody(job) });
    console.log(`Обновлено: ${job.title}`);
  } else {
    const { jobId } = await api("PUT", "/jobs", { job: jobBody(job) });
    console.log(`Создано: ${job.title} (№ ${jobId})`);
    await new Promise((r) => setTimeout(r, 1500)); // не больше одного создания в секунду
  }
}
