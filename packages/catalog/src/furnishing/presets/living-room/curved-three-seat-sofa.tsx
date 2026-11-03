import { CurvedSofaBase } from "./curved-sofa-base";
import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
export const CURVED_THREE_SEAT_SOFA_SIZE = [2.6, 0.88, 1.1] as const;
/** Generic proportions inferred from reference appearance, not manufacturer measurements. */
export function CurvedThreeSeatSofa({
  size = CURVED_THREE_SEAT_SOFA_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string;
}) {
  return (
    <group
      name="curved-three-seat-sofa"
      scale={[size[0] / 2.6, size[1] / 0.88, size[2] / 1.1]}
      userData={{ walkCollider: true }}
    >
      <CurvedSofaBase color={color} />
      {[-0.8, 0, 0.8].map((x, i) => (
        <group
          key={x}
          position={[x, 0, i === 1 ? -0.04 : 0.04]}
          rotation={[0, i === 0 ? 0.15 : i === 2 ? -0.15 : 0, 0]}
        >
          <RoundedFurniturePanel
            name="curved-sofa-seat"
            size={[0.76, 0.18, 0.75]}
            position={[0, 0.43, 0.08]}
            color={color ?? "#b4b5b0"}
            radius={0.075}
            outlineColor="#898d88"
          />
          <RoundedFurniturePanel
            name="curved-sofa-back"
            size={[0.78, 0.54, 0.29]}
            position={[0, 0.61, -0.28]}
            color={color ?? "#b8bab5"}
            radius={0.125}
            outlineColor="#898d88"
          />
        </group>
      ))}
    </group>
  );
}
