import {
  resolveModelVariant,
  useModelLightingState,
  deviceVisualStateForSnapshot,
} from "@cabane/engine";
import type { ModelPreviewEntry } from "./model-preview-entry";

const noop = () => undefined;
const emptyStates = {};

/** Renders registry geometry without room, network, or binding-runtime dependencies. */
export function ModelVisual({
  entry,
  previewOn = false,
}: {
  entry: ModelPreviewEntry;
  previewOn?: boolean;
}) {
  const lightingState = useModelLightingState();
  const previewState = previewOn
    ? (lightingState?.state ?? {
        entityId: "light.preview" as const,
        state: "on",
        attributes: {},
        available: true,
        stale: false,
      })
    : undefined;
  if (entry.kind === "procedural") {
    const Component = entry.definition.component;
    return <Component />;
  }
  if (entry.kind === "furnishing") {
    const Component = entry.definition.component;
    return (
      <Component
        variant={resolveModelVariant(entry.definition, entry.variant).id}
        size={entry.definition.defaultSize}
        entityStatesBySlotId={emptyStates}
        reducedMotion
        walkMode={false}
        onInteract={noop}
      />
    );
  }
  const Component = entry.definition.component;
  return (
    <Component
      variant={resolveModelVariant(entry.definition, entry.variant).id}
      visualState={deviceVisualStateForSnapshot(previewState)}
      {...(previewState ? { state: previewState } : {})}
      reducedMotion
      walkMode={false}
      onInteract={noop}
      slot={{
        id: `preview-${entry.key}`,
        model: entry.modelId,
        entitySlots: [],
        placement: { at: [0, 0], elevationMeters: 0, support: { kind: "surface" } },
      }}
    />
  );
}
