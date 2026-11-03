import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { CozyBedHeadboard, CozyWhiteBlueBedding } from "./cozy-white-blue-bed";

export const DOUBLE_BED_SIZE = [1.7, 1.1, 2.15] as const;

/** A 160 × 200 cm mattress in a freestanding oak and upholstered frame. */
export function DoubleBed({
  size = DOUBLE_BED_SIZE,
  variant = "default",
  color,
}: {
  size?: SceneItemSize;
  color?: string | undefined;
  variant?: string | undefined;
}) {
  const cozy = ["cozy-white-blue", "cozy-sage", "cozy-rose", "cozy-oat"].includes(variant);
  return (
    <group name="double-bed" scale={[size[0] / 1.7, size[1] / 1.1, size[2] / 2.15]}>
      <group name="double-bed-headboard-collider" userData={{ walkCollider: true }}>
        {cozy ? (
          <CozyBedHeadboard />
        ) : (
          <>
            <RoundedFurniturePanel
              name="double-bed-headboard"
              size={[1.7, 0.88, 0.08]}
              position={[0, 0.66, -1.03]}
              color="#c9a571"
              radius={0.022}
            />
            <RoundedFurniturePanel
              name="double-bed-padded-headboard"
              size={[1.56, 0.62, 0.07]}
              position={[0, 0.74, -0.985]}
              color={color ?? "#d4c6af"}
              radius={0.035}
            />
          </>
        )}
      </group>
      <group name="double-bed-low-collider" userData={{ walkCollider: true, walkSupport: true }}>
        {[-0.7, 0.7].flatMap((x) =>
          [-0.9, 0.9].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.085, z]} castShadow>
              <boxGeometry args={[0.065, 0.17, 0.065]} />
              <ToonMaterial color="#b58d5e" />
            </mesh>
          )),
        )}
        <RoundedFurniturePanel
          size={[1.7, 0.22, 2.15]}
          position={[0, 0.22, 0]}
          color="#cfaa76"
          radius={0.014}
        />
        <RoundedFurniturePanel
          name="double-bed-160x200-mattress"
          size={[1.6, 0.2, 2]}
          position={[0, 0.43, 0.035]}
          color="#efebe0"
          radius={0.04}
          outlineColor="#aaa18f"
        />
        {!cozy && (
          <>
            <RoundedFurniturePanel
              name="double-bed-duvet"
              size={[1.64, 0.1, 1.48]}
              position={[0, 0.57, 0.27]}
              color={color ?? "#ded3c1"}
              radius={0.045}
              outlineColor="#a79b87"
            />
            {[-0.4, 0.4].map((x) => (
              <RoundedFurniturePanel
                key={x}
                name="double-bed-pillow"
                size={[0.68, 0.11, 0.39]}
                position={[x, 0.6, -0.68]}
                color={color ?? "#f4f0e6"}
                radius={0.05}
                outlineColor="#b6ad9c"
              />
            ))}
          </>
        )}
      </group>
      {cozy && <CozyWhiteBlueBedding variant={variant} color={color} />}
    </group>
  );
}
