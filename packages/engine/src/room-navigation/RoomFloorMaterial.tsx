import { useEffect, useMemo, useRef, useCallback, type ComponentProps } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, type MeshStandardMaterial, type MeshToonMaterial } from "three";
import { ArchitecturalMaterial } from "../architecture-scene/ArchitecturalMaterial";

export function RoomFloorMaterial({
  emphasis,
  reducedMotion,
  color,
  ...props
}: Omit<ComponentProps<typeof ArchitecturalMaterial>, "color" | "ref"> & {
  color: string;
  emphasis: number;
  reducedMotion: boolean;
}) {
  const material = useRef<MeshToonMaterial | MeshStandardMaterial>(null);
  const setMaterial = useCallback((value: MeshToonMaterial | MeshStandardMaterial | null) => {
    material.current = value;
  }, []);
  const base = useMemo(() => new Color(color), [color]);
  const level = useRef(emphasis);
  const { invalidate } = useThree();
  useEffect(() => invalidate(), [emphasis, color, reducedMotion, invalidate]);
  useFrame((_state, delta) => {
    if (!material.current) return;
    const next = reducedMotion
      ? emphasis
      : level.current + (emphasis - level.current) * (1 - Math.exp(-12 * delta));
    level.current = Math.abs(next - emphasis) < 0.001 ? emphasis : next;
    material.current.color.copy(base).multiplyScalar(level.current);
    if (level.current !== emphasis) invalidate();
  });
  return (
    <ArchitecturalMaterial
      {...props}
      ref={setMaterial}
      color={base.clone().multiplyScalar(emphasis)}
    />
  );
}
