import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, LatheGeometry, TubeGeometry, Vector2, Vector3 } from "three";
import {
  lightBrightnessRatio,
  Outlines,
  ToonMaterial,
  type HomeDeviceModelProps,
} from "@cabane/engine";
import { LampArm, LampSpring } from "./arm";

export const ADJUSTABLE_DESK_LAMP_SIZE = [0.22, 0.713423, 0.563166] as const;
const joints = [
  [0, 0.085, -0.06],
  [0, 0.405, -0.21],
  [0, 0.645, 0.16],
] as const;

/** White spring-balanced task lamp, in a fixed articulated working pose. */
export function AdjustableDeskLampModel({ state, visualState }: HomeDeviceModelProps) {
  const glow = visualState === "connected-active" ? lightBrightnessRatio(state) * 0.8 : 0;
  const shade = useMemo(
    () =>
      new LatheGeometry(
        [
          [0.091, 0],
          [0.092, 0.004],
          [0.087, 0.028],
          [0.073, 0.056],
          [0.052, 0.083],
          [0.032, 0.105],
          [0.029, 0.125],
          [0.029, 0.158],
          [0.024, 0.168],
          [0, 0.171],
        ].map(([x, y]) => new Vector2(x, y)),
        32,
      ),
    [],
  );
  const cable = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0.009, 0.64, 0.115),
          new Vector3(0.009, 0.708, 0.148),
          new Vector3(0.009, 0.7, 0.205),
          new Vector3(0.009, 0.675, 0.215),
        ]),
        16,
        0.0025,
        6,
        false,
      ),
    [],
  );
  useEffect(
    () => () => {
      shade.dispose();
      cable.dispose();
    },
    [shade, cable],
  );
  return (
    <group name={`adjustable-desk-lamp-${visualState}`} position={[0, 0, -0.053583]}>
      <mesh name="desk-lamp-weighted-base" position={[0, 0.018, -0.07]} castShadow>
        <cylinderGeometry args={[0.105, 0.11, 0.036, 40]} />
        <ToonMaterial color="#ecebe3" />
        <Outlines color="#868880" thickness={0.0008} screenspace={false} />
      </mesh>
      <mesh name="desk-lamp-base-socket" position={[0, 0.054, -0.06]} castShadow>
        <cylinderGeometry args={[0.016, 0.019, 0.055, 16]} />
        <ToonMaterial color="#d1d2cc" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <LampSpring side={side} />
          <LampArm
            name={`lower-arm-${side}`}
            start={[side * 0.018, 0.085, -0.06]}
            end={[side * 0.018, 0.405, -0.21]}
            width={0.008}
            depth={0.014}
          />
          <LampArm
            name={`upper-arm-${side}`}
            start={[side * 0.018, 0.405, -0.21]}
            end={[side * 0.018, 0.645, 0.16]}
            width={0.008}
            depth={0.014}
          />
          <LampArm
            name={`balance-strut-${side}`}
            start={[side * 0.029, 0.103, -0.052]}
            end={[side * 0.029, 0.26, -0.14]}
            width={0.006}
            depth={0.007}
            color="#a4a6a0"
          />
        </group>
      ))}
      {joints.map((point, index) => (
        <group key={index} position={[...point]}>
          <mesh name={`desk-lamp-pivot-${index}`} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.053, 16]} />
            <ToonMaterial color="#d5d6cf" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              name={`desk-lamp-bolt-${index}-${side}`}
              position={[side * 0.029, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
              <ToonMaterial color="#8f938d" />
            </mesh>
          ))}
        </group>
      ))}
      <LampArm
        name="desk-lamp-shade-bracket"
        start={[0, 0.645, 0.16]}
        end={[0, 0.647, 0.229]}
        width={0.011}
        depth={0.012}
        color="#a4a6a0"
      />
      <mesh name="desk-lamp-loop-cable" geometry={cable}>
        <ToonMaterial color="#b2b3aa" />
      </mesh>
      <group position={[0, 0.51, 0.245]} rotation={[-0.2, 0, 0]}>
        <mesh name="desk-lamp-bell-shade" geometry={shade} castShadow receiveShadow>
          <ToonMaterial color="#e9eae4" side={2} />
          <Outlines color="#898c84" thickness={0.0008} screenspace={false} />
        </mesh>
        <mesh name="desk-lamp-reflector" position={[0, 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.088, 32]} />
          <ToonMaterial color="#fff6da" emissive="#ffe2a4" emissiveIntensity={glow} side={2} />
        </mesh>
        {Array.from({ length: 10 }, (_, index) => {
          const angle = (index * Math.PI * 2) / 10;
          return (
            <mesh
              key={index}
              name={`desk-lamp-vent-${index}`}
              position={[Math.sin(angle) * 0.0293, 0.142, Math.cos(angle) * 0.0293]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.003, 0.022, 0.001]} />
              <ToonMaterial color="#777c76" />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
