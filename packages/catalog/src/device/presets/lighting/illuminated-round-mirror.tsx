import { ToonMaterial, lightBrightnessRatio } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { silveredFace } from "./silvered-mirror-face";
import { StatusBeacon } from "../../visuals/device-visual-state";
import { connectedLightFinish } from "./connected-light-finish";
import { turnedProfile } from "../../visuals/turned-profile";

export const ILLUMINATED_ROUND_MIRROR_SIZE = [0.8, 0.8, 0.045] as const;

const housing = turnedProfile(
  [
    [0, 0],
    [0.389, 0],
    [0.4, 0.008],
    [0.4, 0.04],
    [0.396, 0.045],
    [0.391, 0.045],
    [0.389, 0.036],
    [0.363, 0.036],
    [0.359, 0.032],
    [0, 0.032],
  ],
  48,
).rotateX(Math.PI / 2);
const diffuser = turnedProfile(
  [
    [0.362, 0.035],
    [0.391, 0.035],
    [0.39, 0.04],
    [0.386, 0.042],
    [0.366, 0.042],
    [0.362, 0.039],
    [0.362, 0.035],
  ],
  48,
).rotateX(Math.PI / 2);
export function IlluminatedRoundMirrorModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightFinish(visualState);
  return (
    <group name="catalog-illuminated-round-mirror">
      <group position={[0, 0.4, 0]}>
        <mesh name="mirror-aluminum-rim" geometry={housing} castShadow>
          <ToonMaterial color="#b6b9b5" />
        </mesh>
        <mesh name="mirror-silvered-face" geometry={silveredFace}>
          <ToonMaterial color="white" vertexColors />
        </mesh>
        <mesh name="illuminated-mirror-light-ring" geometry={diffuser}>
          <ToonMaterial
            color={finish.color}
            emissive="#f5dba1"
            emissiveIntensity={finish.emissiveIntensity * lightBrightnessRatio(state)}
          />
        </mesh>
      </group>
      <StatusBeacon visualState={visualState} position={[0, 0.08, 0.0355]} scale={0.15} />
    </group>
  );
}
