import { useMemo, useRef } from "react";
import { modelVariants, resolveModelVariant } from "@cabane/engine";
import type { CatalogEntry } from "./catalog/catalog";
import { ModelThumbnail, ModelThumbnailRenderer } from "./catalog/ModelThumbnailRenderer";
import "./catalog/arrange-catalog.css";
import "./furnishing-variant-grid.css";

export function FurnishingVariantGrid({
  entry,
  value,
  onChange,
}: {
  entry: CatalogEntry;
  value: string | undefined;
  onChange: (variant: string) => void;
}) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const previews = useMemo(
    () =>
      modelVariants(entry.definition).map((variant) => ({
        variant,
        entry: {
          ...entry,
          key: `${entry.key}:variant:${variant.id}`,
          variant: variant.id,
        },
      })),
    [entry],
  );
  const selected = resolveModelVariant(entry.definition, value).id;
  return (
    <ModelThumbnailRenderer scrollRoot={scrollRoot} enabled>
      <div
        className="catalog-grid furnishing-variant-grid"
        ref={scrollRoot}
        role="group"
        aria-label="Variant"
      >
        {previews.map(({ variant, entry }) => (
          <button
            type="button"
            key={variant.id}
            className="catalog-card"
            aria-label={variant.label}
            aria-pressed={selected === variant.id}
            onClick={() => onChange(variant.id)}
          >
            <ModelThumbnail entry={entry} showAdd={false} />
            <strong>{variant.label}</strong>
          </button>
        ))}
      </div>
    </ModelThumbnailRenderer>
  );
}
