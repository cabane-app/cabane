import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedEntityBinding } from "./types";

/** Baseline each mapping before acknowledging fresh runtime activity. */
export function useEntityActivityFeedback(
  entities: readonly Pick<ResolvedEntityBinding, "slotId" | "entityId" | "state" | "issues">[],
) {
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
  return { pulse, clear };
}
