import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { SphereGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const PET_BED_SIZE: SceneItemSize = [0.8, 0.24, 0.6];

/** Sparse tufts embedded in the bolster, batched without individual outlines. */
function FluffyTufts({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const tufts = Array.from({ length: 48 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      const tuft = new SphereGeometry(1, 6, 4);
      const radialOffset = index % 2 === 0 ? 0.055 : -0.055;
      tuft.scale(0.024, 0.022, 0.02);
      tuft.translate(
        (0.3 + radialOffset) * Math.cos(angle),
        0.211,
        (0.225 + radialOffset * 0.75) * Math.sin(angle),
      );
      return tuft;
    });
    const merged = mergeGeometries(tufts);
    tufts.forEach((tuft) => tuft.dispose());
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <ToonMaterial color={color} />
    </mesh>
  );
}

/** Generic oval padded pet bed, with a shared full envelope for both finishes. */
export function PetBed({
  size = PET_BED_SIZE,
  variant = "default",
  color,
}: {
  size?: SceneItemSize;
  variant?: string;
  color?: string;
}) {
  const fluffy = variant !== "padded-fabric";
  const fabric = color ?? (fluffy ? "#f3efe6" : "#8d9a8b");
  return (
    <group scale={[size[0] / 0.8, size[1] / 0.24, size[2] / 0.6]} userData={{ walkCollider: true }}>
      <mesh position={[0, 0.04, 0]} scale={[0.4, 0.04, 0.3]} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 12]} />
        <ToonMaterial color={fabric} />
      </mesh>
      <mesh
        position={[0, 0.14, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 0.75, 1]}
        castShadow
        receiveShadow
      >
        <torusGeometry args={[0.3, 0.1, 12, 48]} />
        <ToonMaterial color={fabric} />
      </mesh>
      <mesh position={[0, 0.085, 0]} scale={[0.29, 0.06, 0.215]} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 12]} />
        <ToonMaterial color={fabric} />
      </mesh>
      {fluffy && <FluffyTufts color={color ?? "#faf7f0"} />}
    </group>
  );
}
