import { ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../visuals/device-visual-state";
import { useFanRotation } from "./use-fan-rotation";

export const VENTILATION_FAN_SIZE = [0.14, 0.3, 0.14] as const;

/** A compact consumer-facing ventilation fan. */
export function VentilationFanModel(props: HomeDeviceModelProps) {
  const rotor = useFanRotation(props, "y");

  return (
    <group name="catalog-ventilation-fan">
      <mesh name="ventilation-fan-housing" position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.067, 0.067, 0.3, 24, 1, true]} />
        <ToonMaterial color="#e8e6df" />
      </mesh>
      {[0.006, 0.15, 0.294].map((y) => (
        <mesh
          key={y}
          name={`ventilation-fan-collar-${y}`}
          position={[0, y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <torusGeometry args={[0.066, 0.004, 6, 24]} />
          <ToonMaterial color="#e8e6df" />
        </mesh>
      ))}
      <mesh name="ventilation-fan-inner-sleeve" position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.061, 0.061, 0.29, 24, 1, true]} />
        <ToonMaterial color="#9d9c95" />
      </mesh>
      <mesh name="ventilation-fan-hub" position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.02, 12]} />
        <ToonMaterial color="#b9b5aa" />
      </mesh>
      <group ref={rotor} name="fan-rotor">
        {[0, 1, 2].map((index) => (
          <group key={index} rotation={[0, (index * Math.PI * 2) / 3, 0]}>
            <mesh
              name={`ventilation-fan-blade-${index}`}
              position={[0.032, 0.15, 0]}
              rotation={[0.25, 0.35, 0]}
            >
              <boxGeometry args={[0.04, 0.003, 0.023]} />
              <ToonMaterial color="#b9b5aa" />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[0, 0.19, 0.068]} rotation={[Math.PI / 2, 0, 0]}>
        <StatusBeacon visualState={props.visualState} position={[0, 0, 0]} scale={0.1} />
      </group>
    </group>
  );
}
