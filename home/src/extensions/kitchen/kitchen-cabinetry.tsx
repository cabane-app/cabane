import { ToonMaterial } from "@cabane/engine";
import { BrassCabinetHandle } from "./brass-cabinet-handle";
import {
  KITCHEN_CREAM,
  KITCHEN_CREAM_LIGHT,
  KITCHEN_STONE,
  KitchenBox,
  KitchenPanel,
} from "./kitchen-finish";
import { KitchenWorktop } from "./kitchen-worktop";

export const KITCHEN_CEILING_MOUNT_OFFSET = 0.55;
const UPPER_CABINET_HEIGHT = 0.66;
const UPPER_CABINET_CENTER_Y = 1.35 + KITCHEN_CEILING_MOUNT_OFFSET;
const UPPER_CABINET_BOTTOM_Y = UPPER_CABINET_CENTER_Y - UPPER_CABINET_HEIGHT / 2;
const UPPER_CABINET_TOP_Y = UPPER_CABINET_BOTTOM_Y + UPPER_CABINET_HEIGHT;
export const UNDER_CABINET_STRIP_Y = UPPER_CABINET_BOTTOM_Y - 0.015;

const TALL_PANTRY_HEIGHT = UPPER_CABINET_TOP_Y;

const baseCabinets = [
  { center: 1.09, width: 0.58, kind: "oven" },
  { center: 1.71, width: 0.66, kind: "door" },
  { center: 2.37, width: 0.66, kind: "door" },
  { center: 3.03, width: 0.66, kind: "door" },
  { center: 3.535, width: 0.35, kind: "door" },
] as const;

export const upperCabinets = [
  { center: 1.115, width: 0.67, kind: "solid" },
  { center: 1.64, width: 0.38, kind: "solid" },
  { center: 2.11, width: 0.56, kind: "microwave" },
  { center: 2.56, width: 0.34, kind: "glass", handleSide: 1 },
  { center: 2.9, width: 0.34, kind: "glass", handleSide: -1 },
  { center: 3.2, width: 0.26, kind: "glass", handleSide: 1 },
  { center: 3.46, width: 0.26, kind: "glass", handleSide: -1 },
  { center: 3.705, width: 0.23, kind: "solid" },
] as const;

function TallPantry() {
  return (
    <group name="colonne-garde-manger" position={[0.42, 0, 0.3]}>
      <KitchenBox
        size={[0.72, TALL_PANTRY_HEIGHT, 0.54]}
        position={[0, TALL_PANTRY_HEIGHT / 2, 0]}
        color={KITCHEN_CREAM}
      />
      <KitchenPanel width={0.694} height={1.284} position={[0, 0.735, 0.278]} />
      <KitchenPanel width={0.694} height={0.827} position={[0, 1.7985, 0.278]} />
      <BrassCabinetHandle position={[0.256, 1.24, 0.319]} vertical />
      <BrassCabinetHandle position={[0.256, 1.523, 0.319]} vertical />
    </group>
  );
}

function GlazedUpperDoor({
  width,
  position,
}: {
  readonly width: number;
  readonly position: readonly [number, number, number];
}) {
  const height = 0.64;
  const frame = 0.028;

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.021]}>
        <boxGeometry args={[width - 0.035, height - 0.035, 0.032]} />
        <ToonMaterial color="#69685f" />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <boxGeometry args={[width - 0.045, height - 0.045, 0.008]} />
        <ToonMaterial color="#c9cfca" transparent opacity={0.24} depthWrite={false} side={2} />
      </mesh>
      {[-1, 1].map((side) => (
        <KitchenBox
          key={`vertical-${side}`}
          size={[frame, height, 0.07]}
          position={[side * (width / 2 - frame / 2), 0, -0.004]}
          color={KITCHEN_CREAM_LIGHT}
          outline="#a49c90"
        />
      ))}
      {[-1, 1].map((side) => (
        <KitchenBox
          key={`edge-${side}`}
          size={[width - frame * 2, frame, 0.026]}
          position={[0, side * (height / 2 - frame / 2), 0.018]}
          color={KITCHEN_CREAM_LIGHT}
          outline="#a49c90"
        />
      ))}
      <KitchenBox
        size={[frame * 0.8, height - frame * 2, 0.024]}
        position={[0, 0, 0.02]}
        color={KITCHEN_CREAM_LIGHT}
        outline="#a49c90"
      />
      {[-1, 1].map((row) => (
        <KitchenBox
          key={`row-${row}`}
          size={[width - frame * 2, frame * 0.8, 0.018]}
          position={[0, row * (height / 6), 0.02]}
          color={KITCHEN_CREAM_LIGHT}
          outline="#a49c90"
        />
      ))}
    </group>
  );
}

function BaseDoor({ center, width }: { readonly center: number; readonly width: number }) {
  return (
    <group position={[center, 0, 0.31]}>
      <KitchenPanel width={width - 0.008} height={0.536} position={[0, 0.367, 0.291]} />
      <KitchenPanel width={width - 0.008} height={0.181} position={[0, 0.732, 0.291]} />
      <BrassCabinetHandle position={[0, 0.735, 0.331]} />
      <BrassCabinetHandle position={[0, 0.578, 0.331]} />
    </group>
  );
}

function UpperDoor({ cabinet }: { readonly cabinet: (typeof upperCabinets)[number] }) {
  if (cabinet.kind === "microwave") return null;
  if (cabinet.kind === "glass") {
    return (
      <group position={[cabinet.center, KITCHEN_CEILING_MOUNT_OFFSET, 0.25]}>
        <GlazedUpperDoor width={cabinet.width - 0.006} position={[0, 1.35, 0.235]} />
        <BrassCabinetHandle
          position={[cabinet.handleSide * (cabinet.width / 2 - 0.017), 1.13, 0.303]}
          vertical
        />
      </group>
    );
  }
  return (
    <group position={[cabinet.center, KITCHEN_CEILING_MOUNT_OFFSET, 0.25]}>
      <KitchenPanel width={cabinet.width - 0.006} height={0.64} position={[0, 1.35, 0.211]} />
      <BrassCabinetHandle
        position={[(cabinet.center < 2.8 ? 1 : -1) * (cabinet.width / 2 - 0.055), 1.13, 0.251]}
        vertical
      />
    </group>
  );
}

export function KitchenCabinetry() {
  return (
    <group name="custom-kitchen-cabinetry">
      <TallPantry />
      <KitchenBox size={[2.91, 0.095, 0.45]} position={[2.245, 0.0475, 0.265]} color="#94877a" />
      <KitchenBox size={[2.93, 0.635, 0.56]} position={[2.245, 0.41, 0.31]} color={KITCHEN_CREAM} />
      <KitchenBox size={[1.5, 0.108, 0.56]} position={[1.53, 0.78, 0.31]} color={KITCHEN_CREAM} />
      <KitchenBox size={[0.9, 0.108, 0.56]} position={[3.26, 0.78, 0.31]} color={KITCHEN_CREAM} />
      <KitchenBox size={[0.53, 0.108, 0.06]} position={[2.545, 0.78, 0.56]} color={KITCHEN_CREAM} />
      {baseCabinets
        .filter((cabinet) => cabinet.kind === "door")
        .map((cabinet) => (
          <BaseDoor key={cabinet.center} center={cabinet.center} width={cabinet.width - 0.006} />
        ))}
      <KitchenBox
        size={[3.04, UPPER_CABINET_HEIGHT, 0.4]}
        position={[2.3, UPPER_CABINET_CENTER_Y, 0.25]}
        color={KITCHEN_CREAM}
      />
      {upperCabinets.map((cabinet) => (
        <UpperDoor key={cabinet.center} cabinet={cabinet} />
      ))}
      <KitchenWorktop />
      <KitchenBox
        size={[2.98, 0.19, 0.035]}
        position={[2.27, 1.005, 0.035]}
        color={KITCHEN_STONE}
        outline="#94897d"
      />
    </group>
  );
}
