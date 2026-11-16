import { ToonMaterial } from "@cabane/engine";
import { ExtrudeGeometry, Shape } from "three";
import { RoundedFurniturePanel } from "../../construction";

// Side elevation in depth/height. Both rear stile and leg are cut from
// one swept member. The mortised arm bridges the stiles at seated elbow height.
function shapedTimber(points: number[][], thickness: number) {
  const shape = new Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(-z, y) : shape.lineTo(-z, y)));
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness - 0.006,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -(thickness - 0.006) / 2);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}
const back = shapedTimber(
  [
    [-0.372, 0.003],
    [-0.327, 0.003],
    [-0.235, 0.308],
    [-0.243, 0.408],
    [-0.327, 0.837],
    [-0.376, 0.837],
    [-0.304, 0.386],
    [-0.301, 0.318],
  ],
  0.057,
);
const front = shapedTimber(
  [
    [0.305, 0.003],
    [0.351, 0.003],
    [0.308, 0.638],
    [0.25, 0.638],
    [0.263, 0.33],
  ],
  0.057,
);
const spindle = shapedTimber(
  [
    [-0.035, 0.34],
    [0.006, 0.34],
    [0.06, 0.625],
    [0.012, 0.625],
  ],
  0.032,
);

export function TeakSideFrame({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {[back, front].map((geometry, i) => (
        <mesh
          name={i === 0 ? "swept-rear-stile" : "tapered-front-stile"}
          key={i}
          geometry={geometry}
          dispose={null}
          castShadow
          receiveShadow
        >
          <ToonMaterial color="#ac8358" />
        </mesh>
      ))}
      {[-0.18, -0.06, 0.06, 0.18].map((z) => (
        <mesh
          key={z}
          name="open-arm-spindle"
          geometry={spindle}
          dispose={null}
          position={[0, 0, z]}
          castShadow
          receiveShadow
        >
          <ToonMaterial color="#b78c5c" />
        </mesh>
      ))}
      <RoundedFurniturePanel
        name="teak-armrest"
        size={[0.09, 0.054, 0.72]}
        position={[0, 0.641, -0.018]}
        color="#bc9567"
        radius={0.024}
        outlineColor="#927248"
      />
      <RoundedFurniturePanel
        name="deep-side-apron"
        size={[0.063, 0.085, 0.704]}
        position={[0, 0.325, -0.007]}
        radius={0.011}
        color="#ae8456"
        outline={false}
      />
    </group>
  );
}
