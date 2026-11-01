import { type HassEntities } from "home-assistant-js-websocket";

import type { EntityId, EntityStateSnapshot } from "./types";

export const normalizeEntityStates = (
  entities: HassEntities,
  stale = false,
): Readonly<Record<EntityId, EntityStateSnapshot>> =>
  Object.fromEntries(
    Object.values(entities).map((entity) => [
      entity.entity_id,
      {
        entityId: entity.entity_id as EntityId,
        state: entity.state,
        attributes: entity.attributes,
        available:
          entity.state !== "unavailable" &&
          (entity.state !== "unknown" || entity.entity_id.startsWith("event.")),
        stale,
        lastConfirmedAt: entity.last_updated,
        lastChanged: entity.last_changed,
        lastUpdated: entity.last_updated,
      },
    ]),
  );

export const markEntityStatesStale = (states: Readonly<Record<EntityId, EntityStateSnapshot>>) =>
  Object.fromEntries(
    Object.entries(states).map(([entityId, state]) => [entityId, { ...state, stale: true }]),
  ) as Readonly<Record<EntityId, EntityStateSnapshot>>;
