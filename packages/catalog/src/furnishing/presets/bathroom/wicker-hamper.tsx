import { Outlines, ToonMaterial } from "@cabane/engine";
import { LatheGeometry, Vector2 } from "three";
import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";

const wickerWeave = tintableFinishTexture(128, "hamper-flat-reed-weave", (u, v) => {
  const column = Math.floor(u * 10);
  const row = Math.floor(v * 6);
  const vertical = Math.sin(Math.PI * (u * 10 - column));
  const horizontal = Math.sin(Math.PI * (v * 6 - row));
  const top = (column + row) % 2 === 0 ? horizontal : vertical;
  const underneath = Math.min(horizontal, vertical);
  const reedColor = Math.sin(2 * Math.PI * ((row % 3) / 3 + u));
  return 0.72 + 0.21 * top + 0.055 * underneath + 0.015 * reedColor;
});

// Expand a turned section into a rounded rectangle. The analytic horizontal
// normal stays continuous at the UV seam and across the broad woven faces.
function hamperShell(section: [number, number][]) {
  const geometry = new LatheGeometry(
    section.map(([r, y]) => new Vector2(r, y)),
    48,
  );
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const angle = 2 * Math.PI * uv.getX(i);
    const sx = Math.sin(angle);
    const sz = Math.cos(angle);
    const x = Math.sign(sx) * Math.sqrt(Math.abs(sx));
    const z = Math.sign(sz) * Math.sqrt(Math.abs(sz));
    const [radius, y] = section[i % section.length];
    position.setXYZ(i, x * radius, y, z * radius * (23 / 24));
    const nx = x ** 3;
    const nz = z ** 3 * (24 / 23);
    const horizontal = Math.hypot(normal.getX(i), normal.getZ(i));
    const direction = Math.sign(normal.getX(i) * sx + normal.getZ(i) * sz);
    const weight = (horizontal * direction) / Math.hypot(nx, nz);
    normal.setXYZ(i, nx * weight, normal.getY(i), nz * weight);
    uv.setXY(i, 4 * uv.getX(i), y * 2.7);
  }
  return geometry;
}

const wicker = hamperShell([
  [0, 0],
  [0.19, 0],
  [0.202, 0.014],
  [0.233, 0.53],
  [0.233, 0.549],
  [0.222, 0.549],
  [0.216, 0.524],
  [0.19, 0.032],
  [0, 0.032],
]);
const binding = hamperShell([
  [0.223, 0.535],
  [0.235, 0.535],
  [0.24, 0.541],
  [0.24, 0.556],
  [0.235, 0.562],
  [0.219, 0.562],
  [0.215, 0.555],
  [0.215, 0.545],
  [0.223, 0.535],
]);
// The lid rests on the side bindings. Its shorter front edge leaves a finger gap.
const lid = hamperShell([
  [0, 0.559],
  [0.229, 0.559],
  [0.235, 0.565],
  [0.235, 0.577],
  [0.224, 0.585],
  [0.17, 0.591],
  [0.08, 0.593],
  [0, 0.593],
]);
const lidUv = lid.getAttribute("uv");
const lidPosition = lid.getAttribute("position");
for (let i = 0; i < lidUv.count; i++) {
  lidUv.setXY(i, lidPosition.getX(i) * 3, lidPosition.getZ(i) * 3);
}

export function WickerHamper() {
  return (
    <group name="wicker-hamper">
      <mesh name="woven-case" geometry={wicker} castShadow receiveShadow>
        <ToonMaterial color="#b08355" map={wickerWeave} />
      </mesh>
      <mesh name="bound-opening" geometry={binding} castShadow receiveShadow>
        <ToonMaterial color="#80583d" />
      </mesh>
      <mesh
        name="woven-lid"
        geometry={lid}
        position-z={-0.018}
        scale-z={0.88}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#c39967" map={wickerWeave} />
        <Outlines color="#806045" thickness={0.0013} screenspace={false} />
      </mesh>
    </group>
  );
}
