import { lightBrightnessRatio, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { connectedLightFinish } from "./connected-light-finish";

export const SMOKED_GLOBE_WALL_LIGHT_SIZE = [0.2, 0.4, 0.26] as const;

/** Brass-backed wall sconce with a smoked globe and a connected inner bulb. */
export function SmokedGlobeWallLightModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  const brightness = lightBrightnessRatio(state);

  return (
    <group name="catalog-smoked-globe-wall-light">
      <mesh name="smoked-globe-wall-light-backplate" position={[-0.065, 0.2, 0.0125]} castShadow>
        <boxGeometry args={[0.03, 0.4, 0.025]} />
        <ToonMaterial color="#b79a70" />
      </mesh>
      <mesh
        name="smoked-globe-wall-light-arm"
        position={[-0.025, 0.2, 0.08]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.013, 0.013, 0.08, 12]} />
        <ToonMaterial color="#c2a273" />
      </mesh>
      <mesh name="smoked-globe-wall-light-globe" position={[0, 0.2, 0.16]} castShadow>
        <sphereGeometry args={[0.1, 24, 16]} />
        <ToonMaterial
          color="#65645f"
          emissive="#c6a96e"
          emissiveIntensity={finish.emissiveIntensity * 0.12 * brightness}
          transparent
          opacity={0.72}
        />
      </mesh>
      <mesh name="smoked-globe-wall-light-bulb" position={[0, 0.2, 0.16]}>
        <sphereGeometry args={[0.035, 24, 12]} />
        <ToonMaterial
          color={finish.color}
          emissive="#f2c66d"
          emissiveIntensity={finish.emissiveIntensity * brightness}
        />
      </mesh>
    </group>
  );
}
