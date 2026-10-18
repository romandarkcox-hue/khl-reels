import { loadFont as loadEmoji } from "@remotion/google-fonts/NotoColorEmoji";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clubColor } from "../clubColors";
import { Logo } from "./shared";
import { Match, Word } from "./types";

// Субтитры «как в образце»: по 1–2 слова, крупно, заглавными, без плашки.
// Цифры и фамилии салатовые, клубы в своём цвете, над словами значок:
// логотип клуба или эмодзи по смыслу слова.

const { fontFamily: oswald } = loadOswald("normal", { weights: ["700"], subsets: ["cyrillic", "latin"] });
const { fontFamily: emojiFont } = loadEmoji("normal", { subsets: ["emoji"], ignoreTooManyRequestsWarning: true });

const LIME = "#C6FF3D";
const CENTER_Y = 1405; // середина строки: ниже графики сцены, выше подписи Instagram
const FONT_SIZE = 92;
const MAX_PAIR_LETTERS = 12; // два слова вместе, только если оба короткие
const HOLD_MS = 700; // сколько держать последнее слово фразы после того, как оно прозвучало

const EMOJI: [RegExp, string][] = [
  [/^шайб/, "🏒"],
  [/^камбэк/, "🔥"],
  [/^буллит|^победный$/, "🎯"],
  [/^лидер|^1-е$/, "👑"],
  [/^поднима/, "📈"],
  [/^опуска/, "📉"],
  [/^всухую/, "🧤"],
];

type Club = { name: string; logo: string | null; words: string[] };
type Chunk = { words: Word[]; club: Club | null; startMs: number; endMs: number };

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "").replace(/^-+|-+$/g, "");
// Слово для экрана: без точек и тире по краям, двоеточие в счёте остаётся.
const display = (s: string) => s.replace(/\s+[—–-]$/, "").replace(/^[«"(]+|[.,!?;»")]+$/g, "").toUpperCase();
const sentenceEnd = (s: string) => /[.,!?;:—]$/.test(s.trim()) && !/\d:\d+$/.test(s);

// Клуб, название которого начинается со слова i (названия бывают из двух слов: «Ак Барс»).
const clubAt = (words: Word[], i: number, clubs: Club[]): Club | null => {
  for (const club of clubs) {
    const n = club.words.length;
    if (i + n > words.length) continue;
    if (club.words.every((w, k) => norm(words[i + k].text) === w)) return club;
  }
  return null;
};

const makeChunks = (words: Word[], clubs: Club[]): Chunk[] => {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < words.length) {
    const club = clubAt(words, i, clubs);
    let take = club ? club.words.length : 1;
    if (!club && i + 1 < words.length) {
      const a = words[i];
      const b = words[i + 1];
      const short = norm(a.text).length + norm(b.text).length <= MAX_PAIR_LETTERS;
      if (short && !sentenceEnd(a.text) && !clubAt(words, i + 1, clubs)) take = 2;
    }
    const part = words.slice(i, i + take);
    chunks.push({ words: part, club, startMs: part[0].startMs, endMs: part[part.length - 1].endMs });
    i += take;
  }
  chunks.forEach((c, k) => {
    const next = chunks[k + 1];
    c.endMs = next ? Math.min(next.startMs, c.endMs + HOLD_MS) : c.endMs + HOLD_MS;
  });
  return chunks;
};

const emojiFor = (chunk: Chunk): string | null => {
  for (const w of chunk.words) {
    const n = norm(w.text);
    for (const [re, emoji] of EMOJI) if (re.test(n)) return emoji;
  }
  return null;
};

// Цвет клуба осветляем, чтобы тёмно-синий читался на тёмном фоне.
const lighten = (hex: string, amount: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

export const Subtitles: React.FC<{ words: Word[] | null | undefined; matches: Match[] }> = ({ words, matches }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!words?.length) return null;

  const clubs: Club[] = [];
  const surnames = new Set<string>();
  for (const m of matches) {
    for (const team of [m.home, m.away]) {
      if (!clubs.some((c) => c.name === team.name)) {
        clubs.push({ name: team.name, logo: team.logo, words: team.name.split(/\s+/).map(norm) });
      }
    }
    for (const g of m.goals) {
      for (const p of [g.scorer, ...g.assists]) if (p) surnames.add(norm(p.surname));
    }
  }
  // Сначала длинные названия: «Динамо Мн» не должно совпасть как «Динамо М».
  clubs.sort((a, b) => b.words.length - a.words.length || b.name.length - a.name.length);

  const ms = (frame / fps) * 1000;
  const chunk = makeChunks(words, clubs).find((c) => ms >= c.startMs && ms < c.endMs);
  if (!chunk) return null;

  const local = frame - Math.round((chunk.startMs / 1000) * fps);
  const pop = spring({ frame: local, fps, config: { damping: 11, mass: 0.5, stiffness: 180 } });
  const iconPop = spring({ frame: local - 2, fps, config: { damping: 9, mass: 0.5, stiffness: 160 } });
  const emoji = chunk.club ? null : emojiFor(chunk);

  const colorOf = (w: Word) => {
    const n = norm(w.text);
    if (chunk.club) return lighten(clubColor(chunk.club.name), 0.45);
    if (/\d/.test(n) || surnames.has(n)) return LIME;
    return "#FFFFFF";
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        top: CENTER_Y - FONT_SIZE / 2,
        height: FONT_SIZE,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {chunk.club || emoji ? (
        <div
          style={{
            position: "absolute",
            bottom: FONT_SIZE + 6,
            transform: `scale(${iconPop}) rotate(${(1 - iconPop) * -20}deg)`,
          }}
        >
          {chunk.club ? (
            <Logo src={chunk.club.logo} size={85} shadow="0 8px 24px rgba(0,0,0,0.6)" />
          ) : (
            <div style={{ fontFamily: emojiFont, fontSize: 75, lineHeight: 1 }}>{emoji}</div>
          )}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 21,
          fontFamily: oswald,
          fontWeight: 700,
          fontSize: FONT_SIZE,
          lineHeight: 1,
          whiteSpace: "nowrap",
          transform: `scale(${0.7 + 0.3 * pop}) translateY(${(1 - pop) * 30}px)`,
          textShadow: "0 6px 0 rgba(0,0,0,0.55), 0 0 28px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.9)",
        }}
      >
        {chunk.words.map((w, k) => (
          <span key={k} style={{ color: colorOf(w) }}>
            {display(w.text)}
          </span>
        ))}
      </div>
    </div>
  );
};
