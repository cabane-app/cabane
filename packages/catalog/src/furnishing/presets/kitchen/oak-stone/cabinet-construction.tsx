import { ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel } from "../../construction";

const OAK = "#79604b";
export const STONE = "#ded8c8";
export const BRONZE = "#9b8053";

export function CabinetPanel({
  name,
  size,
  at,
  color = OAK,
  rounded = false,
}: {
  name: string;
  size: [number, number, number];
  at: [number, number, number];
  color?: string;
  rounded?: boolean;
}) {
  return rounded ? (
    <RoundedFurniturePanel
      name={name}
      size={size}
      position={at}
      color={color}
      radius={0.006}
      outlineColor="#5e5143"
    />
  ) : (
    <mesh name={name} position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <ToonMaterial color={color} />
    </mesh>
  );
}

/** Hollow cabinet shell: a real recessed toe kick, side panels and back. */
export function OakCabinetCase({
  width = 1.2,
  height = 0.88,
  depth = 0.64,
}: {
  width?: number;
  height?: number;
  depth?: number;
}) {
  return (
    <group>
      <CabinetPanel
        name="recessed-toe-kick"
        size={[width - 0.1, 0.1, depth - 0.1]}
        at={[0, 0.05, -0.025]}
        color="#493f35"
      />
      {[-1, 1].map((sign) => (
        <CabinetPanel
          key={sign}
          name="oak-case-side"
          size={[0.025, height - 0.1, depth]}
          at={[sign * (width / 2 - 0.0125), (height + 0.1) / 2, 0]}
        />
      ))}
      <CabinetPanel
        name="oak-case-back"
        size={[width - 0.05, height - 0.1, 0.022]}
        at={[0, (height + 0.1) / 2, -depth / 2 + 0.011]}
      />
      <CabinetPanel
        name="oak-case-bottom"
        size={[width - 0.05, 0.025, depth - 0.022]}
        at={[0, 0.1125, 0.011]}
      />
    </group>
  );
}

export function OakDrawerFront({
  width,
  y,
  height,
  x = 0,
  z = 0.311,
}: {
  width: number;
  y: number;
  height: number;
  x?: number;
  z?: number;
}) {
  return (
    <group>
      <CabinetPanel name="oak-drawer-front" size={[width, height, 0.026]} at={[x, y, z]} rounded />
      <CabinetPanel
        name="bronze-edge-pull"
        size={[Math.min(width * 0.55, 0.46), 0.012, 0.027]}
        at={[x, y + height / 2 - 0.018, z + 0.019]}
        color={BRONZE}
      />
    </group>
  );
}
