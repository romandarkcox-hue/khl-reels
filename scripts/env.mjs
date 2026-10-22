// Загружает ключи из .env в корне проекта.
//
// Значения из .env главнее переменных Windows: в системе может быть свой
// TELEGRAM_BOT_TOKEN от другого проекта, а process.loadEnvFile такие не перезаписывает.
// На GitHub Actions файла .env нет, там значения придут из секретов.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) Object.assign(process.env, parseEnv(readFileSync(envPath, "utf8")));
