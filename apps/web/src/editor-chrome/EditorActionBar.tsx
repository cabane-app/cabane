import { DecorationsTools } from "./DecorationsTools";
import type { FloorEditorTool } from "@cabane/engine";
import { EditorActionButton } from "./EditorActionButton";
import { EditorToolGroup } from "./EditorToolGroup";
import { wallTools, openingTools } from "./construction-tool-options";

export interface EditorActionBarProps {
  inert?: boolean | undefined;
  tool: FloorEditorTool;
  onToolChange: (tool: FloorEditorTool) => void;
  onStairs?: () => void;
  stairsActive?: boolean;
  stairsDisabledReason?: string | undefined;
}

export function EditorActionBar({
  inert,
  tool,
  onToolChange,
  onStairs,
  stairsActive,
  stairsDisabledReason,
}: EditorActionBarProps) {
  return (
    <div
      inert={inert}
      className="editor-action-bar"
      role="group"
      data-mode="construct"
      aria-label="Construction actions"
    >
      <EditorActionButton
        icon="select"
        label="Select"
        showLabel
        pressed={!stairsActive && tool === "select"}
        shortcut="V"
        keyShortcuts="V"
        onClick={() => onToolChange("select")}
      />
      <EditorToolGroup
        label="Wall"
        panelLabel="Wall tools"
        icon="wall"
        tools={wallTools}
        tool={stairsActive ? null : tool}
        onToolChange={onToolChange}
        disabled={inert}
      />
      <EditorToolGroup
        label="Openings"
        panelLabel="Opening tools"
        icon="door"
        tools={openingTools}
        tool={stairsActive ? null : tool}
        onToolChange={onToolChange}
        disabled={inert}
      />
      <EditorActionButton
        icon="floor"
        label="Floor"
        showLabel
        pressed={!stairsActive && tool === "floor"}
        shortcut="F"
        keyShortcuts="F"
        onClick={() => onToolChange("floor")}
      />
      {onStairs && (
        <EditorActionButton
          icon="stairs"
          label="Stairs"
          showLabel
          pressed={stairsActive}
          disabled={Boolean(stairsDisabledReason)}
          disabledReason={stairsDisabledReason}
          onClick={onStairs}
        />
      )}
      <EditorActionButton
        icon="measure"
        label="Measure"
        showLabel
        pressed={!stairsActive && tool === "measure"}
        shortcut="M"
        keyShortcuts="M"
        onClick={() => onToolChange("measure")}
      />
      <DecorationsTools tool={tool} onToolChange={onToolChange} disabled={inert} />
    </div>
  );
}
