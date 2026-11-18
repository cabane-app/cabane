import { ToonMaterial } from "@cabane/engine";
import {
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { roofHeight } from "./timber";

const colors = [
  "#8fa8aa",
  "#f6dcad",
  "#d7aa99",
  "#e7ba73",
  "#95acac",
  "#f6dfb2",
  "#dbb099",
  "#e7b973",
  "#91a6a5",
  "#ebbe78",
  "#dcb8a5",
  "#8fa6a8",
  "#e8b778",
  "#f4dcae",
  "#d4a691",
];
const positions = [
  1.15, 0.999, 0.85, 0.699, 0.549, 0.4, 0.252, 0.145, 0.075, 0, -0.21, -0.43, -0.63, -0.84, -1.055,
];
// The cord sits above the pine face and dips slightly between its centre and end attachments.
function cordPoint(z: number) {
  const sag = 0.016 * Math.sin((Math.PI * Math.abs(z)) / 1.16);
  return new Vector3(0.542, roofHeight(z) + 0.037 - sag, z);
}
const cord = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(0.542, roofHeight(1.17), 1.17),
    ...positions.map(cordPoint),
    new Vector3(0.542, roofHeight(-1.17), -1.17),
  ]),
  40,
  0.0043,
  6,
  false,
);
const lanterns = mergeGeometries(
  positions.map((z, i) => {
    const p = cordPoint(z);
    const ball = new SphereGeometry(0.04, 12, 8).translate(p.x, p.y, p.z);
    const color = new Color(colors[i]);
    const tones = new Float32Array(ball.getAttribute("position").count * 3);
    for (let j = 0; j < tones.length; j += 3) color.toArray(tones, j);
    ball.setAttribute("color", new Float32BufferAttribute(tones, 3));
    return ball;
  }),
);
export function CottonBallGarland() {
  return (
    <group name="cotton-ball-garland">
      <mesh geometry={cord} castShadow>
        <ToonMaterial color="#a98b72" />
      </mesh>
      <mesh geometry={lanterns} castShadow>
        <ToonMaterial color="#ffffff" vertexColors />
      </mesh>
    </group>
  );
}
