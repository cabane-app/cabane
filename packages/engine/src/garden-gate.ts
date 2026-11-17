export const GARDEN_GATE_VARIANTS = ["garden-anthracite", "garden-metal", "garden-wood"] as const;

export type GardenGateVariant = (typeof GARDEN_GATE_VARIANTS)[number];

export function isGardenGate(variant: unknown): variant is GardenGateVariant {
  return GARDEN_GATE_VARIANTS.some((gate) => gate === variant);
}
