import { BufferGeometry, Float32BufferAttribute } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

// Horizontal sections run from the tucked underside through the boxing and
// rolled welt to the domed crown. One skin keeps the stitching attached.
const sections = [
  [-0.5, 0.65],
  [-0.47, 0.85],
  [-0.34, 0.96],
  [-0.16, 0.99],
  [0.1, 0.99],
  [0.17, 0.982],
  [0.2, 1],
  [0.24, 1],
  [0.275, 0.983],
  [0.37, 0.94],
  [0.47, 0.75],
  [0.5, 0.42],
];
const sides = 32;
const vertices: number[] = [];
const faces: number[] = [];
for (const [height, radius] of sections) {
  for (let side = 0; side < sides; side++) {
    const angle = (side * Math.PI * 2) / sides;
    const square = (value: number) => Math.sign(value) * Math.pow(Math.abs(value), 0.38);
    vertices.push(
      (radius * square(Math.cos(angle))) / 2,
      height,
      (radius * square(Math.sin(angle))) / 2,
    );
  }
}
for (let ring = 0; ring < sections.length - 1; ring++) {
  for (let side = 0; side < sides; side++) {
    const a = ring * sides + side;
    const b = ring * sides + ((side + 1) % sides);
    faces.push(a, a + sides, b, b, a + sides, b + sides);
  }
}
const last = sides * (sections.length - 1);
for (let i = 1; i < sides - 1; i++) faces.push(0, i, i + 1, last, last + i + 1, last + i);
const skin = new BufferGeometry();
skin.setAttribute("position", new Float32BufferAttribute(vertices, 3));
skin.setIndex(faces);
skin.computeVertexNormals();

type Triple = [number, number, number];
export function BoxedCushion({
  name,
  size,
  position,
  rotation,
  color,
  outlineColor,
}: {
  name: string;
  size: Triple;
  position: Triple;
  rotation?: Triple;
  color: string;
  outlineColor?: string;
}) {
  return (
    <mesh
      name={name}
      geometry={skin}
      dispose={null}
      scale={size}
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      castShadow
      receiveShadow
    >
      <ToonMaterial color={color} />
      {outlineColor && <Outlines color={outlineColor} thickness={0.0015} screenspace={false} />}
    </mesh>
  );
}
