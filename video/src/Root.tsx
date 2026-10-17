import { CalculateMetadataFunction, Composition, Still, staticFile } from "remotion";
import { ReviewVideo, ReviewVideoProps } from "./review/ReviewVideo";
import { FPS, HEIGHT as REEL_HEIGHT, WIDTH as REEL_WIDTH } from "./review/shared";
import { Review } from "./review/types";
import { StandingsCard, StandingsCardProps } from "./StandingsCard";
import { Standings } from "./standings";

// Картинки для карусели Instagram: 4:5.
const WIDTH = 1080;
const HEIGHT = 1350;

// Свежая таблица подгружается из public/standings.json перед рендером.
const loadStandings: CalculateMetadataFunction<StandingsCardProps> = async ({
  props,
}) => {
  const res = await fetch(staticFile("standings.json"));
  if (!res.ok) {
    throw new Error(
      "Нет public/standings.json. Сначала запустите node scripts/fetch-standings.mjs",
    );
  }
  const standings = (await res.json()) as Standings;
  return { props: { ...props, standings } };
};

// Reels «Итоги игрового дня»: длительность = сумма длительностей сцен из public/review.json.
const loadReview: CalculateMetadataFunction<ReviewVideoProps> = async ({ props }) => {
  const res = await fetch(staticFile("review.json"));
  if (!res.ok) {
    throw new Error("Нет public/review.json. Сначала запустите node scripts/make-review.mjs");
  }
  const review = (await res.json()) as Review;
  const durationInFrames = Math.max(
    1,
    review.scenes.reduce((sum, s) => sum + s.frames, 0),
  );
  return { props: { ...props, review }, durationInFrames };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="review"
        component={ReviewVideo}
        width={REEL_WIDTH}
        height={REEL_HEIGHT}
        fps={FPS}
        durationInFrames={1}
        defaultProps={{ review: null }}
        calculateMetadata={loadReview}
      />
      <Still
        id="west"
        component={StandingsCard}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ conferenceId: "west", standings: null }}
        calculateMetadata={loadStandings}
      />
      <Still
        id="east"
        component={StandingsCard}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ conferenceId: "east", standings: null }}
        calculateMetadata={loadStandings}
      />
    </>
  );
};
