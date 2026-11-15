// Общие запросы к khl.ru: обход защиты от ботов, сессия и REST-блоки сайта.

export const SITE = "https://www.khl.ru";
export const TOURNAMENT = 1436; // регулярный чемпионат 2026/27
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const SESSION_ATTEMPTS = 6;
const SESSION_RETRY_MS = 120_000;

export function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

function cookieHeader(cookies) {
  return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}

// Защита от ботов на khl.ru и img.khl.ru сначала ставит cookie и делает
// редирект на тот же адрес, поэтому редиректы проходим вручную, сохраняя cookie.
export async function fetchWithCookies(url, cookies, init = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, ...init.headers, Cookie: cookieHeader(cookies) },
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      url = new URL(res.headers.get("location") ?? url, url).href;
      continue;
    }
    return res;
  }
  throw new Error("бесконечные перенаправления (защита от ботов не пропустила)");
}

// Открывает страницу сайта, чтобы получить cookie и код сессии (bitrix_sessid),
// без которого REST-блоки не отвечают.
// Сайт иногда на минуту-другую отдаёт страницу без кода сессии,
// поэтому пробуем несколько раз с паузой.
export async function openSession(path = "/standings/") {
  let problem = "";
  for (let attempt = 1; attempt <= SESSION_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      console.warn(`khl.ru: ${problem}, повторяю через ${SESSION_RETRY_MS / 1000} с (попытка ${attempt} из ${SESSION_ATTEMPTS})`);
      await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
    }
    const cookies = new Map();
    let res;
    try {
      res = await fetchWithCookies(`${SITE}${path}`, cookies, {
        headers: { "Accept-Language": "ru-RU,ru;q=0.9" },
      });
    } catch (err) {
      problem = `не удалось открыть сайт (${err.message})`;
      continue;
    }
    if (!res.ok) {
      problem = `ответ ${res.status} на странице ${path}`;
      continue;
    }
    const html = await res.text();
    const sessid = html.match(/"bitrix_sessid":"([0-9a-f]+)"/)?.[1];
    if (sessid) return { cookies, sessid, referer: `${SITE}${path}` };
    problem = `нет bitrix_sessid на странице ${path}`;
  }
  fail(`${problem} (после ${SESSION_ATTEMPTS} попыток)`);
}

// Запрос к REST-блоку сайта, например "standings/regular" или "game/protocol".
export async function restPost(session, endpoint, fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  form.append("sessid", session.sessid);

  let res;
  try {
    res = await fetchWithCookies(`${SITE}/rest/${endpoint}/`, session.cookies, {
      method: "POST",
      body: form,
      headers: { Referer: session.referer, "X-Requested-With": "XMLHttpRequest" },
    });
  } catch (err) {
    fail(`не удалось получить ${endpoint}: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== "success") {
    fail(`khl.ru не отдал ${endpoint} (код ${res.status}, статус ${body?.status ?? "нет JSON"})`);
  }
  return body.data;
}

// Время по Москве (UTC+3) в формате ISO.
export function moscowNow() {
  const msk = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return msk.toISOString().replace(/\.\d+Z$/, "+03:00");
}

const hasScore = (g) => g.homeScore !== undefined && g.homeScore !== "";

// Статус матча из календаря: идёт, завершён или ещё не начался.
// Сразу после финальной сирены, пока протокол не утверждён, счёт лежит
// не в самом матче, а в g.online со статусом «Завершен».
export function gameStatus(g) {
  if (g.isOnline) return "live";
  if (hasScore(g) || /^заверш/i.test(g.online?.status ?? "")) return "final";
  return "scheduled";
}

// Счёт завершённого матча: { home, away, ots } (ots = "OT" | "SO" | null).
export function gameScore(g) {
  const src = hasScore(g) ? g : (g.online ?? {});
  return {
    home: Number(src.homeScore),
    away: Number(src.visitorScore),
    ots: src.ots || g.ots || null,
  };
}
