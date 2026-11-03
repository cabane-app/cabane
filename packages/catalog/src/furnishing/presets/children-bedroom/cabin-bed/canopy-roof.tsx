import { ToonMaterial } from "@cabane/engine";
import { BLUSH, BLUSH_LIGHT } from "./cabin-bed-finish";

export function CanopyRoof({
  side,
  roofAngle,
  roofBeamLength,
  color,
}: {
  readonly color?: string | undefined;
  readonly side: -1 | 1;
  readonly roofAngle: number;
  readonly roofBeamLength: number;
}) {
  return (
    <group>
      {Array.from({ length: 9 }, (_, index) => {
        const z = -1.02 + index * 0.255;
        const sag = index % 2 === 0 ? -0.012 : 0;
        return (
          <mesh
            key={z}
            position={[side * 0.278, 1.385 + sag, z]}
            rotation={[0, 0, side < 0 ? roofAngle : -roofAngle]}
            castShadow
          >
            <boxGeometry args={[roofBeamLength * 0.96, 0.014, 0.25, 2, 1, 2]} />
            <ToonMaterial color={color ?? (index % 2 === 0 ? BLUSH_LIGHT : BLUSH)} side={2} />
          </mesh>
        );
      })}
    </group>
  );
}
