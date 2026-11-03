import { PoolTypePreview, type PoolSpec } from "@cabane/engine";
import type { ModelPreviewEntry } from "../furnish/catalog/model-preview-entry";
import { ConstructStyleGrid } from "./ConstructStyleGrid";

type PoolType = NonNullable<PoolSpec["type"]>;
const choices = (
  [
    { id: "in-ground", label: "In-ground", description: "Stone coping" },
    { id: "above-ground-wood", label: "Above-ground (wood)", description: "Timber walls" },
  ] as const
).map((choice) => ({
  ...choice,
  entry: {
    key: `pool:${choice.id}:v2`,
    kind: "procedural",
    definition: {
      bounds:
        choice.id === "in-ground"
          ? { min: [-2.15, -0.47, -1.6], max: [2.15, 0.04, 1.6] }
          : { min: [-1.91, -0.05, -1.36], max: [1.91, 1.22, 1.36] },
      component: () => <PoolTypePreview type={choice.id} />,
    },
  } satisfies ModelPreviewEntry,
}));

export function PoolTypeGrid({
  value,
  onChoose,
}: {
  value: PoolType;
  onChoose: (type: PoolType) => void;
}) {
  return (
    <ConstructStyleGrid label="Pool types" choices={choices} value={value} onChoose={onChoose} />
  );
}
