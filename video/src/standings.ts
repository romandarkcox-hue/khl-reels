// Формат файла public/standings.json (его пишет scripts/fetch-standings.mjs).

export type Team = {
  rank: number;
  name: string;
  clubId: number;
  logo: string | null; // путь внутри public/, например "logos/2.png"
  gp: number;
  w: number;
  otw: number;
  sow: number;
  otl: number;
  sol: number;
  l: number;
  pts: number;
  goalsFor: number;
  goalsAgainst: number;
  inPlayoffZone: boolean;
  prevRank: number;
};

export type ConferenceId = "west" | "east";

export type Conference = {
  id: ConferenceId;
  name: string;
  teams: Team[];
};

export type Standings = {
  fetchedAt: string;
  conferences: Conference[];
};

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

// "2026-10-18T07:00:00+03:00" -> "18 октября"
export const formatDay = (iso: string): string => {
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
};

// Сезон КХЛ начинается осенью: октябрь 2026 -> "2026/27".
export const formatSeason = (iso: string): string => {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  const start = month >= 7 ? year : year - 1;
  return `${start}/${String(start + 1).slice(2)}`;
};
