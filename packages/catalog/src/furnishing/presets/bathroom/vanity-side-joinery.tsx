import { ToonMaterial } from "@cabane/engine";
import { BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Flush side fields sit between the slightly proud stiles, top and bottom rails.
const members = [-1, 1].flatMap((side) => [
  ...[-0.211, 0.195].map((z) =>
    new BoxGeometry(0.018, 0.69, 0.038).translate(side * 0.384, 0.467, z),
  ),
  ...[0.141, 0.793].map((y) =>
    new BoxGeometry(0.018, 0.038, 0.369).translate(side * 0.384, y, -0.008),
  ),
]);
const frame = mergeGeometries(members);
members.forEach((member) => member.dispose());

export function VanitySideJoinery() {
  return (
    <mesh
      name="vanity-side-stiles-and-rails"
      geometry={frame}
      dispose={null}
      castShadow
      receiveShadow
    >
      <ToonMaterial color="#513b30" />
    </mesh>
  );
}
