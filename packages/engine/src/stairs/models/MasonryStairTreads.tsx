import type { StairFlight } from "../flight-geometry";
import { StairPolygonSurface } from "./StairPolygonSurface";

/** Closed risers and a solid base share the exact walking tread footprints. */
export function MasonryStairTreads({ flight }: { flight: StairFlight }) {
  const stone = flight.style === "stone";
  return flight.treads.map((tread, index) => (
    <group key={index} name={`stair-masonry-tread-${index}`}>
      <StairPolygonSurface
        polygon={tread.polygon}
        elevation={tread.elevation - (stone ? 0.045 : 0)}
        thickness={tread.elevation + 0.06 - (stone ? 0.045 : 0)}
        color={stone ? "#9d9280" : "#b7b8b1"}
      />
      {stone && (
        <StairPolygonSurface
          polygon={tread.polygon}
          elevation={tread.elevation}
          thickness={0.045}
          color="#d1c5ae"
        />
      )}
    </group>
  ));
}
