import { Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { ExtrudeGeometry, Shape } from "three";
import { RoundedFurniturePanel } from "../construction";
export const OAK_SLAB_BENCH_SIZE = [1.4, 0.45, 0.32] as const;

// The waney edge has two broad sweeps; the milled ends stay square.
const board = new Shape();
board.moveTo(-0.697, -0.146);
board.bezierCurveTo(-0.49, -0.158, -0.37, -0.157, -0.24, -0.15);
board.bezierCurveTo(-0.08, -0.137, 0.065, -0.135, 0.25, -0.148);
board.bezierCurveTo(0.43, -0.159, 0.53, -0.157, 0.697, -0.143);
board.lineTo(0.697, 0.146);
board.bezierCurveTo(0.48, 0.14, 0.29, 0.157, 0.12, 0.157);
board.bezierCurveTo(-0.11, 0.158, -0.28, 0.14, -0.47, 0.145);
board.lineTo(-0.697, 0.151);
board.closePath();
const slab = new ExtrudeGeometry(board, {
  depth: 0.048,
  bevelEnabled: true,
  bevelSize: 0.003,
  bevelThickness: 0.003,
  bevelSegments: 2,
  curveSegments: 10,
});
slab.rotateX(-Math.PI / 2);
slab.computeBoundingBox();
const envelope = slab.boundingBox!;
slab.translate(-(envelope.max.x + envelope.min.x) / 2, 0, -(envelope.max.z + envelope.min.z) / 2);
slab.scale(1.4 / (envelope.max.x - envelope.min.x), 1, 0.32 / (envelope.max.z - envelope.min.z));

export function OakSlabBench({ size = OAK_SLAB_BENCH_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="oak-slab-bench"
      scale={[size[0] / 1.4, size[1] / 0.45, size[2] / 0.32]}
      userData={{ walkCollider: true }}
    >
      <mesh
        name="bench-oak-seat"
        geometry={slab}
        dispose={null}
        position={[0, 0.399, 0]}
        castShadow
        receiveShadow
      >
        <ToonMaterial color="#b89d78" />
        <Outlines color="#897256" thickness={0.0015} screenspace={false} />
      </mesh>
      {[-0.515, 0.515].map((x) => (
        <group key={x} name="bench-steel-leg-frame">
          <RoundedFurniturePanel
            name="top-mounting-plate"
            size={[0.082, 0.016, 0.265]}
            position={[x, 0.39, 0]}
            color="#343732"
            radius={0.004}
            outline={false}
          />
          {[-1, 1].map((side) => (
            <RoundedFurniturePanel
              key={side}
              name="trapezoid-upright"
              size={[0.038, 0.377, 0.027]}
              position={[x, 0.204, 0.098 * side]}
              rotation={[-side * 0.085, 0, 0]}
              color="#292b29"
              radius={0.004}
              outline={false}
            />
          ))}
          <RoundedFurniturePanel
            name="sledge-foot"
            size={[0.038, 0.032, 0.251]}
            position={[x, 0.016, 0]}
            radius={0.005}
            color="#292b29"
            outline={false}
          />
        </group>
      ))}
    </group>
  );
}
