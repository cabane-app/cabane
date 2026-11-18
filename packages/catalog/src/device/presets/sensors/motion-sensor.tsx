import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";
import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { turnedProfile } from "../../visuals/turned-profile";

const mount = turnedProfile(
  [
    [0, -0.001],
    [0.041, -0.001],
    [0.045, 0.002],
    [0.044, 0.009],
    [0.039, 0.013],
    [0.018, 0.013],
    [0.016, 0.018],
    [0.021, 0.026],
    [0, 0.027],
  ],
  32,
);
const shell = turnedProfile(
  [
    [0, 0.021],
    [0.031, 0.021],
    [0.046, 0.025],
    [0.061, 0.033],
    [0.069, 0.042],
    [0.07, 0.049],
    [0.068, 0.055],
    [0.061, 0.06],
    [0.053, 0.061],
    [0.05, 0.057],
  ],
  40,
);
const gasket = turnedProfile(
  [
    [0.049, 0.054],
    [0.054, 0.057],
    [0.055, 0.06],
    [0.053, 0.062],
    [0.05, 0.062],
    [0.048, 0.06],
  ],
  40,
);
// Each shallow annulus has a catchlight on its rising face and a short return.
const lens = turnedProfile(
  [
    [0.051, 0.059],
    [0.05, 0.062],
    [0.044, 0.067],
    [0.043, 0.066],
    [0.036, 0.071],
    [0.035, 0.07],
    [0.027, 0.075],
    [0.026, 0.074],
    [0.017, 0.078],
    [0.016, 0.077],
    [0.007, 0.0795],
    [0, 0.08],
  ],
  40,
);

const fresnelFacets = tintableFinishTexture(128, "pir-fresnel-panels", (u, v) => {
  const band = Math.floor(v * 6);
  const facet = (u * 16 + (band % 2) * 0.5) % 1;
  return 0.93 + 0.065 * facet;
});

export function MotionSensorModel({ visualState }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  return (
    <group name="catalog-motion-sensor">
      <group position={[0, 0.0675, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.0675 / 0.07]}>
        <mesh name="motion-mount-and-neck" geometry={mount} castShadow>
          <ToonMaterial color="#899c94" />
        </mesh>
        <mesh name="motion-housing" geometry={shell} castShadow>
          <ToonMaterial color="#e8e6d9" />
          <Outlines color="#798780" thickness={0.0008} screenspace={false} />
        </mesh>
        <mesh geometry={gasket} userData={{ skipStaticBatch: true }}>
          <ToonMaterial color={active ? palette.coral : "#4a6562"} />
        </mesh>
        <mesh geometry={lens} userData={{ skipStaticBatch: true }}>
          <ToonMaterial color={active ? "#b3dcd9" : "#cbd8d2"} map={fresnelFacets} />
        </mesh>
        <StatusBeacon visualState={visualState} position={[0, 0.0604, 0.058]} scale={0.14} />
      </group>
    </group>
  );
}
