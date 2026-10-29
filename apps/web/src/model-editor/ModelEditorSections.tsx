import { useId, type ReactNode } from "react";
import { EditorButton } from "../editor-chrome/EditorButton";

export type ModelEditorSection = "model" | "lighting";
export function ModelEditorSections({
  section,
  onSection,
  model,
  lighting,
}: {
  section: ModelEditorSection;
  onSection: (section: ModelEditorSection) => void;
  model: ReactNode;
  lighting: ReactNode;
}) {
  const id = useId();
  const sections = ["model", "lighting"] as const;
  return (
    <div className="model-editor-inspector">
      <div className="model-editor-sections" role="tablist" aria-label="Model settings">
        {sections.map((name, index) => (
          <EditorButton
            key={name}
            role="tab"
            id={`${id}-${name}`}
            aria-controls={`${id}-${name}-panel`}
            aria-selected={section === name}
            tabIndex={section === name ? 0 : -1}
            onClick={() => onSection(name)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
              onSection(sections[next]);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }}
          >
            {name === "model" ? "Model" : "Lighting"}
          </EditorButton>
        ))}
      </div>
      {sections.map((name) => (
        <section
          key={name}
          id={`${id}-${name}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${name}`}
          hidden={section !== name}
          className="model-editor-panel"
        >
          {name === "model" ? model : lighting}
        </section>
      ))}
    </div>
  );
}
