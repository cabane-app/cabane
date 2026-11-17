import { DEFAULT_WALL_COLORS } from "@cabane/engine";
import { useMemo } from "react";
import { openingWorldPlacement } from "@cabane/engine";
import { ToonMaterial } from "@cabane/engine";
import type { PassageSpec } from "@cabane/engine";
import { archedPassageCurve, buildArchedPassageSpandrelShape } from "./arched-passage-spandrel";
import type { OpeningModelProps } from "../opening-model-props";

export function PassageModel({ wall, opening, floor }: OpeningModelProps<PassageSpec>) {
  const placement = openingWorldPlacement(wall, opening, floor.coordinates);
  const { openingHeightMeters, variant } = opening;
  const archRiseMeters = opening.variant === "arched" ? opening.archRiseMeters : 0;
  const arch = useMemo(() => {
    if (variant !== "arched") return null;
    return buildArchedPassageSpandrelShape(
      { openingHeightMeters, archRiseMeters },
      placement.widthMeters,
    );
  }, [openingHeightMeters, variant, archRiseMeters, placement.widthMeters]);

  return (
    <group
      name={`opening-model-${opening.variant}`}
      position={[placement.start[0], opening.sillHeightMeters, placement.start[1]]}
      rotation={[0, placement.rotationY, 0]}
    >
      {arch && (
        <mesh position={[0, 0, -wall.thicknessMeters / 2]} castShadow>
          <extrudeGeometry args={[arch, { depth: wall.thicknessMeters, bevelEnabled: false }]} />
          <ToonMaterial color={DEFAULT_WALL_COLORS.interior} />
        </mesh>
      )}
    </group>
  );
}

PassageModel.wallHeadProfile = (opening: PassageSpec, width: number) =>
  opening.variant === "arched"
    ? archedPassageCurve(opening, width)
        .getPoints()
        .map(({ x, y }) => [x, y] as const)
    : null;
