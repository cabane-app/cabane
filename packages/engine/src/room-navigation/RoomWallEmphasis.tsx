import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, DynamicDrawUsage, type BufferGeometry } from "three";
import { SceneRoomSelection } from "../building/RoomSelectionSurfaces";
import type { FloorSpec } from "../types";
import { roomSurfaceEmphasis, wallFaceRoomIds } from "./room-surface-emphasis";

export function RoomWallEmphasis({
  geometry,
  floor,
  enabled,
  reducedMotion,
}: {
  geometry: BufferGeometry;
  floor: FloorSpec;
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const selectedId = useContext(SceneRoomSelection);
  const { invalidate } = useThree();
  const faces = useMemo(() => wallFaceRoomIds(geometry, floor), [geometry, floor]);
  const base = useMemo(() => Float32Array.from(geometry.getAttribute("color").array), [geometry]);
  const levels = useRef(new Float32Array(faces.length).fill(1));
  const changing = useRef(true);
  useLayoutEffect(() => {
    const colors = geometry.getAttribute("color");
    const usage = colors instanceof BufferAttribute ? colors.usage : undefined;
    // These merged walls animate in place; static batches must not bake their colors.
    if (colors instanceof BufferAttribute) colors.setUsage(DynamicDrawUsage);
    levels.current = new Float32Array(faces.length).fill(1);
    return () => {
      colors.array.set(base);
      colors.needsUpdate = true;
      if (colors instanceof BufferAttribute && usage !== undefined) colors.setUsage(usage);
    };
  }, [base, faces, geometry]);
  useEffect(() => {
    changing.current = true;
    invalidate();
  }, [enabled, selectedId, reducedMotion, faces, invalidate]);
  useFrame((_state, delta) => {
    if (!changing.current) return;
    const colors = geometry.getAttribute("color");
    let settled = true;
    faces.forEach((roomId, index) => {
      const target = roomSurfaceEmphasis(enabled, selectedId, roomId);
      const value = reducedMotion
        ? target
        : levels.current[index] + (target - levels.current[index]) * (1 - Math.exp(-12 * delta));
      const next = Math.abs(value - target) < 0.001 ? target : value;
      levels.current[index] = next;
      colors.setXYZ(
        index,
        base[index * 3] * next,
        base[index * 3 + 1] * next,
        base[index * 3 + 2] * next,
      );
      if (next !== target) settled = false;
    });
    colors.needsUpdate = true;
    changing.current = !settled;
    if (!settled) invalidate();
  });
  return null;
}
