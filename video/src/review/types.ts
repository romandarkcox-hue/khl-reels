// Формат public/review.json (его собирает scripts/make-review.mjs).

export type Player = {
  name: string;
  surname: string;
  seasonGoals: number | null;
};

export type Goal = {
  period: number;
  time: string;
  side: "home" | "away";
  score: string;
  scorer: Player | null;
  assists: Player[];
  strength: "pp" | "sh" | "en" | null;
  shootout: boolean;
};

export type MatchTeam = {
  clubId: number;
  name: string;
  logo: string | null;
  score: number;
  conf: "west" | "east" | null;
  rank: number | null;
  prevRank: number | null;
  pts: number | null;
};

export type Match = {
  id: number;
  time: string;
  ots: "OT" | "SO" | null;
  periods: string[];
  home: MatchTeam;
  away: MatchTeam;
  goals: Goal[];
};

export type Scene = {
  id: string;
  type: "intro" | "match" | "outro";
  matchId?: number;
  text: string;
  voice: string | null; // путь внутри public/
  frames: number;
};

export type Review = {
  date: string;
  matches: Match[];
  scenes: Scene[];
  music: string | null; // путь внутри public/
};
