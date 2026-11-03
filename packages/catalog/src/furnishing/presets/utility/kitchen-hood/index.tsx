import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../construction";

export const KITCHEN_HOOD_SIZE = [0.6, 0.7, 0.5] as const;
export const KITCHEN_HOOD_VARIANTS = [
  { id: "chimney-canopy", label: "Chimney canopy" },
  { id: "inclined-glass", label: "Inclined glass" },
] as const;

/** Wall-mounted extraction hood; bottom Y=0, wall Z=0, front +Z. */
export function KitchenHood({
  size = KITCHEN_HOOD_SIZE,
  variant = "chimney-canopy",
}: { size?: SceneItemSize; variant?: string } = {}) {
  const inclined = variant === "inclined-glass";
  return (
    <group name="kitchen-hood" scale={[size[0] / 0.6, size[1] / 0.7, size[2] / 0.5]}>
      <RoundedFurniturePanel
        name="hood-fascia"
        size={[0.6, 0.046, 0.494]}
        position={[0, 0.027, 0.247]}
        radius={0.004}
        color={inclined ? "#43494b" : "#b5baba"}
        outlineColor="#747c7e"
      />
      <HoodShell inclined={inclined} />
      <RoundedFurniturePanel
        name="extraction-chimney"
        size={[0.22, 0.46, 0.18]}
        position={[0, 0.47, 0.09]}
        radius={0.003}
        color="#b5baba"
        outlineColor="#747c7e"
      />
      {[-0.16, -0.096, -0.032, 0.032, 0.096, 0.16].map((x) => (
        <mesh key={x} name="intake-grille" position={[x, 0.002, 0.25]}>
          <boxGeometry args={[0.035, 0.004, 0.32]} />
          <ToonMaterial color="#626b6d" />
        </mesh>
      ))}
      {[-0.035, 0, 0.035].map((x) => (
        <mesh key={x} name="hood-control" position={[x, 0.026, 0.496]}>
          <boxGeometry args={[0.016, 0.012, 0.008]} />
          <ToonMaterial color="#596467" />
        </mesh>
      ))}
    </group>
  );
}

/** A rectangular tapered canopy, or the continuous sloping face of a glass hood. */
function HoodShell({ inclined }: { inclined: boolean }) {
  const geometry = useMemo(() => {
    const topWidth = inclined ? 0.3 : 0.11;
    const topY = inclined ? 0.5 : 0.26;
    const topDepth = inclined ? 0.22 : 0.18;
    const vertices = [
      [-0.295, 0.04, 0],
      [0.295, 0.04, 0],
      [0.295, 0.04, 0.49],
      [-0.295, 0.04, 0.49],
      [-topWidth, topY, 0],
      [topWidth, topY, 0],
      [topWidth, topY, topDepth],
      [-topWidth, topY, topDepth],
    ];
    const faces = [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3,
      0, 4, 3, 4, 7,
    ];
    for (let i = 0; i < faces.length; i += 3) {
      [faces[i + 1], faces[i + 2]] = [faces[i + 2]!, faces[i + 1]!];
    }
    const result = new BufferGeometry();
    result.setAttribute(
      "position",
      new Float32BufferAttribute(
        faces.flatMap((i) => vertices[i]!),
        3,
      ),
    );
    result.computeVertexNormals();
    return result;
  }, [inclined]);
  return (
    <mesh
      name={inclined ? "sloping-glass-shell" : "pyramidal-canopy"}
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <ToonMaterial color={inclined ? "#37464b" : "#b5baba"} />
      <Outlines color={inclined ? "#253338" : "#747c7e"} thickness={0.0015} screenspace={false} />
    </mesh>
  );
}
