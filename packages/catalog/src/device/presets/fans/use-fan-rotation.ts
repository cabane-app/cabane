import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { fanSpeedFactor } from "./fan-operation";

/** Shared demand-frame rotation for fan geometry on either motor axis. */
export function useFanRotation(
  props: Pick<HomeDeviceModelProps, "state" | "visualState" | "reducedMotion">,
  axis: "y" | "z",
) {
  const rotor = useRef<Group>(null);
  const speed = fanSpeedFactor(props);
  useFrame(({ invalidate }, delta) => {
    if (!rotor.current || props.reducedMotion || speed === 0) return;
    rotor.current.rotation[axis] =
      (rotor.current.rotation[axis] - Math.min(delta, 0.05) * speed * 12) % (Math.PI * 2);
    invalidate();
  });
  return rotor;
}
