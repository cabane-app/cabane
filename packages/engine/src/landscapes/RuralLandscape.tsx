import { CountrySky } from "./CountrySky";
import { CountryGround } from "./CountryGround";
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
      <CountrySky plot={frame} daylight={daylight} overcast={overcast} orbit={!walkMode} />
      <CountryGround plot={frame} daylight={daylight} wind={walkMode && !reducedMotion} />
    </group>
  );
}
