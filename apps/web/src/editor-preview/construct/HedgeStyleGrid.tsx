import { HEDGE_STYLES, HedgeModel, type HedgeStyle } from "@cabane/engine";
import type { ModelPreviewEntry } from "../furnish/catalog/model-preview-entry";
import { ConstructStyleGrid } from "./ConstructStyleGrid";

const entries = HEDGE_STYLES.map((style) => ({
  ...style,
  entry: {
    key: `hedge:${style.id}:v2`,
    kind: "procedural",
    definition: {
      bounds: {
        min: [-1.65, 0, -style.widthMeters * 0.65],
        max: [1.65, style.heightMeters * 1.1, style.widthMeters * 0.65],
      },
      component: () => (
        <HedgeModel
          style={style.id}
          length={3}
          height={style.heightMeters}
          width={style.widthMeters}
        />
      ),
    },
  } satisfies ModelPreviewEntry,
}));

export function HedgeStyleGrid({
  value,
  onChoose,
}: {
  value: HedgeStyle;
  onChoose: (style: (typeof HEDGE_STYLES)[number]) => void;
}) {
  return (
    <ConstructStyleGrid
      label="Boundary styles"
      choices={entries}
      value={value}
      onChoose={(id) => onChoose(HEDGE_STYLES.find((style) => style.id === id)!)}
    />
  );
}
