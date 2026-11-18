import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { CountrySky } from "./CountrySky";
import { CountryFields } from "./CountryFields";
import { HedgerowCanopies } from "./HedgerowCanopies";
import { vergeGrasses } from "./country-grasses";
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
  const grasses = useMemo(() => vergeGrasses(frame), [frame]);
  useEffect(() => () => grasses.dispose(), [grasses]);
  return (
    <group name="landscape-countryside" position={[frame.surveyX, frame.y, frame.surveyZ]}>
      {walkMode && <CountrySky daylight={daylight} overcast={overcast} />}
      <CountryFields plot={frame} daylight={daylight} />
      <CountryFields plot={frame} daylight={daylight} distant />
      <HedgerowCanopies
        plot={frame}
        daylight={daylight}
        overcast={overcast}
        wind={walkMode && !reducedMotion}
      />
      <mesh
        name="country-verge-grass"
        geometry={grasses}
        position={[frame.x - frame.surveyX, 0, frame.z - frame.surveyZ]}
        receiveShadow
        raycast={() => {}}
      >
        <meshStandardMaterial vertexColors side={DoubleSide} roughness={1} />
      </mesh>
    </group>
  );
}
