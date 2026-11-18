import { ToonMaterial } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { LatheGeometry } from "three";
import { splitCane } from "./shade-finishes";
import { lampProfile } from "./shade-frame";

const binding = lampProfile([
  [0.202, -0.479],
  [0.21, -0.478],
  [0.222, -0.467],
]);
const rush = lampProfile([
  [0.222, -0.467],
  [0.247, -0.439],
  [0.267, -0.403],
  [0.277, -0.376],
  [0.278, -0.362],
]);

// Only the lower edge undulates; the crown stays straight under the overlapping tier.
function scallop(profile: typeof binding) {
  const geometry = new LatheGeometry(profile, 72);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const angle = Math.atan2(vertices.getX(i), vertices.getZ(i));
    const y = vertices.getY(i);
    const depth = Math.min(1, Math.max(0, (-0.408 - y) / 0.058));
    vertices.setY(i, y + depth * 0.0095 * (1 - Math.cos(9 * angle)));
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function ScallopedRushHem({ color }: { readonly color: string }) {
  const [body, edge] = useMemo(() => [scallop(rush), scallop(binding)], []);
  useEffect(
    () => () => {
      body.dispose();
      edge.dispose();
    },
    [body, edge],
  );
  return (
    <>
      <mesh geometry={body} castShadow>
        <ToonMaterial color={color} map={splitCane} side={2} />
      </mesh>
      <mesh geometry={edge} castShadow>
        <ToonMaterial color="#ad765c" side={2} />
      </mesh>
    </>
  );
}
