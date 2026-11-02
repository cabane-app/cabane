import { openingWorldPlacement } from "../geometry";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import { ToonMaterial } from "../rendering";
import type { FloorSpec, OpeningSpec, WallSpec } from "../types";

// A small stone lip keeps the top and sides clear of a supporting storey's facade.
const THRESHOLD_LIP_METERS = 0.002;

/** Support floor-level exterior openings across the drop to outdoor terrain. */
export function OpeningThreshold({
  wall,
  opening,
  floor,
}: {
  wall: WallSpec;
  opening: OpeningSpec;
  floor: FloorSpec;
}) {
  if (
    wall.classification !== "exterior" ||
    opening.kind === "window" ||
    opening.sillHeightMeters !== 0
  )
    return null;
  const placement = openingWorldPlacement(wall, opening, floor.coordinates);
  return (
    <mesh
      name={`opening-threshold-${opening.id}`}
      position={[
        placement.center[0],
        (GROUND_ELEVATION_METERS + THRESHOLD_LIP_METERS) / 2,
        placement.center[1],
      ]}
      rotation={[0, placement.rotationY, 0]}
      receiveShadow
      castShadow
    >
      <boxGeometry
        args={[
          placement.widthMeters + THRESHOLD_LIP_METERS * 2,
          -GROUND_ELEVATION_METERS + THRESHOLD_LIP_METERS,
          wall.thicknessMeters + THRESHOLD_LIP_METERS * 2,
        ]}
      />
      <ToonMaterial color="#d7d1c5" />
    </mesh>
  );
}
