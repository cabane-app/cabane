import { useRef } from "react";
import { ModelThumbnail, ModelThumbnailRenderer } from "../furnish/catalog/ModelThumbnailRenderer";
import type { ModelPreviewEntry } from "../furnish/catalog/model-preview-entry";
import "../furnish/catalog/arrange-catalog.css";
import "./construct-style-grid.css";

export function ConstructStyleGrid<T extends string>({
  label,
  choices,
  value,
  onChoose,
}: {
  label: string;
  choices: readonly { id: T; label: string; description: string; entry: ModelPreviewEntry }[];
  value: T;
  onChoose: (id: T) => void;
}) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  return (
    <ModelThumbnailRenderer scrollRoot={scrollRoot} enabled>
      <div
        className="catalog-grid construct-style-grid"
        ref={scrollRoot}
        role="group"
        aria-label={label}
      >
        {choices.map((choice) => (
          <button
            type="button"
            key={choice.id}
            className="catalog-card"
            aria-label={choice.label}
            aria-pressed={value === choice.id}
            onClick={() => onChoose(choice.id)}
          >
            <ModelThumbnail entry={choice.entry} showAdd={false} />
            <strong>{choice.label}</strong>
            <small>{choice.description}</small>
          </button>
        ))}
      </div>
    </ModelThumbnailRenderer>
  );
}
