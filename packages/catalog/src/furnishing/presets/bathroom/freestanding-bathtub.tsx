import { Vector2 } from "three";
import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";

export const FREESTANDING_BATHTUB_SIZE = [1.7, 0.6, 0.78] as const;

// One closed ceramic section: underside, tapered exterior, rolled lip, then
// the sloping interior and flat basin floor. Elliptical scaling keeps the
// rim and bowl continuous, with no overlapping panels or separate rim seam.
const shellProfile = [
  [0, 0],
  [0.7, 0],
  [0.75, 0.012],
  [0.79, 0.04],
  [0.84, 0.1],
  [0.9, 0.22],
  [0.96, 0.39],
  [0.995, 0.53],
  [1, 0.565],
  [0.992, 0.588],
  [0.974, 0.6],
  [0.95, 0.6],
  [0.924, 0.59],
  [0.9, 0.57],
  [0.87, 0.52],
  [0.82, 0.4],
  [0.76, 0.25],
  [0.72, 0.18],
  [0.68, 0.14],
  [0.64, 0.124],
  [0.6, 0.12],
  [0, 0.12],
].map(([radius, height]) => new Vector2(radius, height));

/** A continuous oval stone-resin bath with a rolled rim and empty basin. */
export function FreestandingBathtub({
  size = FREESTANDING_BATHTUB_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="freestanding-bathtub"
      scale={[size[0] / 1.7, size[1] / 0.6, size[2] / 0.78]}
      userData={{ walkCollider: true }}
    >
      <mesh name="bathtub-ceramic-shell" scale={[0.85, 1, 0.39]} castShadow receiveShadow>
        <latheGeometry args={[shellProfile, 64]} />
        <ToonMaterial color="#f1eee7" />
        <Outlines thickness={0.0015} screenspace={false} color="#a6a39b" />
      </mesh>
      <mesh name="bathtub-drain" position={[0.32, 0.122, 0]}>
        <cylinderGeometry args={[0.027, 0.027, 0.006, 24]} />
        <ToonMaterial color="#9b9e98" />
      </mesh>
      {/* The cap follows the inner end-wall slope and embeds 2 mm into it. */}
      <mesh name="bathtub-overflow" position={[-0.731, 0.5, 0]} rotation={[0, 0, -1.911]}>
        <cylinderGeometry args={[0.018, 0.018, 0.006, 20]} />
        <ToonMaterial color="#9b9e98" />
      </mesh>
    </group>
  );
}
