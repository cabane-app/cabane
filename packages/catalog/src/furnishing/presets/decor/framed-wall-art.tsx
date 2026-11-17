import { useEffect, useMemo } from "react";
import { FramedArtImage } from "./framed-art-image";
import { wallArtImage } from "./wall-art-images";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { Shape, BufferGeometry, Float32BufferAttribute } from "three";
import { RoundedFurniturePanel } from "../construction";
export const FRAMED_WALL_ART_SIZE = [0.8, 0.6, 0.04] as const;
// Each sweep segment is one mitred rail. The rounded outer lip steps down towards the mount.
function rail(side: number) {
  const points: number[] = [];
  const indices: number[] = [];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const sections = [
    [0, 0.006],
    [0, 0.034],
    [0.003, 0.039],
    [0.007, 0.04],
    [0.023, 0.04],
    [0.029, 0.036],
    [0.036, 0.029],
    [0.038, 0.028],
    [0.038, 0.018],
  ];
  for (const [inset, z] of sections) {
    for (const index of [side, (side + 1) % 4]) {
      const [x, y] = corners[index];
      points.push(x * (0.4 - inset), 0.3 + y * (0.3 - inset), z);
    }
  }
  for (let j = 0; j < sections.length - 1; j++) {
    const i = j * 2;
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function hill(top: number, crest: number, down: number) {
  const s = new Shape();
  s.moveTo(-0.325, -0.195);
  s.lineTo(-0.325, top);
  s.bezierCurveTo(-0.16, crest, 0.01, down, 0.12, down);
  s.bezierCurveTo(0.18, down, 0.26, crest + 0.02, 0.325, crest);
  s.lineTo(0.325, -0.195);
  s.closePath();
  return s;
}
const sage = hill(-0.038, 0.085, 0.026),
  ochre = hill(-0.089, 0.017, -0.11);
export function FramedWallArt({
  size = FRAMED_WALL_ART_SIZE,
  variant = "default",
  imageUrl,
}: {
  size?: SceneItemSize;
  variant?: string;
  imageUrl?: string;
}) {
  const rails = useMemo(() => [0, 1, 2, 3].map(rail), []);
  useEffect(() => () => rails.forEach((geometry) => geometry.dispose()), [rails]);
  const image = imageUrl ?? wallArtImage(variant);
  return (
    <group name="framed-wall-art" scale={[size[0] / 0.8, size[1] / 0.6, size[2] / 0.04]}>
      <RoundedFurniturePanel
        name="wall-art-backing"
        size={[0.79, 0.59, 0.016]}
        position={[0, 0.3, 0.008]}
        color="#aa8359"
        radius={0.003}
        outline={false}
      />
      {rails.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <ToonMaterial color={["#b88e5e", "#c0996c", "#c8a575", "#bb9266"][i]} />
        </mesh>
      ))}
      <RoundedFurniturePanel
        name="wall-art-canvas"
        size={[0.744, 0.544, 0.012]}
        position={[0, 0.3, 0.019]}
        color="#eee8da"
        radius={0.002}
        outline={false}
      />
      {image ? (
        <group position={[0, 0.3, 0.028]} scale={[0.8 / size[0], 0.6 / size[1], 1]}>
          <FramedArtImage key={image} src={image} width={size[0] * 0.85} height={size[1] * 0.8} />
        </group>
      ) : (
        <group position={[0, 0.3, 0]}>
          <mesh name="wall-art-sun" position={[-0.132, 0.065, 0.0275]}>
            <circleGeometry args={[0.082, 40]} />
            <ToonMaterial color="#c88762" />
          </mesh>
          <mesh name="wall-art-sage-plane" position={[0, 0, 0.029]}>
            <shapeGeometry args={[sage, 16]} />
            <ToonMaterial color="#8f9c86" />
          </mesh>
          <mesh name="wall-art-earth-plane" position={[0, 0, 0.031]}>
            <shapeGeometry args={[ochre, 16]} />
            <ToonMaterial color="#b9a07c" />
          </mesh>
        </group>
      )}
    </group>
  );
}
