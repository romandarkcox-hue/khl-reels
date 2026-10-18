import React from "react";
import { AbsoluteFill, Audio, interpolate, Series, staticFile } from "remotion";
import { Intro } from "./Intro";
import { MatchScene } from "./MatchScene";
import { Outro } from "./Outro";
import { C, fontFamily } from "./shared";
import { Subtitles } from "./Subtitles";
import { Review } from "./types";

// Громкость фоновой музыки (1 = как в файле). Трек громкий (около −11 дБ),
// голос около −17 дБ, поэтому под голосом музыку сильно приглушаем.
const MUSIC_UNDER_VOICE = 0.09;
const MUSIC_IN_PAUSES = 0.25;
const DUCK_RAMP = 8; // кадров на плавное приглушение и возврат
const FADE_IN = 15;
const FADE_OUT = 45;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type ReviewVideoProps = {
  review: Review | null;
};

// Отрезки, где звучит голос: [начало, конец) в кадрах всего ролика.
const voiceSegments = (review: Review): [number, number][] => {
  const segments: [number, number][] = [];
  let start = 0;
  for (const scene of review.scenes) {
    if (scene.voice && scene.voiceFrames) segments.push([start, start + scene.voiceFrames]);
    start += scene.frames;
  }
  return segments;
};

const musicVolume = (frame: number, total: number, segments: [number, number][]) => {
  let duck = 0;
  for (const [s, e] of segments) {
    if (frame >= s - DUCK_RAMP && frame <= e + DUCK_RAMP) {
      duck = Math.max(duck, interpolate(frame, [s - DUCK_RAMP, s, e, e + DUCK_RAMP], [0, 1, 1, 0], clamp));
    }
  }
  const level = MUSIC_IN_PAUSES + (MUSIC_UNDER_VOICE - MUSIC_IN_PAUSES) * duck;
  const fadeIn = interpolate(frame, [0, FADE_IN], [0, 1], clamp);
  const fadeOut = interpolate(frame, [total - FADE_OUT, total], [1, 0], clamp);
  return level * fadeIn * fadeOut;
};

export const ReviewVideo: React.FC<ReviewVideoProps> = ({ review }) => {
  if (!review) {
    return (
      <AbsoluteFill style={{ background: C.bg, color: C.text, fontFamily, fontSize: 48, alignItems: "center", justifyContent: "center" }}>
        Нет данных review.json
      </AbsoluteFill>
    );
  }

  const total = review.scenes.reduce((sum, s) => sum + s.frames, 0);
  const segments = voiceSegments(review);

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily }}>
      <Series>
        {review.scenes.map((scene) => {
          const match = review.matches.find((m) => m.id === scene.matchId);
          return (
            <Series.Sequence key={scene.id} durationInFrames={scene.frames}>
              {scene.type === "intro" ? <Intro review={review} /> : null}
              {scene.type === "match" && match ? <MatchScene match={match} frames={scene.frames} /> : null}
              {scene.type === "outro" ? <Outro /> : null}
              <Subtitles words={scene.words} matches={review.matches} />
              {scene.voice ? <Audio src={staticFile(scene.voice)} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
      {review.music ? (
        <Audio src={staticFile(review.music)} loop volume={(f) => musicVolume(f, total, segments)} />
      ) : null}
    </AbsoluteFill>
  );
};
