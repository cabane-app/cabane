import type { EntityId, EntityStateSnapshot } from "./types";

type States = Readonly<Record<EntityId, EntityStateSnapshot>>;
const usable = (state: EntityStateSnapshot) =>
  !state.stale && state.state !== "unavailable" && state.attributes.restored !== true;

/** Observe the existing HA state stream, never command success or restored history. */
export class HomeAssistantActivityTracker {
  private previous: States | undefined;
  private baselineAt = 0;
  private sequence = 0;
  private latest = new Map<EntityId, number>();
  private signals = new Map<EntityId, number>();

  reset() {
    this.previous = undefined;
    this.signals.clear();
    this.latest.clear();
  }

  update(states: States, now = Date.now()): States {
    const previous = this.previous;
    this.previous = states;
    if (!previous) this.baselineAt = now;
    const next: Record<EntityId, EntityStateSnapshot> = {};
    for (const state of Object.values(states)) {
      const before = previous?.[state.entityId];
      const domain = state.entityId.split(".")[0];
      const timestamp = Date.parse(
        domain === "event" || domain === "button" ? state.state : (state.lastChanged ?? ""),
      );
      const previousTime = this.latest.get(state.entityId);
      if (before && usable(before) && usable(state) && state.available) {
        let changed = false;
        if (domain === "event" || domain === "button") {
          changed =
            Number.isFinite(timestamp) &&
            timestamp >= this.baselineAt &&
            (previousTime !== undefined ? timestamp > previousTime : before.state === "unknown");
        } else if (domain === "light" || domain === "switch" || domain === "input_boolean") {
          changed =
            before.available &&
            ["on", "off"].includes(before.state) &&
            ["on", "off"].includes(state.state) &&
            state.state !== before.state &&
            Number.isFinite(timestamp) &&
            timestamp >= this.baselineAt &&
            (previousTime === undefined || timestamp > previousTime);
        }
        if (changed) this.signals.set(state.entityId, ++this.sequence);
      }
      if (Number.isFinite(timestamp) && (previousTime === undefined || timestamp > previousTime))
        this.latest.set(state.entityId, timestamp);
      const activitySequence = this.signals.get(state.entityId);
      const { activitySequence: _previousSignal, ...snapshot } = state;
      next[state.entityId] =
        activitySequence === undefined ? snapshot : { ...snapshot, activitySequence };
    }
    for (const entityId of this.latest.keys()) {
      if (!states[entityId]) {
        this.latest.delete(entityId);
        this.signals.delete(entityId);
      }
    }
    return next;
  }
}
