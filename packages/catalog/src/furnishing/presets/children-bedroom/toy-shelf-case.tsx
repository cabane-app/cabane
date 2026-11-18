import { Outlines, ToonMaterial } from "@cabane/engine";
import { ExtrudeGeometry, Path, Shape } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const side = new Shape();
side.moveTo(-0.137, 0.003);
side.lineTo(0.137, 0.003);
side.lineTo(0.137, 1.01);
side.quadraticCurveTo(0.135, 1.028, 0.099, 1.03);
side.bezierCurveTo(0.015, 1.034, 0.002, 1.062, -0.089, 1.062);
side.lineTo(-0.137, 1.062);
side.closePath();
const grip = new Path();
grip.absarc(-0.05, 0.923, 0.014, Math.PI / 2, Math.PI * 1.5, false);
grip.absarc(0.05, 0.923, 0.014, -Math.PI / 2, Math.PI / 2, false);
grip.closePath();
side.holes.push(grip);
const end = new ExtrudeGeometry(side, {
  depth: 0.039,
  bevelEnabled: true,
  bevelSize: 0.003,
  bevelThickness: 0.003,
  bevelSegments: 1,
  curveSegments: 6,
});
end.translate(0, 0, -0.0195).rotateY(Math.PI / 2);
const boards = [0.025, 0.34, 0.67, 1].map((y) =>
  new RoundedBoxGeometry(0.418, 0.05, 0.278, 1, 0.008).translate(0, y, 0),
);
const shelves = mergeGeometries(boards);
boards.forEach((board) => board.dispose());

export function ToyShelfCase() {
  return (
    <>
      <mesh castShadow receiveShadow position={[0, 0.51, 0.132]}>
        <boxGeometry args={[0.43, 0.94, 0.025]} />
        <ToonMaterial color="#e6e0d6" />
      </mesh>
      {[-0.23, 0.23].map((x) => (
        <mesh key={x} geometry={end} position={[x, 0, 0]} castShadow receiveShadow>
          <ToonMaterial color="#f0ece4" />
          <Outlines color="#91877b" thickness={0.0012} screenspace={false} />
        </mesh>
      ))}
      <mesh geometry={shelves} castShadow receiveShadow>
        <ToonMaterial color="#f3efe7" />
      </mesh>
    </>
  );
}
