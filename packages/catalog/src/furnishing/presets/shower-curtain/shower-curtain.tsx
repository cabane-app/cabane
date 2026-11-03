import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { BufferGeometry, Float32BufferAttribute } from "three";

export const SHOWER_CURTAIN_SIZE: SceneItemSize = [1.8, 2, 0.12];

// One continuous, thin solid sheet: twelve softly rounded vertical folds.
function makeFabric() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 96;
  for (let i = 0; i <= segments; i++) {
    const x = -0.86 + (1.72 * i) / segments;
    const z = 0.058 * Math.sin((i / segments) * Math.PI * 24);
    positions.push(x, 0, z - 0.002, x, 1.922, z - 0.002);
    positions.push(x, 0, z + 0.002, x, 1.922, z + 0.002);
    if (i === segments) continue;
    const a = i * 4;
    indices.push(a, a + 1, a + 4, a + 1, a + 5, a + 4);
    indices.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
    indices.push(a, a + 4, a + 2, a + 2, a + 4, a + 6);
    indices.push(a + 1, a + 3, a + 5, a + 3, a + 7, a + 5);
  }
  indices.push(0, 2, 1, 1, 2, 3);
  const end = segments * 4;
  indices.push(end, end + 1, end + 2, end + 1, end + 3, end + 2);
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const fabricGeometry = makeFabric();

/** Bottom-origin curtain and tension rail; elevate the hem to the tub rim. */
export function ShowerCurtain({
  size = SHOWER_CURTAIN_SIZE,
  color,
}: {
  size?: SceneItemSize;
  color?: string;
}) {
  return (
    <group
      name="shower-curtain"
      scale={
        size.map((value, axis) => value / SHOWER_CURTAIN_SIZE[axis]) as [number, number, number]
      }
    >
      <mesh geometry={fabricGeometry} castShadow receiveShadow>
        <ToonMaterial color={color ?? "#dddcd0"} />
        <Outlines color="#a09f94" thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh position={[0, 1.97, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 1.78, 16]} />
        <ToonMaterial color="#b8bebd" />
        <Outlines color="#818b89" thickness={0.0015} screenspace={false} />
      </mesh>
      {[-0.89, 0.89].map((x) => (
        <mesh key={x} position={[x, 1.97, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
          <ToonMaterial color="#cdd0c9" />
        </mesh>
      ))}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh
          key={i}
          position={[-0.86 + (1.72 * i) / 12, 1.945, 0]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
        >
          <torusGeometry args={[0.028, 0.003, 6, 16]} />
          <ToonMaterial color="#c5c9c4" />
        </mesh>
      ))}
    </group>
  );
}
