import { useState } from "react";
import type { FloorSpec, ProjectModelRegistries } from "@cabane/engine";
import { SelectionDetailsPanel } from "../../editor-chrome/SelectionDetailsPanel";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { NumericField } from "./NumericField";
import type { FurnishingEditorController } from "./useFurnishingEditor";
import { groupPlacement } from "./group-transforms";
import { itemSelectionUnits } from "./item-groups";
import { normalizeRotation } from "./selection-geometry";

function GroupName({
  id,
  name,
  onRename,
}: {
  id: string;
  name: string;
  onRename: (id: string, name: string) => void;
}) {
  const [source, setSource] = useState(name);
  const [draft, setDraft] = useState(name);
  if (source !== name) {
    setSource(name);
    setDraft(name);
  }
  return (
    <label className="arrange-group-name">
      Name
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          if (value) onRename(id, value);
          else setDraft(name);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.value = name;
            setDraft(name);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function SelectedItemsProperties({
  editor,
  floor,
  furnishingModels,
  deviceModels,
  onClose,
}: {
  editor: FurnishingEditorController;
  floor: FloorSpec;
  furnishingModels: ProjectModelRegistries["furnishingModels"];
  deviceModels: ProjectModelRegistries["deviceModels"];
  onClose: () => void;
}) {
  const selected = new Set(editor.selectedIds);
  const members = editor.items.filter((item) => selected.has(item.id));
  const group = editor.selectedGroup;
  const placement = group && members.length ? groupPlacement(members, floor) : null;
  const groupCount = itemSelectionUnits(members).filter((unit) => unit.name).length;
  return (
    <SelectionDetailsPanel
      title={group?.name ?? `${members.length} items`}
      subtitle={`${group ? `Group · ${members.length} ${members.length === 1 ? "item" : "items"} · ` : ""}${floor.name}`}
      label={group ? "Selected group" : "Selected items"}
      onClose={onClose}
    >
      {group && placement ? (
        <>
          <GroupName key={group.id} id={group.id} name={group.name} onRename={editor.renameGroup} />
          <fieldset>
            <legend>Placement</legend>
            {(["X", "Z"] as const).map((axis, index) => (
              <NumericField
                key={axis}
                label={`Position ${axis}`}
                unit="plan units"
                metersPerUnit={floor.coordinates.metersPerPlanUnit}
                value={placement.at[index]}
                onChange={(value) =>
                  editor.transformGroup(
                    group.id,
                    {
                      ...placement,
                      at: index === 0 ? [value, placement.at[1]] : [placement.at[0], value],
                    },
                    floor,
                  )
                }
              />
            ))}
            <NumericField
              label="Elevation"
              unit="m"
              value={placement.elevationMeters}
              onChange={(elevationMeters) =>
                editor.transformGroup(group.id, { ...placement, elevationMeters }, floor)
              }
            />
            <NumericField
              label="Rotation"
              unit="°"
              step={1}
              value={(normalizeRotation(placement.rotationYRadians) * 180) / Math.PI}
              onChange={(degrees) =>
                editor.transformGroup(
                  group.id,
                  { ...placement, rotationYRadians: (degrees * Math.PI) / 180 },
                  floor,
                )
              }
            />
          </fieldset>
          <p className="editor-properties-note">Ungroup to edit individual items.</p>
        </>
      ) : (
        <p className="editor-properties-note">
          Drag any selected item to move them together. Group them to keep the arrangement.
        </p>
      )}
      <div className="arrange-selection-actions">
        <EditorButton onClick={group ? editor.ungroupSelection : editor.groupSelection}>
          {group
            ? "Ungroup"
            : groupCount === 1
              ? "Add to group"
              : groupCount > 1
                ? "Combine groups"
                : "Group"}
        </EditorButton>
        <EditorButton variant="text" onClick={() => editor.duplicateSelection(floor)}>
          Duplicate
        </EditorButton>
        <EditorButton variant="text" onClick={() => editor.deleteItems(editor.selectedIds)}>
          {group ? "Delete group" : "Delete selection"}
        </EditorButton>
      </div>
      <fieldset>
        <legend>{group ? "Items" : "Selected items"}</legend>
        <ul className="arrange-group-members">
          {members.map((item) => (
            <li key={item.id}>
              {(item.kind === "device" ? deviceModels : furnishingModels)[item.modelId]?.label ??
                "Missing model"}
            </li>
          ))}
        </ul>
      </fieldset>
    </SelectionDetailsPanel>
  );
}
