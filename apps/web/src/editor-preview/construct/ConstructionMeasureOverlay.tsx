import { formatLength, useMeasurementUnits } from "@cabane/engine";
import { Html } from "@react-three/drei";
import { ToonMaterial as LitMaterial } from "@cabane/engine";
import { noPlanRaycast, PlanOverlayMaterial } from "./PlanDrawing";
import { ConstructionDistanceLabel } from "./ConstructionDistanceLabel";
import { ConstructionPointMarker } from "./ConstructionPointMarker";
import type { ConstructMeasurement } from "./measure-geometry";
import { constructMeasurementIsVisible } from "./measure-geometry";

export interface ConstructionMeasureOverlayProps {
  readonly planMode?: boolean;
  readonly measurement: ConstructMeasurement | null;
  readonly preview?: boolean;
  readonly showLabel?: boolean;
  readonly onCopy?: (value: string) => void;
}

export function ConstructionMeasureOverlay({
  planMode = false,
  measurement,
  preview = false,
  showLabel = true,
  onCopy,
}: ConstructionMeasureOverlayProps) {
  const units = useMeasurementUnits();
  const ToonMaterial = planMode ? PlanOverlayMaterial : LitMaterial;
  if (!measurement || !constructMeasurementIsVisible(measurement)) return null;

  return (
    <group
      name="construction-measure-guide"
      position={[measurement.world.center[0], 0.11, measurement.world.center[1]]}
      rotation={[0, measurement.world.rotationYRadians, 0]}
      userData={{
        distancePlanUnits: measurement.distancePlanUnits,
        distanceMeters: measurement.distanceMeters,
        label: measurement.label,
        preview,
      }}
    >
      <mesh name="construction-measure-guide-line" renderOrder={29} raycast={noPlanRaycast}>
        <boxGeometry args={[measurement.world.lengthMeters, 0.018, 0.025]} />
        <ToonMaterial
          color="#ff754d"
          transparent
          opacity={preview ? 0.72 : 0.96}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <ConstructionPointMarker
          key={side}
          position={[(side * measurement.world.lengthMeters) / 2, 0, 0]}
          planMode={planMode}
        />
      ))}
      {showLabel && (
        <Html
          position={[0, 0.14, 0]}
          center
          zIndexRange={[12, 0]}
          pointerEvents={onCopy ? "auto" : "none"}
        >
          <ConstructionDistanceLabel
            label={`${measurement.planUnitsLabel} · ${formatLength(measurement.distanceMeters, units)}`}
            copyText={`${measurement.planUnitsLabel} · ${formatLength(measurement.distanceMeters, units)}`}
            onCopy={onCopy}
          />
        </Html>
      )}
    </group>
  );
}
