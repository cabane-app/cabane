import { useCallback, useEffect, useRef, useState } from "react";
import { SceneActivityPulse } from "./SceneActivityPulse";
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
  const previous = useRef(new Map<string, { entityId: string; sequence?: number }>());
  const [pulse, setPulse] = useState(0);
  const clear = useCallback(() => setPulse(0), []);
  useEffect(() => {
    const next = new Map<string, { entityId: string; sequence?: number }>();
    let activity = 0;
    for (const binding of entities) {
      const sequence = binding.state?.activitySequence;
      const before = previous.current.get(binding.slotId);
      if (
        before?.entityId === binding.entityId &&
        sequence !== undefined &&
        sequence !== before.sequence &&
        binding.state?.available &&
        !binding.state.stale &&
        !binding.issues.some((issue) => issue.severity === "error")
      )
        activity = Math.max(activity, sequence);
      next.set(binding.slotId, {
        entityId: binding.entityId,
        ...(sequence === undefined ? {} : { sequence }),
      });
    }
    previous.current = next;
    if (activity) setPulse(activity);
  }, [entities]);
  if (!pulse) return null;
  return (
    <group
      name="scene-item-activity-feedback"
      position={[
        (bounds.min[0] + bounds.max[0]) / 2,
        (bounds.min[1] + bounds.max[1]) / 2,
        bounds.max[2] + 0.035,
      ]}
      userData={{ walkToolVisual: true }}
    >
      <SceneActivityPulse key={pulse} reducedMotion={reducedMotion} onComplete={clear} />
    </group>
  );
}
