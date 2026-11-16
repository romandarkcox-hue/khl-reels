// Канал прогнозов публикует свой бот (@khl_hitrate_bot) в свой канал (@prognozykkhl).
// send-telegram.mjs берёт TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID, поэтому
// подменяем их до его загрузки: этот модуль импортировать раньше send-telegram.mjs.
import "./env.mjs";

if (!process.env.HITRATE_BOT_TOKEN) {
  console.error("Ошибка: не задан HITRATE_BOT_TOKEN (в .env или в Secrets)");
  process.exit(1);
}
process.env.TELEGRAM_BOT_TOKEN = process.env.HITRATE_BOT_TOKEN;
process.env.TELEGRAM_CHANNEL_ID = process.env.HITRATE_CHANNEL_ID || "@prognozykkhl";
