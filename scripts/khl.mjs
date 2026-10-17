// Общие запросы к khl.ru: обход защиты от ботов, сессия и REST-блоки сайта.

export const SITE = "https://www.khl.ru";
export const TOURNAMENT = 1436; // регулярный чемпионат 2026/27
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

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
export async function openSession(path = "/standings/") {
  const cookies = new Map();
  let res;
  try {
    res = await fetchWithCookies(`${SITE}${path}`, cookies, {
      headers: { "Accept-Language": "ru-RU,ru;q=0.9" },
    });
  } catch (err) {
    fail(`не удалось открыть khl.ru: ${err.message}`);
  }
  if (!res.ok) fail(`khl.ru ответил ${res.status} на странице ${path}`);
  const html = await res.text();
  const sessid = html.match(/"bitrix_sessid":"([0-9a-f]+)"/)?.[1];
  if (!sessid) fail(`не нашёл bitrix_sessid на странице ${path}`);
  return { cookies, sessid, referer: `${SITE}${path}` };
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
