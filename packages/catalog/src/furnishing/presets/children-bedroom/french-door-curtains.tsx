import { ToonMaterial } from "@cabane/engine";
import { BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute } from "three";
import { linenWeaveTexture } from "../construction/linen-weave-texture";

const rod = new CylinderGeometry(0.025, 0.025, 1.76, 16)
  .rotateZ(Math.PI / 2)
  .translate(0, 2.26, 0.015);

// One continuous panel per side. The wider bottom hem hangs in shallow scallops;
// the doubled heading gathers into a pocket on the rod.
function curtainPanel(side: number) {
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rows = [0, 0.017, 0.021, 0.14, 0.37, 0.62, 0.84, 0.957, 0.963, 0.994, 1];
  const columns = 40;
  for (const [row, v] of rows.entries()) {
    for (let col = 0; col <= columns; col++) {
      const u = col / columns;
      const wave = Math.cos(8 * Math.PI * u + 0.35 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u));
      const center = side * (0.76 - 0.035 * v);
      const width = 0.38 - 0.091 * v + 0.013 * Math.sin(2 * Math.PI * v);
      const x = center + (u - 0.5) * width;
      const y = 0.08 + v * 2.196 + (1 - v) ** 4 * (wave + 1) * 0.005;
      const z = 0.04 - 0.012 * v + (0.026 - 0.014 * v) * wave;
      const seam = v === 0.021 || v === 0.957 || col === 1 || col === columns - 1;
      const tint = seam ? 0.87 : v <= 0.017 || v >= 0.963 ? 0.95 : 1;
      positions.push(x, y, z);
      uvs.push(u * 1.4, v * 6);
      colors.push(tint, tint, tint);
      if (row && col) {
        const d = row * (columns + 1) + col,
          a = d - columns - 2;
        indices.push(a, a + 1, d, a, d, d - 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const panels = [-1, 1].map(curtainPanel);

export function ChildrenBedroomFrenchDoorCurtains({ color }: { color?: string | undefined } = {}) {
  return (
    <group name="rideaux-porte-fenetre-chambre-enfant">
      <mesh name="curtain-rod" geometry={rod} castShadow>
        <ToonMaterial color="#d9d2c8" />
      </mesh>
      {panels.map((panel, i) => (
        <mesh key={i} name="curtain-panel" geometry={panel} castShadow receiveShadow>
          <ToonMaterial
            color={color ?? "#d8d0c4"}
            map={linenWeaveTexture}
            vertexColors
            side={DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
