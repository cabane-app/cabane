import type { EntityId } from "./types";

export interface EntityStateSnapshot {
  entityId: EntityId;
  state: string;
  attributes: Readonly<Record<string, unknown>>;
  available: boolean;
  stale: boolean;
  /** Transient live feedback from the current HA subscription; never saved. */
  activitySequence?: number;
  lastConfirmedAt?: string;
  lastChanged?: string;
  lastUpdated?: string;
}
