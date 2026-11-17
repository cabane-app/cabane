import { Vector2 } from "three";
import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { VanityDoor } from "./vanity-door";

const knob = [
  [0, 0.017],
  [0.015, 0.017],
  [0.015, 0.021],
  [0.009, 0.025],
  [0.008, 0.04],
  [0.018, 0.046],
  [0.024, 0.051],
  [0.024, 0.056],
  [0.019, 0.061],
  [0.009, 0.065],
  [0, 0.065],
].map(([r, y]) => new Vector2(r, y));

export function WoodenVanity() {
  return (
    <group name="wooden-vanity" rotation={[0, -Math.PI / 2, 0]}>
      {[-0.94, 0.94].flatMap((x) =>
        [-0.173, 0.173].map((z) => (
          <mesh
            key={x + "-" + z}
            position={[x, 0.068, z]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.057, 0.041, 0.136, 4, 1, false]} />
            <ToonMaterial color="#684735" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[2.113, 0.642, 0.471]}
        position={[0, 0.43, -0.005]}
        color="#9a6745"
        radius={0.012}
        outline={false}
      />
      <RoundedFurniturePanel
        size={[2.18, 0.055, 0.52]}
        position={[0, 0.7775, 0]}
        color="#a97650"
        radius={0.009}
        outlineColor="#876043"
      />
      {[-0.762, -0.254, 0.254, 0.762].map((x, index) => (
        <group key={x} position={[x, 0.429, 0.231]}>
          <VanityDoor color="#ad7a54" louvered />
          <group position={[index % 2 === 0 ? 0.221 : -0.221, 0.076, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <latheGeometry args={[knob, 16]} />
              <ToonMaterial color="#4b4039" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
