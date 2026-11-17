import { LinenPillow } from "./linen-pillow";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { CozyBedHeadboard, CozyWhiteBlueBedding } from "./cozy-white-blue-bed";

import { bedFeet } from "./double-bed-feet";
import { CozyBedCover } from "./cozy-bed-cover";

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
              radius={0.045}
              outlineColor="#94764e"
            />
            {[-0.516, 0, 0.516].map((x) => (
              <RoundedFurniturePanel
                key={x}
                name="double-bed-padded-headboard"
                size={[0.512, 0.6, 0.09]}
                position={[x, 0.755, -0.977]}
                color={color ?? "#d4c6af"}
                radius={0.044}
                outline={false}
              />
            ))}
          </>
        )}
      </group>
      <group name="double-bed-low-collider" userData={{ walkCollider: true, walkSupport: true }}>
        <mesh name="double-bed-feet" geometry={bedFeet} dispose={null} castShadow receiveShadow>
          <ToonMaterial color="#b58d5e" />
        </mesh>
        <RoundedFurniturePanel
          size={[1.7, 0.165, 2.15]}
          position={[0, 0.2475, 0]}
          color="#cfaa76"
          radius={0.025}
          outlineColor="#a68358"
        />
        <mesh name="double-bed-recessed-apron" position={[0, 0.147, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.627, 0.072, 2.061]} />
          <ToonMaterial color="#a88257" />
        </mesh>
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
            <CozyBedCover
              name="double-bed-duvet"
              back={-0.46}
              front={1.066}
              lift={-0.026}
              thickness={0.061}
              color={color ?? "#ded3c1"}
              soft
            />
            <RoundedFurniturePanel
              name="double-bed-folded-sheet"
              size={[1.603, 0.052, 0.181]}
              position={[0, 0.617, -0.413]}
              color="#ece5d6"
              radius={0.024}
              outline={false}
            />
            {[-0.4, 0.4].map((x) => (
              <LinenPillow
                key={x}
                name="double-bed-pillow"
                size={[0.68, 0.11, 0.39]}
                position={[x, 0.605, -0.716]}
                rotation={[0.22, x * 0.1, 0]}
                color={color ?? "#f4f0e6"}
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
