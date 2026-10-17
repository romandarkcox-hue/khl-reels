import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { Intro } from "./Intro";
import { MatchScene } from "./MatchScene";
import { Outro } from "./Outro";
import { C, fontFamily } from "./shared";
import { Subtitles } from "./Subtitles";
import { Review } from "./types";

export type ReviewVideoProps = {
  review: Review | null;
};

export const ReviewVideo: React.FC<ReviewVideoProps> = ({ review }) => {
  if (!review) {
    return (
      <AbsoluteFill style={{ background: C.bg, color: C.text, fontFamily, fontSize: 48, alignItems: "center", justifyContent: "center" }}>
        Нет данных review.json
      </AbsoluteFill>
    );
  }

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
              <Subtitles text={scene.text} frames={scene.frames} />
              {scene.voice ? <Audio src={staticFile(scene.voice)} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
      {review.music ? <Audio src={staticFile(review.music)} volume={0.12} loop /> : null}
    </AbsoluteFill>
  );
};
