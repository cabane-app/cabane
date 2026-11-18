import { Outlines, ToonMaterial } from "@cabane/engine";
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { linenWeaveTexture } from "../construction/linen-weave-texture";

const postProfile = [
  [0, 0],
  [0.017, 0],
  [0.017, 0.005],
  [0.015, 0.008],
  [0.011, 0.01],
  [0.009, 0.018],
  [0.009, 0.057],
  [0.012, 0.064],
  [0, 0.069],
];
const posts = [-0.293, 0.293].map((z) =>
  new LatheGeometry(
    postProfile.map(([r, x]) => new Vector2(r, x)),
    16,
  )
    .rotateZ(-Math.PI / 2)
    .translate(0, 0, z),
);
const fittings = mergeGeometries(posts);
posts.forEach((post) => post.dispose());

const rail = [
  [0, -0.31],
  [0.009, -0.31],
  [0.012, -0.307],
  [0.012, -0.281],
  [0.011, -0.278],
  [0.011, 0.278],
  [0.012, 0.281],
  [0.012, 0.307],
  [0.009, 0.31],
  [0, 0.31],
].map(([r, z]) => new Vector2(r, z));

// A single cloth wraps the spindle. Its short back leaf and long front leaf
// share the crown; the loose hem flutes out slightly away from the wall.
const section = new Shape();
section.moveTo(0.043, -0.298);
section.lineTo(0.051, 0);
section.absarc(0.068, 0, 0.017, Math.PI, 0, true);
section.lineTo(0.086, -0.49);
section.lineTo(0.081, -0.49);
section.lineTo(0.079, 0);
section.absarc(0.068, 0, 0.011, 0, Math.PI, false);
section.lineTo(0.048, -0.298);
section.closePath();
const towel = new ExtrudeGeometry(section, {
  depth: 0.52,
  steps: 12,
  curveSegments: 4,
  bevelEnabled: false,
}).translate(0, 0, -0.26);
const position = towel.getAttribute("position");
const uv = towel.getAttribute("uv");
for (let i = 0; i < position.count; i++) {
  const z = position.getZ(i);
  const y = position.getY(i);
  const fall = Math.max(0, -y / 0.49);
  const ripple = Math.cos((z / 0.26) * 3 * Math.PI);
  position.setX(i, position.getX(i) + fall * 0.012 * ripple);
  position.setY(i, y + fall * 0.003 * (1 - ripple));
  uv.setXY(i, z * 2, y * 2);
}
towel.computeVertexNormals();

export function TowelRail({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="towel-rail">
      <mesh geometry={fittings} name="wall-posts" castShadow>
        <ToonMaterial color="#909794" />
      </mesh>
      <mesh name="towel-bar" position-x={0.068} rotation-x={Math.PI / 2} castShadow>
        <latheGeometry args={[rail, 16]} />
        <ToonMaterial color="#aeb5b2" />
      </mesh>
      <mesh name="draped-towel" geometry={towel} castShadow receiveShadow>
        <ToonMaterial color={color ?? "#e6dfd2"} map={linenWeaveTexture} />
        <Outlines color="#938d82" thickness={0.0013} screenspace={false} />
      </mesh>
    </group>
  );
}
