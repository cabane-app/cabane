import { terrainForHedge } from "./hedge-terrain";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import { GROUND_ELEVATION_METERS } from "../ground-elevation";
import { memo } from "react";
import { planPointToWorld } from "../geometry";
import type { FloorSpec } from "../types";
import { HedgeModel } from "./HedgeModel";
import { validHedge } from "./hedge-validity";
import { masonryMiters } from "../boundaries/masonry-miters";

export const ArchitecturalHedges = memo(function ArchitecturalHedges({
  floor,
}: {
  floor: FloorSpec;
}) {
  const surface = useTerrainSurface();
  const scale = floor.coordinates.metersPerPlanUnit;
  const runs = (floor.hedges ?? [])
    .filter((hedge) => validHedge(hedge, scale))
    .map((hedge) => ({ hedge, terrain: terrainForHedge(floor, hedge, surface) }));
  const miters = masonryMiters(runs, scale);
  return (
    <group name="architectural-hedges">
      {runs.map(({ hedge, terrain }) => {
        const [x, z] = planPointToWorld(hedge.from, floor.coordinates);
        const [tx, tz] = planPointToWorld(hedge.to, floor.coordinates);
        const model = (
          <HedgeModel
            terrain={terrain}
            masonryMiters={miters.get(hedge)}
            style={hedge.style}
            length={Math.hypot(tx - x, tz - z)}
            height={hedge.heightMeters}
            width={hedge.widthMeters}
          />
        );
        return (
          <group
            key={hedge.id}
            name={`hedge-${hedge.id}`}
            position={[(x + tx) / 2, GROUND_ELEVATION_METERS, (z + tz) / 2]}
            rotation={[0, -Math.atan2(tz - z, tx - x), 0]}
          >
            {model}
          </group>
        );
      })}
    </group>
  );
});
