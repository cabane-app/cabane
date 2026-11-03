import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { BicycleSaddle, BicycleTube, BicycleWheel, type Point } from "./parts";

export const BICYCLE_SIZE: SceneItemSize = [0.64, 1.1, 1.8];
const crank: Point = [0, 0.32, -0.1];
const seat: Point = [0, 0.84, -0.25];
const head: Point = [0, 0.85, 0.35];
const fork: Point = [0, 0.7, 0.4];

export function Bicycle({
  size = BICYCLE_SIZE,
  variant = "e-bike",
}: {
  size?: SceneItemSize;
  variant?: string;
}) {
  const mtb = variant === "mtb";
  const gravel = variant === "gravel";
  const paint = mtb ? "#b18b58" : gravel ? "#81938c" : "#577c78";
  const edges: [Point, Point][] = [
    [crank, seat],
    [seat, head],
    [head, fork],
    [fork, crank],
  ];
  return (
    <group scale={[size[0] / 0.64, size[1] / 1.1, size[2] / 1.8]} userData={{ walkCollider: true }}>
      <BicycleWheel z={-0.55} variant={variant} />
      <BicycleWheel z={0.55} variant={variant} />
      {edges.map(([start, end], i) => (
        <BicycleTube key={i} start={start} end={end} radius={0.024} color={paint} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <BicycleTube start={seat} end={[side * 0.05, 0.35, -0.55]} radius={0.014} color={paint} />
          <BicycleTube
            start={crank}
            end={[side * 0.05, 0.35, -0.55]}
            radius={0.014}
            color={paint}
          />
          <BicycleTube
            start={fork}
            end={mtb ? [side * 0.025, 0.525, 0.475] : [side * 0.05, 0.35, 0.55]}
            radius={mtb ? 0.026 : 0.016}
            color={paint}
          />
          {mtb && (
            <BicycleTube
              start={[side * 0.025, 0.525, 0.475]}
              end={[side * 0.05, 0.35, 0.55]}
              radius={0.017}
              color="#bdc9c6"
            />
          )}
          <BicycleTube
            start={[side * 0.08, 0.32, -0.1]}
            end={[side * 0.08, 0.32 + side * 0.12, -0.1]}
            radius={0.012}
            color="#9ca9a5"
          />
          <mesh position={[side * 0.12, 0.32 + side * 0.12, -0.1]}>
            <boxGeometry args={[0.1, 0.025, 0.075]} />
            <ToonMaterial color="#434a48" />
          </mesh>
        </group>
      ))}
      <BicycleTube
        start={[-0.08, 0.32, -0.1]}
        end={[0.08, 0.32, -0.1]}
        radius={gravel || mtb ? 0.065 : 0.09}
        color="#444f4c"
      />
      {!mtb && !gravel && (
        <BicycleTube
          start={[0, 0.39, -0.03]}
          end={[0, 0.64, 0.28]}
          radius={0.055}
          color="#344542"
        />
      )}
      <BicycleTube start={seat} end={[0, 0.985, -0.27]} radius={0.016} color="#a1aaa7" />
      <BicycleSaddle />
      {[-1, 1].map((side) => (
        <BicycleTube
          key={`chain-${side}`}
          start={[0.06, 0.35 + side * 0.025, -0.55]}
          end={[0.06, 0.32 + side * 0.06, -0.1]}
          radius={0.005}
          color="#606a66"
        />
      ))}
      <BicycleTube start={head} end={[0, 1.045, 0.29]} color="#929e9a" />
      <BicycleTube start={[0, 1.045, 0.29]} end={[0, 1.082, 0.41]} color="#929e9a" />
      <BicycleTube start={[-0.32, 1.082, 0.41]} end={[0.32, 1.082, 0.41]} color="#404b47" />
      {gravel &&
        [-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.302, 0.982, 0.41]} rotation={[0, Math.PI / 2, -Math.PI / 2]}>
              <torusGeometry args={[0.1, 0.018, 8, 16, Math.PI]} />
              <ToonMaterial color="#404b47" />
            </mesh>
            <BicycleTube
              start={[side * 0.302, 0.882, 0.41]}
              end={[side * 0.302, 0.882, 0.34]}
              color="#404b47"
            />
          </group>
        ))}
    </group>
  );
}
