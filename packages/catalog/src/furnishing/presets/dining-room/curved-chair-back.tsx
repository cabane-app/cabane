import { BufferGeometry, Float32BufferAttribute } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

// A steam-bent back with rounded edges and shallower, down-swept wings.
function makeBackrest() {
  const positions: number[] = [],
    indices: number[] = [];
  const sections = 20;
  const profile = [
    [0.78, -1],
    [1, -0.94],
    [1, 0.94],
    [0.78, 1],
    [-0.78, 1],
    [-1, 0.94],
    [-1, -0.94],
    [-0.78, -1],
  ];
  for (let i = 0; i <= sections; i++) {
    const t = (i / sections) * 2 - 1;
    const wing = t * t;
    for (const [z, y] of profile) {
      positions.push(
        0.245 * t,
        0.741 - 0.024 * wing + y * (0.079 - 0.036 * wing),
        -0.229 + 0.103 * wing + z * (0.021 - 0.008 * wing),
      );
    }
    if (i === sections) break;
    for (let j = 0; j < profile.length; j++) {
      const a = i * profile.length + j;
      const b = i * profile.length + ((j + 1) % profile.length);
      indices.push(a, a + profile.length, b, b, a + profile.length, b + profile.length);
    }
  }
  for (let i = 1; i < profile.length - 1; i++) {
    const end = sections * profile.length;
    indices.push(0, i, i + 1, end, end + i + 1, end + i);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
const back = makeBackrest();

export function CurvedChairBack() {
  return (
    <mesh name="curved-oak-backrest" geometry={back} castShadow receiveShadow>
      <ToonMaterial color="#d5b17e" />
      <Outlines color="#82694b" thickness={0.0015} screenspace={false} />
    </mesh>
  );
}
