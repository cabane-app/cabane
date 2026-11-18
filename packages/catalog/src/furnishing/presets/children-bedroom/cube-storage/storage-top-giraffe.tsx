import { ToonMaterial } from "@cabane/engine";
import { Color, Float32BufferAttribute, SphereGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const pieces: BufferGeometry[] = [];
function plush(x: number, y: number, z: number, w: number, h: number, d: number, tint: string) {
  const part = new SphereGeometry(1, 10, 6).scale(w, h, d).translate(x, y, z);
  const rgb = new Color(tint),
    colors: number[] = [];
  for (let i = 0; i < part.attributes.position.count; i++) colors.push(rgb.r, rgb.g, rgb.b);
  part.setAttribute("color", new Float32BufferAttribute(colors, 3));
  pieces.push(part);
}
plush(0, 0.085, 0, 0.072, 0.075, 0.064, "#c7834f");
plush(0, 0.205, 0, 0.04, 0.126, 0.042, "#d9a267");
plush(0, 0.31, 0, 0.062, 0.066, 0.056, "#dfad71");
plush(0, 0.286, 0.049, 0.047, 0.029, 0.036, "#ead2a3");
for (const side of [-1, 1]) {
  plush(side * 0.045, 0.028, 0.036, 0.035, 0.028, 0.038, "#ae754e");
  plush(side * 0.056, 0.33, 0, 0.03, 0.018, 0.019, "#c48859");
  plush(side * 0.032, 0.374, 0, 0.009, 0.034, 0.009, "#b77e50");
  plush(side * 0.032, 0.408, 0, 0.013, 0.014, 0.013, "#885d40");
  plush(side * 0.034, 0.322, 0.044, 0.008, 0.009, 0.006, "#493a32");
  plush(side * 0.031, 0.193, 0.018, 0.012, 0.016, 0.015, "#ae764d");
}
const giraffe = mergeGeometries(pieces);
pieces.forEach((part) => part.dispose());
export function StorageTopGiraffe() {
  return (
    <mesh
      name="peluche-girafe-rangement-bedroom-two"
      position={[0.25, 0.78, 0]}
      geometry={giraffe}
      castShadow
      receiveShadow
    >
      <ToonMaterial vertexColors />
    </mesh>
  );
}
