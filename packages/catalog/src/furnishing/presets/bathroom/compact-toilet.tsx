import { Outlines, ToonMaterial } from "@cabane/engine";
import { Vector2 } from "three";
import { RoundedFurniturePanel } from "../construction";
import { ConcealedToiletBowl } from "./concealed-toilet-bowl";

// An inset floor foot flares back out under the casting. Its rear end carries
// the cistern shelf while the curved nose leaves the bowl overhanging the foot.
const pedestal = [
  [0, 0.02],
  [0.103, 0.02],
  [0.111, 0.027],
  [0.111, 0.052],
  [0.09, 0.12],
  [0.091, 0.164],
  [0.107, 0.208],
  [0.126, 0.24],
  [0.128, 0.26],
  [0, 0.26],
].map(([r, y]) => new Vector2(r, y));

export function CompactToilet() {
  return (
    <group name="toilettes-suite-parentale-custom" userData={{ walkCollider: true }}>
      <mesh name="pedestal" scale={[1, 1, 1.49]} position-z={0.013} castShadow receiveShadow>
        <latheGeometry args={[pedestal, 32]} />
        <ToonMaterial color="#ebece8" />
      </mesh>
      <group position={[0, -0.027, 0.25286]} scale={[0.77, 0.96, 0.92]} rotation-y={Math.PI / 2}>
        <ConcealedToiletBowl ceramicColor="#ebece8" seatColor="#f4f4ef" supportColor="#c7cecb" />
      </group>
      <RoundedFurniturePanel
        name="cistern-shelf"
        size={[0.272, 0.16, 0.19]}
        position={[0, 0.266, 0.155]}
        radius={0.036}
        color="#e4e7e2"
        outline={false}
      />
      <RoundedFurniturePanel
        name="close-coupled-cistern"
        size={[0.375, 0.396, 0.189]}
        position={[0, 0.52, 0.202]}
        radius={0.033}
        color="#f0f1ed"
        outlineColor="#aeb4ae"
      />
      <RoundedFurniturePanel
        name="cistern-cover"
        size={[0.39, 0.032, 0.199]}
        position={[0, 0.711, 0.2005]}
        radius={0.012}
        color="#f7f7f1"
        outline={false}
      />
      <mesh name="flush-bezel" position={[0, 0.729, 0.2]} castShadow>
        <cylinderGeometry args={[0.033, 0.035, 0.009, 24]} />
        <ToonMaterial color="#8c9391" />
        <Outlines color="#757e79" thickness={0.001} screenspace={false} />
      </mesh>
      <mesh name="flush-button" position={[0, 0.737, 0.2]}>
        <cylinderGeometry args={[0.026, 0.027, 0.014, 24]} />
        <ToonMaterial color="#bbc4be" />
      </mesh>
    </group>
  );
}
