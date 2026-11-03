import type { EntityId } from "./types";

export interface EntityStateSnapshot {
  entityId: EntityId;
  state: string;
  attributes: Readonly<Record<string, unknown>>;
  available: boolean;
  stale: boolean;
  lastConfirmedAt?: string;
  lastChanged?: string;
  lastUpdated?: string;
}
