import { ToonMaterial } from "@cabane/engine";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";

// A continuous drape narrows at the tie, then falls outward toward the hem.
function makeDrape() {
  const positions: number[] = [];
  const indices: number[] = [];
  const columns = 40;
  const rows = 32;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const gathering = Math.exp(-Math.pow((t - 0.32) / 0.16, 2));
    const width = 0.3 - 0.22 * gathering;
    const center = 0.43 + 0.055 * gathering;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const fold = Math.sin(u * Math.PI * 10);
      positions.push(
        center + (u - 0.5) * width,
        t * 2.4,
        0.07 + fold * (0.023 - gathering * 0.012),
      );
      if (row === rows || column === columns) continue;
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const drapeGeometry = makeDrape();

/** Two linen panels on a pale rod, gathered with round cord tiebacks. */
export function TiedLinenPair({ color }: { color?: string | undefined }) {
  return (
    <group name="tied-linen-pair">
      <mesh position={[0, 2.365, 0.06]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.2, 12]} />
        <ToonMaterial color="#e4dfd3" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <mesh geometry={drapeGeometry} castShadow receiveShadow>
            <ToonMaterial color={color ?? "#c5b395"} side={DoubleSide} />
          </mesh>
          <mesh position={[0.54, 2.35, 0.03]} castShadow>
            <boxGeometry args={[0.024, 0.05, 0.06]} />
            <ToonMaterial color="#e4dfd3" />
          </mesh>
          <mesh position={[0.485, 0.768, 0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.043, 0.004, 6, 20]} />
            <ToonMaterial color="#d8cdb9" />
          </mesh>
          <mesh position={[0.485, 0.768, 0.113]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.024, 0.014, 16]} />
            <ToonMaterial color="#ddd3c0" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
