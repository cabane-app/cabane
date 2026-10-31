import type { FloorCoordinates } from "../../types";
import type { StairFlight } from "../flight-geometry";
import { StairPolygonSurface } from "./StairPolygonSurface";
import { ShapedStairGuards } from "./ShapedStairGuards";
import { MasonryStairTreads } from "./MasonryStairTreads";
export function UShapedStairModel({
  flight,
  coordinates,
  showUpperGuard = true,
}: {
  flight: StairFlight;
  coordinates: FloorCoordinates;
  showUpperGuard?: boolean;
}) {
  return (
    <group name={`stair-${flight.id}`} position={[0, flight.baseElevationMeters, 0]}>
      {flight.style && flight.style !== "open" ? (
        <MasonryStairTreads flight={flight} />
      ) : (
        flight.treads.map((t, i) => (
          <StairPolygonSurface key={i} polygon={t.polygon} elevation={t.elevation} />
        ))
      )}
      <ShapedStairGuards flight={flight} coordinates={coordinates} />
      {showUpperGuard && <ShapedStairGuards flight={flight} coordinates={coordinates} upper />}
    </group>
  );
}
