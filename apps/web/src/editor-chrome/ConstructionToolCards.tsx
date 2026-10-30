import { EditorIcon } from "./EditorIcon";
import { wallTools, openingTools, decorationTools } from "./construction-tool-options";
import type { EditorActionBarProps } from "./EditorActionBar";
import type { EditorToolOption } from "./EditorToolGroup";

const primary: readonly (EditorToolOption & { description: string })[] = [
  { ...wallTools[0], description: "Draw your rooms" },
  { ...openingTools[0], description: "Connect spaces" },
  { ...openingTools[2], description: "Bring in light" },
  { tool: "floor", icon: "floor", label: "Floor", description: "Surfaces & finishes" },
  { tool: "measure", icon: "measure", label: "Measure", description: "Check a distance" },
];
const more = [wallTools[1], wallTools[2], openingTools[1], ...decorationTools];
export function ConstructionToolCards({
  tool,
  onToolChange,
  onStairs,
  stairsActive,
  stairsDisabledReason,
  inert,
}: EditorActionBarProps) {
  const card = (option: EditorToolOption & { description?: string }) => (
    <button
      type="button"
      key={option.tool}
      disabled={inert}
      aria-pressed={!stairsActive && tool === option.tool}
      onClick={() => onToolChange(option.tool)}
    >
      <EditorIcon name={option.icon} />
      <strong>{option.label}</strong>
      {option.description && <small>{option.description}</small>}
    </button>
  );
  return (
    <section className="construction-tool-cards" aria-label="Construction actions">
      <button
        type="button"
        className="construction-tool-cards__select"
        disabled={inert}
        aria-pressed={!stairsActive && tool === "select"}
        onClick={() => onToolChange("select")}
      >
        <EditorIcon name="select" />
        Select objects
      </button>
      <h3>Shape your home</h3>
      <div className="construction-tool-cards__grid">
        {primary.slice(0, 4).map(card)}
        {onStairs && (
          <button
            type="button"
            disabled={inert || !!stairsDisabledReason}
            title={stairsDisabledReason}
            aria-pressed={!!stairsActive}
            onClick={onStairs}
          >
            <EditorIcon name="stairs" />
            <strong>Stairs</strong>
            <small>{stairsDisabledReason ?? "Link your floors"}</small>
          </button>
        )}
        {primary.slice(4).map(card)}
      </div>
      <details>
        <summary>More tools</summary>
        <div className="construction-tool-cards__grid">{more.map(card)}</div>
      </details>
    </section>
  );
}
