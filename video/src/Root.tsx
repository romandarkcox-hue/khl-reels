import { CalculateMetadataFunction, Still, staticFile } from "remotion";
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

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
