import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { fanSpeedFactor } from "./fan-operation";
import { useFanRotation } from "./use-fan-rotation";

/** Swept, rounded blades in the XY plane, turning about the motor's Z axis. */
export function FanRotor({
  radius,
  count,
  color,
  state,
  visualState,
  reducedMotion,
  castMovingShadows = true,
}: {
  radius: number;
  count: number;
  color: string;
  castMovingShadows?: boolean;
} & Pick<HomeDeviceModelProps, "state" | "visualState" | "reducedMotion">) {
  const motion = { ...(state === undefined ? {} : { state }), visualState, reducedMotion };
  const rotor = useFanRotation(motion, "z");
  const castShadow = castMovingShadows || reducedMotion || fanSpeedFactor(motion) === 0;
  const geometry = useMemo(() => {
    const blade = new Shape();
    blade.moveTo(radius * 0.12, -radius * 0.07);
    blade.quadraticCurveTo(radius * 0.55, -radius * 0.22, radius * 0.85, -radius * 0.14);
    blade.quadraticCurveTo(radius, -radius * 0.1, radius, 0);
    blade.quadraticCurveTo(radius * 0.96, radius * 0.16, radius * 0.78, radius * 0.18);
    blade.lineTo(radius * 0.16, radius * 0.09);
    blade.closePath();
    const result = new ExtrudeGeometry(blade, {
      depth: radius * 0.03,
      bevelEnabled: false,
      curveSegments: 4,
      steps: 1,
    });
    result.translate(0, 0, -radius * 0.015);
    return result;
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group ref={rotor} name="fan-rotor">
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          name={`fan-blade-${index}`}
          geometry={geometry}
          rotation={[0, 0, (index * Math.PI * 2) / count]}
          castShadow={castShadow}
        >
          <ToonMaterial color={color} />
          <Outlines color="#52605b" thickness={0.0015} screenspace={false} />
        </mesh>
      ))}
    </group>
  );
}
