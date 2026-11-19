import { ToonMaterial, useOakVeneer } from "@cabane/engine";
import type { BufferGeometry } from "three";

export function OakVeneerMaterial({ color }: { color: string }) {
  const grain = useOakVeneer();
  return <ToonMaterial key={grain ? "veneer" : "solid"} color={color} map={grain ?? null} />;
}

export type GrainAxis = "x" | "y" | "z";

/** Project the scan in metres along the board. Each panel samples its own cut of veneer. */
export function projectOakGrain(geometry: BufferGeometry, axis: GrainAxis, offset: number) {
  const { position, normal, uv } = geometry.attributes;
  const along = { x: 0, y: 1, z: 2 }[axis];
  const a = (along + 1) % 3;
  const b = (along + 2) % 3;
  for (let i = 0; i < position.count; i++) {
    const na = Math.abs(normal.getComponent(i, a));
    const nb = Math.abs(normal.getComponent(i, b));
    const endFace = Math.abs(normal.getComponent(i, along)) > Math.max(na, nb);
    const across = !endFace && na > nb ? b : a;
    uv.setXY(
      i,
      (position.getComponent(i, across) + offset) / 0.86,
      position.getComponent(i, endFace ? b : along) / 1.86,
    );
  }
  uv.needsUpdate = true;
}
