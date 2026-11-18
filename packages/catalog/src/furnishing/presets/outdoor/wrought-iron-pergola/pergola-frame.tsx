import { BoxGeometry, DoubleSide } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ToonMaterial } from "@cabane/engine";
import type { ReactNode } from "react";
import { createPergolaGeometry } from "./pergola-geometry";

export const WROUGHT_IRON_PERGOLA_SIZE = [4, 2.7, 3] as const;
let sharedGeometry: ReturnType<typeof createPergolaGeometry> | undefined;
function pergolaGeometry() {
  return (sharedGeometry ??= createPergolaGeometry());
}
const postParts = [
  new BoxGeometry(0.065, 2.62, 0.065).translate(0, 1.31, 0),
  new BoxGeometry(0.17, 0.05, 0.17).translate(0, 0.025, 0),
];
const anchoredPost = mergeGeometries(postParts);
postParts.forEach((part) => part.dispose());

export function PergolaFrame({
  children,
  bulbFinish,
}: {
  children?: ReactNode;
  bulbFinish?: { color: string; emissiveIntensity: number } | undefined;
}) {
  const geometry = pergolaGeometry();
  return (
    <group name="provencal-wrought-iron-pergola">
      {[-1.88, 1.88].flatMap((x) =>
        [-1.38, 1.38].map((z) => (
          <mesh
            key={`${x}-${z}`}
            name="pergola-post"
            geometry={anchoredPost}
            position={[x, 0, z]}
            castShadow
            userData={{ walkCollider: true }}
          >
            <ToonMaterial color="#303b36" />
          </mesh>
        )),
      )}
      <mesh name="pergola-ironwork" geometry={geometry.iron} castShadow>
        <ToonMaterial color="#303b36" />
      </mesh>
      <mesh geometry={geometry.wood} castShadow>
        <ToonMaterial color="#766044" />
      </mesh>
      {geometry.leaves.map((leaf, i) => (
        <mesh key={i} geometry={leaf} castShadow>
          <ToonMaterial color={["#64754a", "#93a465", "#476348"][i]} side={DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={geometry.flowers} castShadow>
        <ToonMaterial color="#baa3cc" />
      </mesh>
      {bulbFinish && (
        <group name="pergola-string-lights">
          <mesh name="pergola-festoon-cord" geometry={geometry.strand}>
            <ToonMaterial color="#343a31" />
          </mesh>
          <mesh name="pergola-festoon-globes" geometry={geometry.bulbs}>
            <ToonMaterial
              color={bulbFinish.color}
              emissive="#ffd28c"
              emissiveIntensity={bulbFinish.emissiveIntensity}
            />
          </mesh>
        </group>
      )}
      {children}
    </group>
  );
}
