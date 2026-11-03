import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { CozyBedCover } from "./cozy-bed-cover";

export function CozySingleHeadboard() {
  const rail = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(-0.46, 0.59, -1.015),
          new Vector3(-0.43, 0.78, -1.015),
          new Vector3(-0.22, 0.83, -1.015),
          new Vector3(0, 0.925, -1.015),
          new Vector3(0.22, 0.83, -1.015),
          new Vector3(0.43, 0.78, -1.015),
          new Vector3(0.46, 0.59, -1.015),
        ]),
        40,
        0.025,
        8,
        false,
      ),
    [],
  );
  useEffect(() => () => rail.dispose(), [rail]);
  return (
    <group>
      {[-0.47, 0.47].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.06, 0.74, 0.065]}
          position={[x, 0.49, -1.0175]}
          color="#b1855c"
          radius={0.018}
        />
      ))}
      <RoundedFurniturePanel
        size={[0.86, 0.28, 0.045]}
        position={[0, 0.66, -1.01]}
        color="#d5b88d"
        radius={0.06}
      />
      <mesh geometry={rail} castShadow>
        <ToonMaterial color="#b1855c" />
      </mesh>
      {[-0.3, -0.15, 0, 0.15, 0.3].map((x) => (
        <RoundedFurniturePanel
          key={x}
          size={[0.018, 0.22, 0.02]}
          position={[x, 0.7, -0.978]}
          color="#bc986d"
          radius={0.007}
        />
      ))}
    </group>
  );
}
export function CozySingleBedding({
  variant,
  color,
}: {
  variant: string;
  color?: string | undefined;
}) {
  const rose = variant === "rose";
  return (
    <group>
      <group scale={[0.56, 1, 0.97]}>
        <CozyBedCover
          soft
          name="single-linen-duvet"
          back={-0.57}
          front={1.06}
          lift={0}
          thickness={0.04}
          color={color ?? (rose ? "#dcb5a9" : "#9ba888")}
        />
        <CozyBedCover
          soft
          name="single-clay-foot-throw"
          back={0.64}
          front={1.063}
          lift={0.028}
          thickness={0.018}
          color="#b78162"
        />
      </group>
      <RoundedFurniturePanel
        name="single-ivory-sleeping-pillow"
        size={[0.65, 0.14, 0.38]}
        position={[0, 0.62, -0.7]}
        radius={0.065}
        color={color ?? "#f0e6d5"}
      />
      <RoundedFurniturePanel
        name="single-layered-ivory-pillow"
        size={[0.51, 0.14, 0.37]}
        position={[0, 0.75, -0.59]}
        rotation={[0.85, 0, 0]}
        radius={0.06}
        color="#eee0ca"
      />
      <RoundedFurniturePanel
        name="single-blush-lumbar-cushion"
        size={[0.36, 0.13, 0.24]}
        position={[0, 0.69, -0.32]}
        rotation={[0.8, 0, 0.08]}
        radius={0.05}
        color={rose ? "#c48f7f" : "#c2a57d"}
      />
    </group>
  );
}
