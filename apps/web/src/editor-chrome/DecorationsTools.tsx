import type { FloorEditorTool } from "@cabane/engine";
import { EditorToolGroup } from "./EditorToolGroup";
import { decorationTools } from "./construction-tool-options";

export function DecorationsTools(props: {
  tool: FloorEditorTool;
  disabled?: boolean | undefined;
  onToolChange: (tool: FloorEditorTool) => void;
}) {
  return (
    <EditorToolGroup
      {...props}
      label="Decorations"
      panelLabel="Decoration tools"
      icon="decorations"
      tools={decorationTools}
    />
  );
}
