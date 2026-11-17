import type { RefObject } from "react";
import type { Group } from "three";
import { BlasterBarrel, BlasterGrip, BlasterReceiver } from "./laser-gun";

import { BlasterHand } from "./laser-gun/BlasterHand";

/** Layered toy blaster, built entirely from procedural toon geometry. */
export function LaserGun({
  muzzleRef,
  shotId = 0,
}: {
  muzzleRef?: RefObject<Group | null>;
  shotId?: number;
}) {
  return (
    <group
      name="cartoon-laser-gun"
      userData={{ walkToolVisual: true }}
      rotation={[0, 0.42, -0.105]}
    >
      <BlasterReceiver />
      <BlasterBarrel muzzleRef={muzzleRef} shotId={shotId} />
      <BlasterGrip />
      <BlasterHand />
    </group>
  );
}
