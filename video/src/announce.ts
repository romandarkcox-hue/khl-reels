// Формат файлов public/announce.json (утренний анонс) и public/results.json
// (вечерние счета). Их пишет scripts/day-cards.mjs.

import { ConferenceId } from "./standings";

export type DayCardKind = "announce" | "results";

export type AnnounceTeam = {
  name: string;
  logo: string | null; // путь внутри public/, например "logos/2.png"
  rank: number | null; // место в таблице своей конференции
  conf: ConferenceId | null;
};

export type MatchScore = {
  home: number;
  away: number;
  ots: "OT" | "SO" | null; // овертайм или буллиты
};

export type AnnounceMatch = {
  time: string; // начало по Москве, "19:30"
  home: AnnounceTeam;
  away: AnnounceTeam;
  score: MatchScore | null; // только у сыгранных матчей
};

export type Announce = {
  date: string; // игровой день, "2026-10-23"
  total: number;
  pages: AnnounceMatch[][]; // по картинке на страницу, не больше 6 матчей на каждой
};

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

// "2026-10-23" -> "пятница"
export const formatWeekday = (isoDay: string): string =>
  WEEKDAYS[new Date(`${isoDay}T12:00:00Z`).getUTCDay()];
