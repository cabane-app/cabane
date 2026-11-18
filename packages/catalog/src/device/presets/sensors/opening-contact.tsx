import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";

const receiverPad = new RoundedBoxGeometry(0.07, 0.111, 0.016, 2, 0.007);
const receiverCap = new RoundedBoxGeometry(0.071, 0.112, 0.038, 2, 0.014);
const magnetPad = new RoundedBoxGeometry(0.029, 0.083, 0.015, 2, 0.007);
const magnetCap = new RoundedBoxGeometry(0.03, 0.084, 0.025, 2, 0.012);
const indexMark = new RoundedBoxGeometry(0.011, 0.0025, 0.002, 1, 0.0009);

export function OpeningContactModel({ visualState }: HomeDeviceModelProps) {
  const open = visualState === "connected-active";
  return (
    <group name="catalog-opening-contact">
      <group position={[-0.0395, 0.056, 0]}>
        <mesh name="contact-receiver-pad" geometry={receiverPad} position-z={0.007} castShadow>
          <ToonMaterial color="#627873" />
        </mesh>
        <mesh name="contact-receiver-cap" geometry={receiverCap} position-z={0.023} castShadow>
          <ToonMaterial color="#ece8d9" />
          <Outlines color="#7b857c" thickness={0.00065} screenspace={false} />
        </mesh>
        <mesh geometry={indexMark} position={[0.017, -0.005, 0.042]}>
          <ToonMaterial color="#63877e" />
        </mesh>
        <group rotation-x={Math.PI / 2}>
          <StatusBeacon visualState={visualState} position={[-0.009, 0.042, -0.032]} scale={0.16} />
        </group>
      </group>
      <group name="contact-magnet" position={[open ? 0.06 : 0.016, 0.056, 0]}>
        <mesh
          userData={{ skipStaticBatch: true }}
          geometry={magnetPad}
          position-z={0.0065}
          castShadow
        >
          <ToonMaterial color="#627873" />
        </mesh>
        <mesh
          userData={{ skipStaticBatch: true }}
          geometry={magnetCap}
          position-z={0.019}
          castShadow
        >
          <ToonMaterial color={open ? palette.coral : "#bed1c3"} />
        </mesh>
        <mesh
          userData={{ skipStaticBatch: true }}
          geometry={indexMark}
          position={[-0.001, -0.005, 0.0315]}
        >
          <ToonMaterial color="#617c73" />
        </mesh>
      </group>
    </group>
  );
}
