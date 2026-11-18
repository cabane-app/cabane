import { ToonMaterial } from "@cabane/engine";
import { LatheGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedFurniturePanel } from "../construction";
import { WallBackedCeramic } from "./wall-backed-ceramic";

function flushPair(profile: [number, number][]) {
  const parts = [
    { z: -0.043, radius: 0.034 },
    { z: 0.044, radius: 0.025 },
  ].map(({ z, radius }) =>
    new LatheGeometry(
      profile.map(([r, x]) => new Vector2(radius * r, x)),
      20,
    )
      .rotateZ(-Math.PI / 2)
      .translate(0.211, 0.91, z),
  );
  const pair = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return pair;
}
const sockets = flushPair([
  [1, -0.001],
  [1, 0.004],
  [0.95, 0.006],
  [0.83, 0.006],
  [0.8, 0.002],
]);
const buttons = flushPair([
  [0.85, 0.001],
  [0.84, 0.0035],
  [0.76, 0.0045],
  [0, 0.0045],
]);

/** Wall-hung WC facing +X, retaining the existing wall-contact origin. */
export function ConcealedCisternToilet() {
  return (
    <group name="concealed-cistern-toilet">
      <RoundedFurniturePanel
        name="cistern-enclosure"
        size={[0.21, 1.16, 0.58]}
        position={[0.095, 0.58, 0]}
        color="#e7e3da"
        radius={0.011}
        outlineColor="#aaa69e"
      />
      <RoundedFurniturePanel
        name="dual-flush-plate"
        size={[0.014, 0.14, 0.22]}
        position={[0.205, 0.91, 0]}
        color="#d4d6d3"
        radius={0.006}
        outline={false}
      />
      <mesh name="flush-button-sockets" geometry={sockets}>
        <ToonMaterial color="#a5aba8" />
      </mesh>
      <mesh name="flush-button" geometry={buttons}>
        <ToonMaterial color="#f0f1ed" />
      </mesh>
      <RoundedFurniturePanel
        name="bowl-wall-connection"
        size={[0.018, 0.246, 0.294]}
        position={[0.201, 0.302, 0]}
        color="#d8d6cf"
        radius={0.008}
        outline={false}
      />
      <WallBackedCeramic />
    </group>
  );
}
