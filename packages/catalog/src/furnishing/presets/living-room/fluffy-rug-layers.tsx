import { useEffect, useMemo } from "react";
import { PlaneGeometry } from "three";
import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

/** Fine, irregular white pile without a contrasting border or printed motif. */
export function FluffyRugLayers({ color }: { color?: string | undefined }) {
  const pile = useMemo(() => {
    const geometry = new PlaneGeometry(1.99, 2.99, 80, 120);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const edge = Math.min(1, (0.995 - Math.abs(x)) * 40, (1.495 - Math.abs(z)) * 40);
      const fiber = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
      positions.setY(
        index,
        0.011 + Math.max(0, edge) * (0.002 + (fiber - Math.floor(fiber)) * 0.002),
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => pile.dispose(), [pile]);
  return (
    <>
      <RoundedFurniturePanel
        name="area-rug-fluffy-base"
        size={[2, 0.011, 3]}
        position={[0, 0.0055, 0]}
        color={color ?? "#ffffff"}
        radius={0.005}
        outline={false}
      />
      <mesh name="area-rug-fluffy-pile" geometry={pile} receiveShadow>
        <ToonMaterial color={color ?? "#ffffff"} />
      </mesh>
    </>
  );
}
