import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Vector2 } from "three";

export const FREESTANDING_BATHTUB_SIZE = [1.7, 0.6, 0.78] as const;

// One closed section, from the underside over the rolled lip into the basin.
// The elliptical sweep keeps the ceramic continuous, including the rounded ends.
const SHELL_PROFILE = [
  [0, 0],
  [0.235, 0],
  [0.26, 0.008],
  [0.278, 0.028],
  [0.29, 0.065],
  [0.31, 0.15],
  [0.337, 0.27],
  [0.363, 0.4],
  [0.383, 0.52],
  [0.39, 0.568],
  [0.388, 0.586],
  [0.379, 0.597],
  [0.368, 0.6],
  [0.357, 0.596],
  [0.349, 0.585],
  [0.346, 0.568],
  [0.339, 0.52],
  [0.319, 0.4],
  [0.293, 0.28],
  [0.271, 0.205],
  [0.25, 0.164],
  [0.223, 0.14],
  [0.19, 0.13],
  [0, 0.13],
].map(([radius, height]) => new Vector2(radius, height));

/** Seamless oval soaking bath with a rolled rim and recessed basin. */
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
      <mesh name="bathtub-ceramic-shell" scale={[0.85 / 0.39, 1, 1]} castShadow receiveShadow>
        <latheGeometry args={[SHELL_PROFILE, 64]} />
        <ToonMaterial color="#f3f0e9" />
        <Outlines color="#a7aaa5" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh name="bathtub-drain-seat" position={[0.25, 0.132, 0]}>
        <cylinderGeometry args={[0.034, 0.034, 0.004, 24]} />
        <ToonMaterial color="#8c9795" />
      </mesh>
      <mesh name="bathtub-drain" position={[0.25, 0.135, 0]}>
        <cylinderGeometry args={[0.027, 0.029, 0.004, 24]} />
        <ToonMaterial color="#c2cbc8" />
      </mesh>
      <mesh
        name="bathtub-overflow"
        position={[0, 0.51, -0.336]}
        rotation={[Math.PI / 2 - 0.165, 0, 0]}
        scale={[1, 1, 0.3]}
      >
        <cylinderGeometry args={[0.038, 0.038, 0.006, 24]} />
        <ToonMaterial color="#939e9b" />
      </mesh>
    </group>
  );
}
