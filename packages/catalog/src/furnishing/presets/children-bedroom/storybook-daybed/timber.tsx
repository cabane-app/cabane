import { Shape, Vector2, Vector3, TubeGeometry, CatmullRomCurve3 } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";
import { oakGrainTexture } from "../../construction/oak-grain-texture";
import { WOOD, WOOD_DARK, WOOD_LIGHT } from "./finish";

export const headRibs = [
  { z: -1.105, crown: 1.67 },
  { z: -0.61, crown: 1.57 },
];

export function archPoint(angle: number, crown: number) {
  return new Vector2(0.533 * Math.cos(angle), 0.91 + (crown - 0.91) * Math.sin(angle));
}

function bentwoodRib(crown: number) {
  const points = [new Vector3(0.533, 0.22, 0)];
  for (let step = 0; step <= 24; step++) {
    const point = archPoint((step / 24) * Math.PI, crown);
    points.push(new Vector3(point.x, point.y, 0));
  }
  points.push(new Vector3(-0.533, 0.22, 0));
  return new TubeGeometry(new CatmullRomCurve3(points), 60, 0.026, 8, false);
}

const ribs = headRibs.map(({ crown }) => bentwoodRib(crown));

function endBoard(head: boolean) {
  const h = head ? 0.8 : 0.46;
  const shape = new Shape();
  shape.moveTo(-0.56, 0.155);
  shape.lineTo(0.56, 0.155);
  shape.lineTo(0.56, h - 0.13);
  shape.bezierCurveTo(0.56, h + 0.035, 0.43, h + 0.035, 0.34, h - 0.035);
  shape.bezierCurveTo(0.18, h - 0.15, -0.18, h - 0.15, -0.34, h - 0.035);
  shape.bezierCurveTo(-0.43, h + 0.035, -0.56, h + 0.035, -0.56, h - 0.13);
  shape.closePath();
  return shape;
}
const ends = [endBoard(true), endBoard(false)];

export function TimberFrame() {
  return (
    <>
      {headRibs.map(({ z }, i) => (
        <mesh
          key={z}
          name="bentwood-reading-hood-rib"
          position={[0, 0, z]}
          geometry={ribs[i]}
          castShadow
        >
          <ToonMaterial color={WOOD_LIGHT} map={oakGrainTexture} />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh
          key={side}
          name="scooped-bed-end"
          position={[0, 0, side * 1.185 - 0.025]}
          castShadow
          receiveShadow
        >
          <extrudeGeometry
            args={[
              ends[i],
              {
                depth: 0.05,
                bevelThickness: 0.006,
                bevelSize: 0.006,
                bevelSegments: 2,
                curveSegments: 12,
              },
            ]}
          />
          <ToonMaterial color={WOOD} map={oakGrainTexture} />
          <Outlines thickness={0.0012} color={WOOD_DARK} screenspace={false} />
        </mesh>
      ))}
      {[-0.53, 0.53].map((x) => (
        <group key={x}>
          <mesh
            name="daybed-apron"
            position={[x, 0.24, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.063, 2.35, 0.15]} />
            <ToonMaterial color={WOOD} map={oakGrainTexture} />
          </mesh>
          {[-1.126, 1.126].map((z) => (
            <mesh key={z} name="turned-daybed-foot" position={[x, 0.106, z]} castShadow>
              <cylinderGeometry args={[0.051, 0.034, 0.212, 12]} />
              <ToonMaterial color={WOOD_LIGHT} map={oakGrainTexture} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
