import type { PetPoint } from "./roaming";

/** Room presence is enough: no perception system or camera-direction dependency. */
export function petAttention(
  pet: PetPoint,
  visitor: PetPoint,
  petRoom: string | undefined,
  visitorRoom: string | undefined,
  walking: boolean,
) {
  if (!walking || !petRoom || petRoom !== visitorRoom) return null;
  const dx = pet.x - visitor.x,
    dz = pet.z - visitor.z;
  const distance = Math.hypot(dx, dz);
  // Leave space for the user; don't oscillate or walk through their feet.
  return {
    target:
      distance <= 1
        ? { ...pet }
        : {
            x: visitor.x + dx / distance,
            z: visitor.z + dz / distance,
          },
  };
}
