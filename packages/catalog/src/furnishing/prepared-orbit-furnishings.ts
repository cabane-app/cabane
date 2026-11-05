import type { FurnishingModelDefinition, FurnishingModelRegistry } from "@cabane/engine";

// These models have synchronous, stationary geometry and no scene event handlers.
// New models remain on the live path until audited against that contract.
const preparedOrbitModels = [
  "book-row",
  "counter-stool",
  "double-arched-bookcase",
  "double-bed",
  "floor-magazine-rack",
  "hallway-console-table",
  "knob-door-wardrobe",
  "neutral-area-rug",
  "oak-bookshelf",
  "oak-dining-chair",
  "oak-nightstand",
  "pedestal-side-table",
  "rectangular-dining-table",
  "ring-ceramic-vase",
  "round-banded-rug",
  "sectional-sofa",
  "toolbox",
  "two-step-stool",
  "utility-shelving",
  "white-shell-dining-chair",
  "wicker-hamper",
  "wicker-towel-basket",
];

export function withPreparedOrbitFurnishings(definitions: FurnishingModelRegistry) {
  const registry = Object.assign(
    Object.create(null) as Record<string, FurnishingModelDefinition>,
    definitions,
  );
  for (const id of preparedOrbitModels) {
    const definition = registry[id];
    if (definition) registry[id] = { ...definition, preparedOrbit: true };
  }
  return registry;
}
