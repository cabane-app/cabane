import {
  DEFAULT_DOOR_CONFIGURATION,
  GARDEN_GATE_VARIANTS,
  type DoorConfiguration,
  type DoorFinish,
  type GardenGateVariant,
} from "@cabane/engine";

const gateLabels: Record<GardenGateVariant, string> = {
  "garden-anthracite": "Anthracite garden gate",
  "garden-metal": "Metal garden gate",
  "garden-wood": "Wood garden gate",
};

export function gardenGateColor(variant: GardenGateVariant, finish: DoorFinish) {
  if (variant === "garden-wood") return finish === "wood" ? "#a7734b" : "#e6e0d5";
  return variant === "garden-anthracite" ? "#3b424b" : "#343b35";
}

export const DOOR_PRESETS = [
  { id: "panel-wood", label: "Panel wood", configuration: DEFAULT_DOOR_CONFIGURATION },
  {
    id: "panel-white",
    label: "Panel white",
    configuration: {
      kind: "door",
      operation: "hinged",
      variant: "panel",
      finish: "white",
      leafCount: 1,
      widthMeters: 0.9,
      heightMeters: 2.04,
    },
  },
  {
    id: "panel-white-lever",
    label: "Panel white · Compact lever",
    configuration: {
      kind: "door",
      operation: "hinged",
      variant: "panel-white-lever",
      finish: "white",
      leafCount: 1,
      widthMeters: 0.9,
      heightMeters: 2.04,
    },
  },
  {
    id: "french",
    label: "French",
    configuration: {
      kind: "door",
      operation: "hinged",
      variant: "french",
      finish: "white",
      leafCount: 2,
      widthMeters: 1.6,
      heightMeters: 2.04,
    },
  },
  {
    id: "full-glass",
    label: "Full glass",
    configuration: {
      kind: "door",
      operation: "hinged",
      variant: "full-glass",
      finish: "white",
      leafCount: 1,
      widthMeters: 0.9,
      heightMeters: 2.04,
    },
  },
  {
    id: "sliding-wood",
    label: "Sliding wood",
    configuration: {
      kind: "door",
      operation: "sliding",
      variant: "plank",
      finish: "wood",
      leafCount: 1,
      widthMeters: 0.9,
      heightMeters: 2.04,
    },
  },
  {
    id: "garage-door",
    label: "Garage door",
    configuration: {
      kind: "door",
      operation: "roll-up",
      variant: "slatted",
      finish: "white",
      widthMeters: 2.4,
      heightMeters: 2.1,
    },
  },
  {
    id: "steel-arched",
    label: "Arched steel glass",
    configuration: {
      kind: "door",
      operation: "hinged",
      variant: "steel-arched",
      finish: "white",
      leafCount: 1,
      widthMeters: 0.9,
      heightMeters: 2.3,
    },
  },
  ...GARDEN_GATE_VARIANTS.map(
    (variant) =>
      ({
        id: variant,
        label: gateLabels[variant],
        configuration: {
          kind: "door",
          operation: "hinged",
          variant,
          finish: variant === "garden-wood" ? "wood" : "white",
          leafCount: 1,
          widthMeters: 1,
          heightMeters: 1,
        },
      }) as const,
  ),
] as const satisfies readonly { id: string; label: string; configuration: DoorConfiguration }[];
