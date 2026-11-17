import { useEffect, useMemo } from "react";
import { JoineryMaterial, type GardenGateVariant, type DoorFinish } from "@cabane/engine";
import { gardenGateBody, gardenGateIronwork } from "./garden-gate-geometry";

export function DetailedGardenGate({
  variant,
  width,
  height,
  color,
  finish,
  handleSide,
}: {
  variant: GardenGateVariant;
  width: number;
  height: number;
  color: string;
  finish: DoorFinish;
  handleSide: -1 | 1;
}) {
  const body = useMemo(
    () => gardenGateBody(variant, width, height, handleSide),
    [variant, width, height, handleSide],
  );
  const hardware = useMemo(
    () => gardenGateIronwork(variant, width, height, handleSide),
    [variant, width, height, handleSide],
  );
  useEffect(
    () => () => {
      body.dispose();
      hardware.dispose();
    },
    [body, hardware],
  );
  return (
    <group name={`opening-leaf-${variant}`}>
      <mesh name="opening-gate-members" geometry={body} castShadow receiveShadow>
        <JoineryMaterial
          finish={variant === "garden-wood" && finish === "wood" ? "wood" : "paint"}
          color={color}
        />
      </mesh>
      <mesh name="opening-gate-ironwork" geometry={hardware} castShadow receiveShadow>
        <JoineryMaterial finish="metal" color="#474a45" />
      </mesh>
    </group>
  );
}
