import { useMemo } from "react";
import { Vector3 } from "three";
import { Html } from "@react-three/drei";
import { ComicPew } from "./comic-pew/ComicPew";
import { useEntityActivityFeedback } from "./useEntityActivityFeedback";
import type { DeviceModelDefinition, ResolvedEntityBinding } from "./types";

/** Binding-local feedback: mounting, remapping or copying a device establishes a baseline. */
export function SceneItemActivityFeedback({
  entities,
  bounds,
  reducedMotion,
}: {
  entities: readonly Pick<ResolvedEntityBinding, "slotId" | "entityId" | "state" | "issues">[];
  bounds: DeviceModelDefinition["bounds"];
  reducedMotion: boolean;
}) {
  const projected = useMemo(() => new Vector3(), []);
  const { pulse, clear } = useEntityActivityFeedback(entities);
  if (!pulse) return null;
  return (
    <group
      name="scene-item-activity-feedback"
      position={[
        (bounds.min[0] + bounds.max[0]) / 2,
        bounds.max[1] + 0.08,
        (bounds.min[2] + bounds.max[2]) / 2,
      ]}
      userData={{ walkToolVisual: true }}
    >
      <Html
        zIndexRange={[9, 0]}
        pointerEvents="none"
        calculatePosition={(object, camera, size) => {
          projected.setFromMatrixPosition(object.matrixWorld).project(camera);
          return [
            Math.max(90, Math.min(size.width - 90, ((projected.x + 1) * size.width) / 2)),
            Math.max(110, Math.min(size.height - 20, ((1 - projected.y) * size.height) / 2)),
          ];
        }}
      >
        <ComicPew word="ZAP!" shotId={pulse} reducedMotion={reducedMotion} onComplete={clear} />
      </Html>
    </group>
  );
}
