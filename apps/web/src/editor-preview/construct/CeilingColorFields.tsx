import { CEILING_SURFACE_COLOR } from "@cabane/engine";
import { EditorButton } from "../../editor-chrome/EditorButton";
import type { ConstructionInspectorProps } from "./construction-inspector-contract";
import { DebouncedColorInput } from "./DebouncedColorInput";

export function CeilingColorFields({
  editor,
  roomId,
}: Pick<ConstructionInspectorProps, "editor"> & { roomId: string }) {
  const ceiling = editor.previewFloor.ceilings?.find((candidate) =>
    candidate.roomIds.includes(roomId),
  );
  if (ceiling?.kind !== "flat") return null;
  return (
    <>
      <label>
        Color
        <DebouncedColorInput
          label="Ceiling color"
          value={ceiling.color ?? CEILING_SURFACE_COLOR}
          onCommit={(ceilingColor) => editor.updateSelectedRoom({ ceilingColor })}
        />
      </label>
      {ceiling.roomIds.length > 1 && (
        <p>
          This ceiling is shared by {ceiling.roomIds.length} rooms. Color changes apply to all of
          them.
        </p>
      )}
      <EditorButton
        variant="text"
        type="button"
        disabled={ceiling.color === undefined}
        onClick={() => editor.updateSelectedRoom({ ceilingColor: undefined })}
      >
        Reset ceiling color
      </EditorButton>
    </>
  );
}
