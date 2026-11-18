import { ToonMaterial } from "@cabane/engine";
import { CatmullRomCurve3, DoubleSide, SphereGeometry, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { linenWeaveTexture } from "../../construction/linen-weave-texture";
import { textileSurface } from "./textile-surface";

const bolsterPath = new CatmullRomCurve3([
  new Vector3(-0.459, 0.441, 0.48),
  new Vector3(-0.459, 0.448, -0.46),
  new Vector3(-0.433, 0.448, -0.933),
  new Vector3(-0.335, 0.448, -1.019),
  new Vector3(0.345, 0.448, -1.019),
  new Vector3(0.446, 0.448, -0.936),
  new Vector3(0.455, 0.448, -0.48),
  new Vector3(0.453, 0.448, -0.11),
]);
const turns = 8;
function braidStrand(strand: number) {
  const points = Array.from({ length: turns * 16 + 1 }, (_, i) => {
    const t = i / (turns * 16),
      centre = bolsterPath.getPointAt(t),
      tangent = bolsterPath.getTangentAt(t);
    const phase = Math.PI * 2 * (turns * t + strand / 3);
    const offset = 0.044 * Math.sin(phase);
    return centre.add(
      new Vector3(tangent.z * offset, 0.024 * Math.sin(2 * phase), -tangent.x * offset),
    );
  });
  const tube = new TubeGeometry(new CatmullRomCurve3(points), turns * 18, 0.032, 8, false);
  const tips = [points[0], points[points.length - 1]].map(({ x, y, z }) =>
    new SphereGeometry(0.032, 8, 6).translate(x, y, z),
  );
  return mergeGeometries([tube, ...tips]);
}
const strands = [0, 1, 2].map(braidStrand);
const braidColors = ["#e8d9bf", "#f6e8d4", "#eeddc5"];
const pillow = textileSurface(32, 16, (u, v) => {
  const angle = 2 * Math.PI * u,
    latitude = Math.PI * v;
  const edge = Math.sin(latitude);
  const rounded = (value: number) => Math.sign(value) * Math.abs(value) ** 0.6;
  const x = 0.382 * rounded(Math.cos(angle)) * edge;
  const z = 0.218 * rounded(Math.sin(angle)) * edge;
  const y = 0.124 * Math.cos(latitude) * (1 - 0.19 * Math.abs(Math.sin(2 * angle)) * edge ** 3);
  return [x, y, z];
});

export function PillowAndBumper() {
  return (
    <>
      <mesh
        geometry={pillow}
        name="ivory-pillow"
        position={[-0.007, 0.484, -0.715]}
        rotation={[0.22, -0.09, -0.03]}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#f7e9db" map={linenWeaveTexture} side={DoubleSide} />
      </mesh>
      {strands.map((geometry, i) => (
        <mesh key={i} name="braided-cot-bumper" geometry={geometry} castShadow receiveShadow>
          <ToonMaterial color={braidColors[i]} map={linenWeaveTexture} />
        </mesh>
      ))}
    </>
  );
}
