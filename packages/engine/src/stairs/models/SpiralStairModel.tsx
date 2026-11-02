import type { FloorCoordinates } from "../../types";
import { planPointToWorld } from "../../geometry";
import { ToonMaterial } from "../../rendering";
import type { StairFlight } from "../flight-geometry";
import { SPIRAL_CORE_RADIUS_METERS } from "../spiral-geometry";
import { StairPolygonSurface } from "./StairPolygonSurface";
import { ShapedStairGuards } from "./ShapedStairGuards";
import { MasonryStairTreads } from "./MasonryStairTreads";
export function SpiralStairModel({
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
      <StairPolygonSurface
        polygon={flight.upperLanding.map((p) => planPointToWorld(p, coordinates))}
        elevation={flight.riseMeters}
        color={
          flight.style === "concrete" ? "#b7b8b1" : flight.style === "stone" ? "#d1c5ae" : "#cbb99a"
        }
      />
      <mesh
        position={[flight.originWorld[0], (flight.riseMeters + 1) / 2, flight.originWorld[1]]}
        castShadow
      >
        <cylinderGeometry
          args={[SPIRAL_CORE_RADIUS_METERS, SPIRAL_CORE_RADIUS_METERS, flight.riseMeters + 1, 16]}
        />
        <ToonMaterial color="#736c61" />
      </mesh>
      <ShapedStairGuards flight={flight} coordinates={coordinates} />
      {showUpperGuard && <ShapedStairGuards flight={flight} coordinates={coordinates} upper />}
    </group>
  );
}
