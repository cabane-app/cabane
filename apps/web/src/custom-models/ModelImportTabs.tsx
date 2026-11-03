import { useRef, type KeyboardEvent } from "react";

export type ModelImportSection = "model" | "poses" | "lighting";

export function ModelImportTabs({
  id,
  section,
  hasPoses,
  onChange,
}: {
  id: string;
  section: ModelImportSection;
  hasPoses: boolean;
  onChange: (section: ModelImportSection) => void;
}) {
  const tabs = useRef<HTMLDivElement>(null);
  const sections: readonly (readonly [ModelImportSection, string])[] = [
    ["model", "Model"],
    ...(hasPoses ? ([["poses", "States"]] as const) : []),
    ["lighting", "Lighting"],
  ];
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? sections.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % sections.length
            : event.key === "ArrowLeft"
              ? (index + sections.length - 1) % sections.length
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(sections[next]![0]);
    tabs.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };
  return (
    <div ref={tabs} role="tablist" aria-label="Model settings" className="model-import-tabs">
      {sections.map(([key, label], index) => (
        <button
          key={key}
          type="button"
          role="tab"
          id={`${id}-${key}-tab`}
          aria-controls={`${id}-panel`}
          aria-selected={section === key}
          tabIndex={section === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={(event) => navigate(event, index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
