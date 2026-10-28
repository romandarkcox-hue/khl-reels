# KHL Reels

Проект публикует в **Telegram-канал [@KHLtablitca](https://t.me/KHLtablitca)** («Турнирная таблица КХЛ | сезон 2026/27»; с 2026-10-23, до этого был @KHLtable, его оставили как есть) посты про КХЛ (Континентальная хоккейная лига). Формат утверждён пользователем 2026-10-22 (до этого была пауза с 21.10, а ещё раньше Instagram и Reels):

- **Утро, 7:00 МСК: анонс.** Картинка «Матчи дня»: время начала (МСК), команды с логотипами, место каждой в таблице конференции. Больше 6 матчей → две картинки. Нет матчей → ничего не публикуем. Подпись: список матчей + хэштеги.
- **Вечер, после последнего матча: два отдельных поста** (пользователь 22.10: не смешивать в одном альбоме):
  1. картинка «Итоги дня» со счетами (ОТ/Б) + подпись: по каждому матчу счёт, победитель и короткая фраза из протокола (победный гол/буллит, камбэк, дубль/хет-трик, сухая победа, разгром) + хэштеги. Пользователь просил **не писать очевидное** (вверх/вниз в таблице, лидеры, борьба за 8-е место убраны);
  2. таблицы «Запад» и «Восток» альбомом + короткая подпись «Таблица КХЛ после игрового дня …» (`tablesText`).
  Пост ждёт, пока заполнятся протоколы всех матчей (сразу после сирены протокол на khl.ru пустой, заполняется примерно в течение получаса); к последней проверке ночью выходит как есть.
- Публикуем **сразу, без кнопок одобрения** (выбор пользователя).
- **Те же посты дублируются в группу ВК [vk.ru/khltable](https://vk.ru/khltable)** («Турнирная таблица КХЛ 2026/2027», id 232858456; подключено 2026-10-28): те же картинки и тексты сразу после Telegram, только при публикации в канал. Аватарка и обложка группы: композиции `vk-avatar-a/b`, `vk-cover` (`video/src/BrandCards.tsx`), без логотипа КХЛ.
- Ролик «Итоги дня» и Instagram **больше не делаем** (код Reels не удалён: `make-review.mjs`, `video/src/review/`).

## Код
- `scripts/make-announce.mjs [ДЕНЬ] [--to-me | --no-send]` — утренний анонс. По умолчанию публикует в канал; `--to-me` шлёт в личку пользователю, `--no-send` только рисует.
- `scripts/make-evening.mjs [ДЕНЬ] [--partial] [--to-me | --no-send]` — два вечерних поста. Без `--partial` выходит без публикации, если не все матчи закончились или протоколы не заполнены; после публикации в канал создаёт `video/out/evening-posted`, по нему воркфлоу ставит метку дня. Снимок таблицы `data/history/ДЕНЬ.json` пишется **только при публикации в канал** (пробные запуски его не трогают), под датой игрового дня.
- `scripts/day-cards.mjs` — общий код: матчи дня из календаря (+ голы из протокола при `withGoals`) и рендер картинок `announce-N` / `results-N`. Проверка: `node scripts/day-cards.mjs announce|results [ДЕНЬ]`.
- `scripts/post-text.mjs` — подпись вечернего поста (шаблон; с `ANTHROPIC_API_KEY` пишет Claude). Подпись ≤ 1024 знаков (лимит Telegram), при превышении описания матчей сокращаются; `sendPost` в `send-telegram.mjs` всё равно отправит длинный текст отдельным сообщением.
- `scripts/send-telegram.mjs` — `sendPost(файлы, текст, чат)`: одна картинка или альбом с подписью. Канал — `TELEGRAM_CHANNEL_ID=@KHLtablitca`, личка — `TELEGRAM_CHAT_ID`.
- `scripts/send-vk.mjs` — `sendVkPost(файлы, текст)` на стену группы ВК; `sendVkPostSafe` для утра и вечера: ошибка ВК не роняет запуск, а приходит пользователю в личку Telegram; без `VK_GROUP_TOKEN` ВК пропускается. Нужен только **ключ сообщества** (`VK_GROUP_TOKEN`, не истекает; права: стена, фото, управление). `photos.getWallUploadServer` с ним даёт ошибку 27, поэтому картинки грузятся через `photos.getMessagesUploadServer` + `saveMessagesPhoto` (обязательно с типом файла `image/jpeg|png`, иначе `photo` пустой) и прикрепляются к `wall.post` (`from_group=1`). Читать стену (`wall.getById`) ключ сообщества не может. API `https://api.vk.ru`, v 5.199.
- `scripts/env.mjs` — грузит `.env` **поверх** переменных Windows: у пользователя в Windows задана своя `TELEGRAM_BOT_TOKEN` от другого бота (@alinasokol_bot), из-за неё раньше локальные запуски слали не от того бота. Все скрипты импортируют `./env.mjs`.
- Картинки: `video/src/AnnounceCard.tsx` (анонс и счета, тёмно-синий «вечерний лёд», при 1–2 матчах крупные строки), `video/src/StandingsCard.tsx` (таблицы), палитры таблиц `video/src/themes.ts`, цвета клубов `video/src/clubColors.ts`. Шрифт Manrope. Композиции: `announce-1/2`, `results-1/2`, `west`, `east`.
- `scripts/khl.mjs`: `gameStatus` считает матч завершённым и по `g.online.status = "Завершен"` (сразу после сирены, пока протокол не утверждён, счёт лежит в `g.online`), `gameScore(g)` берёт счёт оттуда же.
- `scripts/review-status.mjs ДЕНЬ` — сколько матчей дня закончилось (для вечернего воркфлоу).

## Расписание (GitHub Actions + cron-job.org)
- `.github/workflows/morning-cards.yml` («Анонс 7:00»): cron `0 4 * * *` = 7:00 МСК → `make-announce.mjs` → метка `data/posted/ДЕНЬ-announce`.
- `.github/workflows/evening-review.yml` («Итоги дня»): каждые 20 мин с 20:30 до 01:10 МСК; игровой день = МСК минус 5 ч; метка `data/posted/ДЕНЬ-evening` → выход; все матчи закончились → `make-evening.mjs`, коммит метки и `data/history/`; после 01:00 МСК публикует с `--partial`. Ручной запуск с полями day / partial / force.
- **Автоматика включена 2026-10-22** (воркфлоу `gh workflow enable`, задания cron-job.org `enabled: true`, секрет `TELEGRAM_CHANNEL_ID`). Сменить канал: бот администратором нового канала, новое значение в `.env` и `gh secret set TELEGRAM_CHANNEL_ID`.. Выключить: `gh workflow disable morning-cards.yml` и `evening-review.yml` + задания на cron-job.org. Имена файлов воркфлоу прежние (раньше там были карусель и Reels).
- **cron-job.org** дублирует запуски через `workflow_dispatch` (расписание GitHub пропускает и опаздывает): «KHL: Анонс 7:00» (раньше «KHL: Карусель 6:45», скрипт находит его по старому имени) и «KHL: Итоги дня» (20–01 ч МСК, минуты 10/30/50). `node scripts/setup-cronjobs.mjs` создаёт/обновляет (ставит `enabled: true`), `--list` показывает статус. Ключи в `.env`: `CRONJOB_API_KEY`, `GH_DISPATCH_TOKEN` (fine-grained, только khl-reels, Actions: Read and write). **Токен истекает 2027-01-16**: заранее напомнить, продлить (Regenerate), заменить в `.env`, перезапустить `setup-cronjobs.mjs`.
- В GitHub Secrets нужны `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_CHANNEL_ID`, `VK_GROUP_TOKEN` (+ `ANTHROPIC_API_KEY`, если появится). Новый ключ в `.env` → загрузить: `gh secret set ИМЯ`.
- Перед ручной работой с `data/` делать `git pull`: бот коммитит в main утром и вечером.
- Стоимость: всё бесплатно (лимит GitHub Actions 2000 мин/мес, расход ~1100–1200).

## Пользователь
- Общается на русском, отвечать по-русски, просто и по шагам.
- Часто диктует голосом, поэтому в тексте бывают оговорки. Понимать по смыслу.
- Windows 11, PowerShell, VS Code на русском. Опыт программирования небольшой: объяснять, что и зачем делаем.
- **Сначала план, действия только после его согласия.** Ничего не запускать и не устанавливать без спроса. Публикации в канал только с согласия (кроме автоматики).

## Источник данных (khl.ru)
- Сначала `GET https://www.khl.ru/standings/` (или `/calendar/`) с браузерным User-Agent. Защита от ботов отвечает 307 и ставит cookie `spid`/`spsc`, после повтора с cookie отдаёт страницу. Из HTML берём `"bitrix_sessid":"..."`. Общий код: `scripts/khl.mjs`.
- Таблица: `POST /rest/standings/regular/` (form-data `values[type]=regular`, `sessid`; заголовки Cookie, Referer, `X-Requested-With: XMLHttpRequest`). Ответ: `data.json.conferences[{item:"west"|"east", rows}]`, по 11 команд, `{"type":"divider"}` = линия плей-офф. Поля: `r`, `name`, `clubid`, `s{gp,w,otw,sow,sol,otl,l,pts,g}`, `live.position{old,new}`.
- Календарь: `POST /rest/calendar/list/` (весь сезон, `GAMES[]` по дням, `TEAMS`, `time_format` по МСК; у утверждённых матчей `homeScore`/`visitorScore`/`ots`, у только что закончившихся счёт в `online`; `isOnline` = идёт). За сезон 1–8 матчей в день (8 — дважды).
- Протокол: `POST /rest/game/protocol/` с `values[tournament]=1436` и `values[gameid]` (голы по периодам; победный буллит = «гол» 4-го периода на 65:00). Разбор: `parseGoals` в `scripts/fetch-games.mjs`.
- Логотипы `video/public/logos/{clubId}.png` (не в Git), img.khl.ru за той же защитой. Логотипы используем по решению пользователя (риск жалобы правообладателя объяснён). Фото игроков не берём.
- Защита khl.ru пускает серверы GitHub Actions.

## Окружение
- Node.js v24.20.0, npm 11.19.0, Git 2.55, GitHub CLI 2.102 (вход как `romandarkcox-hue`). Почта для коммитов: `275739583+romandarkcox-hue@users.noreply.github.com`.
- Репозиторий: https://github.com/romandarkcox-hue/khl-reels (приватный, ветка `main`).
- Remotion 4.0.536 в `video/` (`cd video && npm run dev` — студия). Плагин Remotion для Claude Code установлен.
- Telegram-бот **@khltable_bot** (администратор канала с правом публикации). `.env` (не в Git): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_CHANNEL_ID`, `VK_GROUP_TOKEN`, `CRONJOB_API_KEY`, `GH_DISPATCH_TOKEN`, `YANDEX_*` (для старых Reels).
- **Ключа Claude API нет и не было** (проверено 2026-10-22): все тексты по шаблону. Пользователь выяснял оплату на platform.claude.com (Anthropic официально не обслуживает Россию). Если появится: строка `ANTHROPIC_API_KEY=...` в `.env` и в Secrets; перед подключением посчитать стоимость.

## Старое (не используется)
- Reels «Итоги игрового дня»: `scripts/make-review.mjs`, `review-script.mjs`, `tts-yandex.mjs` (Яндекс SpeechKit, `ermil`/`good`/1.2), музыка в Release `assets`, ветка `subtitles-whisper` (субтитры Whisper, не слита). Метки старых роликов `data/reviews/`, старой карусели `data/cards/`.
- Instagram: нужен был Business/Creator-аккаунт и Graph API. Отказались в пользу Telegram-канала.
