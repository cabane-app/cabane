import type { EntityId, EntityStateSnapshot } from "../../types";

export function demoRoomSensor(roomId: string, deviceClass?: string) {
  if (deviceClass !== "temperature" && deviceClass !== "humidity" && deviceClass !== "aqi")
    return null;
  let seed = 0;
  for (const character of roomId) seed = (Math.imul(31, seed) + character.charCodeAt(0)) >>> 0;
  const phase = (seed % 41) * 0.79;
  return (night: boolean, minute: number) => {
    const drift = Math.sin(phase + minute * 0.19);
    if (deviceClass === "temperature")
      return (20.6 + (seed % 29) / 10 + drift * 0.5 - (night ? 1.1 : 0)).toFixed(1);
    if (deviceClass === "humidity")
      return String(Math.round(41 + (seed % 13) + drift * 2 + (night ? 3 : 0)));
    return String(Math.round(19 + (seed % 24) + 5 * Math.sin(phase + minute * 0.28)));
  };
}

export type DemoRoomSensor = {
  entityId: EntityId;
  reading: (night: boolean, minute: number) => string;
};

export function sampleDemoRoomSensors(
  states: Readonly<Record<EntityId, EntityStateSnapshot>>,
  sensors: DemoRoomSensor[],
  night: boolean,
  minute: number,
) {
  const changes: Record<EntityId, EntityStateSnapshot> = {};
  for (const { entityId, reading } of sensors) {
    const previous = states[entityId];
    const state = reading(night, minute);
    if (previous && previous.state !== state) changes[entityId] = { ...previous, state };
  }
  return Object.keys(changes).length ? { ...states, ...changes } : states;
}
