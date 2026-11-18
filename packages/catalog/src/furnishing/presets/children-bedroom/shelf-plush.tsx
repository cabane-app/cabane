import { type BufferGeometry, SphereGeometry } from "three";
import { CabinetPiece, joinCabinetParts } from "../construction/cabinet-joinery";
import { linenWeaveTexture } from "../construction/linen-weave-texture";

function oval(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  small = false,
) {
  return new SphereGeometry(1, small ? 8 : 10, small ? 4 : 6)
    .scale(width, height, depth)
    .translate(x, y, z);
}

// Seated teddy facing out into the room (+X), with ears splayed across the shelf.
const plush = joinCabinetParts([
  oval(0, 0.077, 0, 0.058, 0.077, 0.055),
  oval(0.005, 0.168, 0, 0.054, 0.051, 0.054),
  ...[-1, 1].map((side) => oval(0, 0.204, side * 0.04, 0.016, 0.02, 0.019)),
]);
const muzzle = oval(0.051, 0.159, 0, 0.017, 0.019, 0.024, true);
const face = joinCabinetParts([
  oval(0.066, 0.166, 0, 0.006, 0.005, 0.008, true),
  ...[-1, 1].map((side) => oval(0.051, 0.18, side * 0.023, 0.004, 0.005, 0.004, true)),
]);

type ShelfToy = { position: [number, number, number]; color: string };

export function seatedBears(toys: ShelfToy[]) {
  function repeat(detail: BufferGeometry) {
    return joinCabinetParts(toys.map(({ position }) => detail.clone().translate(...position)));
  }
  const muzzles = repeat(muzzle);
  const features = repeat(face);
  return (
    <group>
      {toys.map(({ position, color }) => (
        <group key={color} position={position}>
          <CabinetPiece geometry={plush} color={color} map={linenWeaveTexture} />
        </group>
      ))}
      <CabinetPiece geometry={muzzles} color="#e9cdb0" />
      <CabinetPiece geometry={features} color="#69544c" />
    </group>
  );
}
