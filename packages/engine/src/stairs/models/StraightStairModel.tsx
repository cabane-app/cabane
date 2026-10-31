import type { StairFlight } from "../flight-geometry";
import { StairTreads } from "./StairTreads";
import { ShapedStairGuards } from "./ShapedStairGuards";
import { MasonryStairTreads } from "./MasonryStairTreads";
export function StraightStairModel({
  flight,
  plan = false,
  showUpperGuard = true,
}: {
  flight: StairFlight;
  plan?: boolean;
  showUpperGuard?: boolean;
}) {
  return (
    <group
      name={`stair-${flight.id}`}
      position={[0, plan ? 0 : flight.baseElevationMeters, 0]}
      scale={[1, plan ? 0.001 : 1, 1]}
    >
      {flight.style && flight.style !== "open" ? (
        <MasonryStairTreads flight={flight} />
      ) : (
        <group
          position={[flight.startWorld[0], 0, flight.startWorld[1]]}
          rotation={[0, flight.rotationYRadians, 0]}
        >
          <StairTreads flight={flight} />
        </group>
      )}
      <ShapedStairGuards flight={flight} coordinates={flight.coordinates} />
      {!plan && showUpperGuard && (
        <ShapedStairGuards flight={flight} coordinates={flight.coordinates} upper />
      )}
    </group>
  );
}
