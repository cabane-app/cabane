import { useEffect, useMemo } from "react";
import { DoubleSide, Vector2 } from "three";
import { lightBrightnessRatio, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../visuals/device-visual-state";
import { makeFloorLampShade } from "./floor-lamp-shade";

const profile = (points: number[][]) => points.map(([r, y]) => new Vector2(r, y));
const foot = profile([
  [0, 0],
  [0.192, 0],
  [0.204, 0.003],
  [0.208, 0.01],
  [0.208, 0.022],
  [0.202, 0.029],
  [0.179, 0.037],
  [0.157, 0.045],
  [0.095, 0.052],
  [0.058, 0.056],
  [0.051, 0.065],
  [0.051, 0.082],
  [0.057, 0.09],
  [0.057, 0.098],
  [0.047, 0.109],
  [0, 0.109],
]);
const spindle = profile([
  [0.038, 0.101],
  [0.048, 0.111],
  [0.049, 0.127],
  [0.043, 0.146],
  [0.038, 0.176],
  [0.034, 0.3],
  [0.025, 0.93],
  [0.026, 1.08],
  [0.035, 1.188],
  [0.041, 1.218],
  [0.041, 1.231],
  [0.032, 1.252],
]);
const socket = profile([
  [0.032, 1.24],
  [0.042, 1.247],
  [0.042, 1.259],
  [0.032, 1.266],
  [0.02, 1.279],
  [0.016, 1.29],
  [0.016, 1.35],
  [0.027, 1.358],
  [0.027, 1.37],
  [0.021, 1.376],
  [0.021, 1.407],
  [0.026, 1.413],
  [0.026, 1.422],
  [0, 1.422],
]);
const bulb = profile([
  [0.014, 1.416],
  [0.017, 1.437],
  [0.028, 1.451],
  [0.037, 1.465],
  [0.04, 1.482],
  [0.037, 1.498],
  [0.027, 1.51],
  [0.013, 1.518],
  [0, 1.519],
]);
const shadeColors = {
  "connected-active": "#e2cfab",
  "connected-inactive": "#e2d2b6",
  unavailable: "#c6b79f",
  disconnected: "#e8dac1",
};

export function FloorLampModel({ state, visualState }: HomeDeviceModelProps) {
  const brightness = lightBrightnessRatio(state);
  const shade = useMemo(makeFloorLampShade, []);
  useEffect(() => () => shade.dispose(), [shade]);
  return (
    <group name="catalog-floor-lamp">
      <mesh castShadow receiveShadow>
        <latheGeometry args={[foot, 32]} />
        <ToonMaterial color="#89724c" />
      </mesh>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[spindle, 16]} />
        <ToonMaterial color="#78513c" />
      </mesh>
      <mesh castShadow>
        <latheGeometry args={[socket, 16]} />
        <ToonMaterial color="#aa8d5e" />
      </mesh>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => (
        <mesh
          key={angle}
          position={[0.16 * Math.sin(angle), 1.363, 0.16 * Math.cos(angle)]}
          rotation-y={angle}
        >
          <boxGeometry args={[0.005, 0.006, 0.32]} />
          <ToonMaterial color="#927b55" />
        </mesh>
      ))}
      <mesh name="floor-lamp-bulb" userData={{ skipStaticBatch: true }}>
        <latheGeometry args={[bulb, 20]} />
        <ToonMaterial color="#fff0d4" emissive="#ffda99" emissiveIntensity={brightness} />
      </mesh>
      <mesh
        name="floor-lamp-emitter"
        geometry={shade}
        castShadow
        receiveShadow
        userData={{ skipStaticBatch: true }}
      >
        <ToonMaterial
          color={shadeColors[visualState]}
          emissive="#a28763"
          emissiveIntensity={brightness * 0.65}
          vertexColors
          side={DoubleSide}
        />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.105, 0.054, 0.085]} scale={0.6} />
    </group>
  );
}
