import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";

const LIBRARY_OAK = "#80644b";
export const LIBRARY_SHADOW = "#5c4939";
const LIBRARY_BRONZE = "#a78b5a";

export function LibraryPanel({
  size,
  at,
  color = LIBRARY_OAK,
}: {
  size: [number, number, number];
  at: [number, number, number];
  color?: string;
}) {
  return (
    <RoundedFurniturePanel size={size} position={at} color={color} radius={0.004} outline={false} />
  );
}

export function LibraryBlock({
  size,
  at,
  color = LIBRARY_OAK,
}: {
  size: [number, number, number];
  at: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <ToonMaterial color={color} />
    </mesh>
  );
}

/** Recessed plinth, continuous case and two solid doors with inlaid bronze pulls. */
export function LibraryCabinetBase({
  width,
  height,
  depth,
}: {
  width: number;
  height: number;
  depth: number;
}) {
  const doorHeight = height - 0.15;
  return (
    <group>
      <LibraryBlock
        size={[width - 0.08, 0.08, depth - 0.08]}
        at={[0, 0.04, -0.01]}
        color={LIBRARY_SHADOW}
      />
      <LibraryBlock
        size={[width, height - 0.08, depth - 0.035]}
        at={[0, (height + 0.08) / 2, -0.0175]}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <LibraryPanel
            size={[(width - 0.022) / 2, doorHeight, 0.025]}
            at={[(side * width) / 4, 0.1 + doorHeight / 2, depth / 2 - 0.0225]}
          />
          <LibraryBlock
            size={[0.008, 0.14, 0.014]}
            at={[side * 0.032, height - 0.16, depth / 2 - 0.007]}
            color={LIBRARY_BRONZE}
          />
        </group>
      ))}
    </group>
  );
}
