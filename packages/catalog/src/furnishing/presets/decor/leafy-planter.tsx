import { DoubleSide } from "three";
import { getMyrtleBranches } from "./myrtle-branches";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { OutdoorBasin } from "../outdoor/outdoor-basin";
export const LEAFY_PLANTER_SIZE = [0.8, 1.25, 0.8] as const;
/** Dense myrtle-like shrub with individually shaped, batched leaves. */
export function LeafyPlanter({
  size = LEAFY_PLANTER_SIZE,
  variant = "terracotta",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  const myrtle = getMyrtleBranches();
  return (
    <group scale={[size[0] / 0.8, size[1] / 1.25, size[2] / 0.8]}>
      <OutdoorBasin
        name="leafy-planter-pot"
        radius={0.23}
        height={0.42}
        position={[0, 0, 0]}
        color={variant === "ivory" ? "#d9cdb6" : "#b97b57"}
      />
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.205, 0.205, 0.02, 24]} />
        <ToonMaterial color="#65503b" />
      </mesh>
      <mesh
        name="myrtle-trunk-and-twigs"
        geometry={myrtle.branches}
        dispose={null}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#826547" />
      </mesh>
      {myrtle.leaves.map((g, i) => (
        <mesh key={i} name="myrtle-leaf-spray" geometry={g} dispose={null} castShadow receiveShadow>
          <ToonMaterial side={DoubleSide} color={["#607d42", "#758c4d", "#819956"][i]} />
        </mesh>
      ))}
    </group>
  );
}
