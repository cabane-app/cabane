import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, DynamicDrawUsage, type BufferGeometry } from "three";
import { SceneRoomSelection } from "../building/RoomSelectionSurfaces";
import type { FloorSpec } from "../types";
import { roomSurfaceEmphasis, wallFaceRoomIds } from "./room-surface-emphasis";

export function RoomWallEmphasis({
  geometry,
  floor,
  reducedMotion,
}: {
  geometry: BufferGeometry;
  floor: FloorSpec;
  reducedMotion: boolean;
}) {
  const selectedId = useContext(SceneRoomSelection);
  const { invalidate } = useThree();
  const faces = useMemo(() => wallFaceRoomIds(geometry, floor), [geometry, floor]);
  const base = useMemo(() => Float32Array.from(geometry.getAttribute("color").array), [geometry]);
  const levels = useMemo(() => new Float32Array(faces.length).fill(1), [faces]);
  const changing = useRef(true);
  useLayoutEffect(() => {
    const colors = geometry.getAttribute("color");
    const usage = colors instanceof BufferAttribute ? colors.usage : undefined;
    // These merged walls animate in place; static batches must not bake their colors.
    if (colors instanceof BufferAttribute) colors.setUsage(DynamicDrawUsage);
    return () => {
      colors.array.set(base);
      colors.needsUpdate = true;
      if (colors instanceof BufferAttribute && usage !== undefined) colors.setUsage(usage);
    };
  }, [base, geometry]);
  useEffect(() => {
    changing.current = true;
    invalidate();
  }, [selectedId, reducedMotion, faces, invalidate]);
  useFrame((_state, delta) => {
    if (!changing.current) return;
    const colors = geometry.getAttribute("color");
    const blend = reducedMotion ? 1 : 1 - Math.exp(-12 * delta);
    let settled = true;
    faces.forEach((roomId, index) => {
      const target = roomSurfaceEmphasis(true, selectedId, roomId);
      const value = levels[index] + (target - levels[index]) * blend;
      const next = Math.abs(value - target) < 0.001 ? target : value;
      levels[index] = next;
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
