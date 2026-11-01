import type {
  FloorSpec,
  ProjectModelRegistries,
  SceneItemSpec,
  SceneModelEditorDescriptor,
} from "@cabane/engine";
import { SelectedItemControls } from "./SelectedItemControls";
import type { FurnishingEditorController } from "./useFurnishingEditor";
import { furnishingSelectionTarget } from "./selection-target";
import { itemSelectionUnits } from "./item-groups";

export function FurnishingSelectionControls({
  editor,
  items,
  floor,
  furnishingModels,
  deviceModels,
  selectedItem,
  selectedDefinition,
  busy,
  setDragging,
  onDuplicate,
  onDelete,
  onConnect,
}: {
  editor: FurnishingEditorController;
  items: readonly SceneItemSpec[];
  floor: FloorSpec;
  furnishingModels: ProjectModelRegistries["furnishingModels"];
  deviceModels: ProjectModelRegistries["deviceModels"];
  selectedItem: SceneItemSpec | undefined;
  selectedDefinition: SceneModelEditorDescriptor | undefined;
  busy: boolean;
  setDragging: (dragging: boolean) => void;
  onDuplicate: (id: string) => unknown;
  onDelete: (id: string) => void;
  onConnect?: (() => void) | undefined;
}) {
  const selected = new Set(editor.selectedIds);
  const members = items.filter((item) => selected.has(item.id));
  const multiple = !!editor.selectedGroup || members.length > 1;
  const target =
    multiple && members.length
      ? furnishingSelectionTarget(
          members,
          floor,
          { furnishingModels, deviceModels },
          editor.selectedGroup?.name ?? `${members.length} items`,
        )
      : null;
  const item = target?.item ?? selectedItem;
  const definition = target?.definition ?? selectedDefinition;
  if (!item || !definition) return null;
  const group = editor.selectedGroup;
  const groupCount = itemSelectionUnits(members).filter((unit) => unit.name).length;
  return (
    <SelectedItemControls
      key={group?.id ?? (multiple ? "multiple" : item.id)}
      item={item}
      definition={definition}
      floor={floor}
      busy={busy || !!editor.transaction}
      actionsOnly={multiple && !group}
      freePlacement={!!group}
      onSelect={editor.select}
      onRotate={(id, rotationYRadians) =>
        group && item.placement.kind === "absolute"
          ? editor.transformGroup(group.id, { ...item.placement, rotationYRadians }, floor)
          : editor.rotate(id, rotationYRadians)
      }
      onResize={editor.updateSize}
      onMovePlacement={(id, placement) =>
        group && placement.kind === "absolute"
          ? editor.transformGroup(group.id, placement, floor)
          : editor.updatePlacement(id, placement)
      }
      onBegin={() => {
        editor.beginTransaction();
        setDragging(true);
      }}
      onCommit={() => {
        editor.commitTransaction();
        setDragging(false);
      }}
      onCancel={() => {
        editor.cancelTransaction();
        setDragging(false);
      }}
      actions={{
        onDuplicate: () => (multiple ? editor.duplicateSelection(floor) : onDuplicate(item.id)),
        onDelete: () => (multiple ? editor.deleteItems(editor.selectedIds) : onDelete(item.id)),
        onMap: multiple ? undefined : onConnect,
        onGroup: multiple && !group ? editor.groupSelection : undefined,
        onUngroup: group ? editor.ungroupSelection : undefined,
        groupLabel: groupCount === 1 ? "Add to group" : groupCount > 1 ? "Combine groups" : "Group",
      }}
    />
  );
}
