import { ToonMaterial, type GardenGateVariant } from "@cabane/engine";

export const GARDEN_GATE_HINGE_OFFSET_METERS = 0.026;
export const GARDEN_GATE_SWEEP_DEPTH_METERS = GARDEN_GATE_HINGE_OFFSET_METERS + 0.055;

type GatePart = {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  angle?: number;
};

function gateParts(
  variant: GardenGateVariant,
  width: number,
  height: number,
  handleSide: -1 | 1,
): GatePart[] {
  const rail = Math.min(0.042, width / 6, height / 6);
  if (variant === "garden-wood") {
    const count = Math.max(3, Math.round(width / 0.095));
    const pitch = width / count;
    const braceWidth = width - rail;
    const braceHeight = height - 4 * rail;
    return [
      ...Array.from({ length: count }, (_, i): GatePart => ({
        position: [(i + 0.5) * pitch - width / 2, 0, 0.006],
        size: [pitch * 0.91, height, 0.028],
      })),
      ...[-1, 1].map((side): GatePart => ({
        position: [0, side * (height / 2 - 2 * rail), -0.016],
        size: [width, rail, 0.026],
      })),
      {
        position: [0, 0, -0.016],
        size: [Math.hypot(braceWidth, braceHeight), rail, 0.025],
        angle: handleSide * Math.atan2(braceHeight, braceWidth),
      },
    ];
  }

  const panelWidth = width - 2 * rail;
  const panelHeight = height - 2 * rail;
  const frame = [-1, 1].flatMap((side): GatePart[] => [
    { position: [(side * (width - rail)) / 2, 0, 0], size: [rail, height, 0.052] },
    { position: [0, (side * (height - rail)) / 2, 0], size: [panelWidth, rail, 0.052] },
  ]);
  if (variant === "garden-anthracite") {
    const count = Math.max(2, Math.round(panelHeight / 0.11));
    const pitch = panelHeight / count;
    return [
      ...frame,
      { position: [0, 0, 0], size: [panelWidth, panelHeight, 0.022] },
      ...Array.from({ length: count }, (_, i): GatePart => ({
        position: [0, (i + 0.5) * pitch - panelHeight / 2, 0],
        size: [panelWidth, pitch - 0.003, 0.04],
      })),
    ];
  }

  const count = Math.max(1, Math.round(panelWidth / 0.095));
  const pitch = panelWidth / (count + 1);
  return [
    ...frame,
    ...Array.from({ length: count }, (_, i): GatePart => ({
      position: [(i + 1) * pitch - panelWidth / 2, 0, 0],
      size: [Math.min(0.016, pitch / 2), panelHeight, 0.021],
    })),
  ];
}

export function GardenGateLeaf({
  variant,
  width,
  height,
  color,
  handleSide,
}: {
  variant: GardenGateVariant;
  width: number;
  height: number;
  color: string;
  handleSide: -1 | 1;
}) {
  const plateWidth = Math.min(0.034, width / 6);
  const plateX = handleSide * (width / 2 - plateWidth / 2);
  const latchY = height * 0.22;
  const leverLength = Math.min(0.095, width / 3);
  const parts = [
    ...gateParts(variant, width, height, handleSide),
    ...[-1, 1].flatMap((face): GatePart[] => [
      {
        position: [plateX, latchY - 0.017, face * 0.029],
        size: [plateWidth, 0.102, 0.012],
        color: "#222522",
      },
      {
        position: [plateX - (handleSide * (leverLength - plateWidth)) / 2, latchY, face * 0.042],
        size: [leverLength, 0.018, 0.026],
        color: "#30332e",
      },
    ]),
  ];
  return (
    <group name={`opening-leaf-${variant}`}>
      {parts.map((part, index) => (
        <mesh
          key={index}
          position={part.position}
          rotation={[0, 0, part.angle ?? 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={part.size} />
          <ToonMaterial color={part.color ?? color} />
        </mesh>
      ))}
    </group>
  );
}
