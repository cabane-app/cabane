import { CountrySky } from "./CountrySky";
import { CountryGround } from "./CountryGround";
import { HedgerowCanopies } from "./HedgerowCanopies";
import type { FieldPlot } from "./country-survey";

export function Countryside({
  frame,
  walkMode,
  daylight,
  overcast,
  reducedMotion,
}: {
  frame: FieldPlot;
  walkMode: boolean;
  daylight: number;
  overcast: number;
  reducedMotion: boolean;
}) {
  return (
    <group name="landscape-countryside" position={[frame.surveyX, frame.y, frame.surveyZ]}>
      {walkMode && <CountrySky daylight={daylight} overcast={overcast} />}
      <CountryGround plot={frame} daylight={daylight} />
      <CountryGround plot={frame} daylight={daylight} distant />
      <HedgerowCanopies
        plot={frame}
        daylight={daylight}
        overcast={overcast}
        wind={walkMode && !reducedMotion}
      />
    </group>
  );
}
