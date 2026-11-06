import { omitUndefinedProperties } from "../defined-properties";
import type { OutdoorPlatformEdgeConfiguration, PlanPoint } from "../types";
import { PlatformGlassRailing } from "./PlatformGlassRailing";
import { PlatformLowWall } from "./PlatformLowWall";
import { PlatformRailing } from "./PlatformRailing";

/** One procedural edge barrier in world coordinates, with floor-relative height. */
export function PlatformBarrierModel({
  from,
  to,
  configuration,
  name,
}: {
  from: PlanPoint;
  to: PlanPoint;
  configuration: OutdoorPlatformEdgeConfiguration;
  name?: string;
}) {
  if (configuration.kind === "open") return null;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const height = configuration.heightMeters;
  return (
    <group
      {...omitUndefinedProperties({ name: name })}
      position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]}
      rotation={[0, -Math.atan2(to[1] - from[1], to[0] - from[0]), 0]}
    >
      {configuration.kind === "low-wall" ? (
        <PlatformLowWall name={name} length={length} height={height} />
      ) : configuration.kind === "glass-railing" ? (
        <PlatformGlassRailing name={name} length={length} height={height} />
      ) : (
        <PlatformRailing name={name} length={length} height={height} />
      )}
    </group>
  );
}
