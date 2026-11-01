import { ItemEntitySlots } from "./ItemEntitySlots";
import type { ItemConnectionContext } from "./ItemEntitySlots";
import { EditorButton } from "../../editor-chrome/EditorButton";
import { EditorIcon } from "../../editor-chrome/EditorIcon";
import { FurnishingVariantGrid } from "./FurnishingVariantGrid";
import type { CatalogEntry } from "./catalog/catalog";
import { NumericField } from "./NumericField";
import { modelVariants, resolveModelVariant } from "@cabane/engine";
import { SelectionDetailsPanel } from "../../editor-chrome/SelectionDetailsPanel";
import type {
  EntityBindingSlotSpec,
  FloorSpec,
  ItemPlacement,
  SceneItemSpec,
  SceneItemSize,
  SceneModelEditorDescriptor,
} from "@cabane/engine";
import { windowPlacements } from "./placement/window-placement";
const AXES = ["width", "height", "depth"] as const;
const rotationFor = (placement: ItemPlacement) =>
  placement.kind === "wall" ? placement.rotationOffsetRadians : placement.rotationYRadians;

export function FurnishingProperties({
  selected,
  definition,
  previewEntry,
  onPlacementChange,
  onSizeChange,
  onLightStateChange,
  onEntitySlotsChange,
  connections,
  onVariantChange,
  onColorChange,
  onClose,
  onEditLighting,
  onConnectLighting,
  floor,
  onWindowFit,
}: {
  floor?: FloorSpec | undefined;
  onWindowFit?:
    | ((
        id: string,
        placement: ItemPlacement,
        size: SceneItemSize,
        definition: SceneModelEditorDescriptor,
      ) => void)
    | undefined;
  selected: SceneItemSpec;
  connections?: ItemConnectionContext | undefined;
  definition: SceneModelEditorDescriptor;
  previewEntry?: CatalogEntry | undefined;
  onPlacementChange: (id: string, placement: ItemPlacement) => void;
  onSizeChange: (id: string, size: SceneItemSize, definition: SceneModelEditorDescriptor) => void;
  onColorChange?:
    | ((id: string, color: string | null, definition: SceneModelEditorDescriptor) => void)
    | undefined;
  onVariantChange?:
    ((id: string, variant: string, definition: SceneModelEditorDescriptor) => void) | undefined;
  onEntitySlotsChange?: ((id: string, slots: readonly EntityBindingSlotSpec[]) => void) | undefined;
  onLightStateChange?:
    | ((id: string, lightState: "always-off" | "always-on" | "night-only" | "connected") => void)
    | undefined;
  onConnectLighting?: (() => void) | undefined;
  onEditLighting?: (() => void) | undefined;
  onClose: () => void;
}) {
  const updatePlacement = (patch: Partial<ItemPlacement>) =>
    onPlacementChange(selected.id, { ...selected.placement, ...patch } as ItemPlacement);
  const updateSize = (axis: number, value: number) => {
    const size = [...selected.size] as [number, number, number];
    size[axis] = value;
    onSizeChange(selected.id, size, definition);
  };
  const windows =
    floor && definition.windowFit
      ? windowPlacements(definition, floor, floor.coordinates.origin)
      : [];
  return (
    <SelectionDetailsPanel
      key={selected.id}
      label={selected.kind === "device" ? "Selected device" : "Selected furnishing"}
      title={definition.label}
      subtitle={`${definition.category}${floor ? ` · ${floor.name}` : ""}`}
      onClose={onClose}
    >
      {previewEntry && modelVariants(definition).length > 1 && onVariantChange && (
        <fieldset>
          <legend>Variant</legend>
          <FurnishingVariantGrid
            entry={previewEntry}
            value={selected.variant}
            onChange={(variant) => onVariantChange(selected.id, variant, definition)}
          />
        </fieldset>
      )}
      <fieldset>
        <legend>Dimensions</legend>
        {definition.resizePolicy.kind === "uniform" ? (
          <NumericField
            unit="×"
            min={Math.max(...definition.defaultSize.map((value) => 0.01 / value))}
            label="Scale"
            value={selected.size[0] / definition.defaultSize[0]}
            onChange={(scale) =>
              onSizeChange(
                selected.id,
                definition.defaultSize.map((value) => value * scale) as unknown as SceneItemSize,
                definition,
              )
            }
          />
        ) : (
          AXES.map((axis, index) => {
            const editable =
              definition.resizePolicy.kind === "planar"
                ? axis !== "height"
                : definition.resizePolicy.kind === "axes"
                  ? definition.resizePolicy.axes.includes(axis)
                  : definition.resizePolicy.kind === "custom";
            return (
              <NumericField
                unit="m"
                key={axis}
                min={0.01}
                label={axis.charAt(0).toUpperCase() + axis.slice(1)}
                value={selected.size[index]}
                disabled={!editable}
                onChange={(value) => updateSize(index, value)}
              />
            );
          })
        )}
      </fieldset>
      {onEntitySlotsChange && (
        <ItemEntitySlots
          key={selected.id}
          item={selected}
          label={definition.label}
          connections={connections}
          onChange={(slots) => onEntitySlotsChange(selected.id, slots)}
        />
      )}
      {onEditLighting && (
        <fieldset>
          <legend>Lighting</legend>
          <div className="furnishing-lighting-action">
            {definition.lighting && (
              <p className="editor-properties-note">
                {definition.lighting.strip
                  ? "LED strip"
                  : `${1 + (definition.lighting.points?.length ?? 0)} light point${definition.lighting.points?.length ? "s" : ""}`}
              </p>
            )}
            <EditorButton onClick={onEditLighting}>
              <EditorIcon name="lighting" />
              Edit lighting
            </EditorButton>
          </div>
          {definition.lighting && onConnectLighting && (
            <EditorButton variant="text" onClick={onConnectLighting}>
              Connect lighting
            </EditorButton>
          )}
          {definition.lighting && onLightStateChange && (
            <label>
              <span>Scene state</span>
              <select
                value={selected.lightState ?? "connected"}
                onChange={(event) =>
                  onLightStateChange(
                    selected.id,
                    event.target.value as "connected" | "always-on" | "always-off" | "night-only",
                  )
                }
              >
                <option value="connected">Connected</option>
                <option value="always-on">Always on</option>
                <option value="always-off">Always off</option>
                <option value="night-only">Night only</option>
              </select>
            </label>
          )}
        </fieldset>
      )}
      {definition.windowFit && onWindowFit && (
        <fieldset>
          <legend>Window</legend>
          <label>
            <span>Fit to window</span>
            <select
              value=""
              disabled={windows.length === 0}
              onChange={(event) => {
                const candidate = windows[Number(event.currentTarget.value)];
                if (candidate)
                  onWindowFit(selected.id, candidate.placement, candidate.size, definition);
              }}
            >
              <option value="">{windows.length ? "Choose a window…" : "No suitable window"}</option>
              {windows.map((candidate, index) => (
                <option key={`${candidate.openingId}-${index}`} value={index}>
                  {candidate.roomName} · {candidate.openingLabel}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}
      {selected.placement.kind === "absolute" && (
        <fieldset>
          <legend>Placement</legend>
          <NumericField
            unit="plan units"
            metersPerUnit={floor?.coordinates.metersPerPlanUnit ?? 1}
            label="X"
            value={selected.placement.at[0]}
            onChange={(value) =>
              updatePlacement({
                at: [value, selected.placement.kind === "absolute" ? selected.placement.at[1] : 0],
              })
            }
          />
          <NumericField
            unit="plan units"
            metersPerUnit={floor?.coordinates.metersPerPlanUnit ?? 1}
            label="Z"
            value={selected.placement.at[1]}
            onChange={(value) =>
              updatePlacement({
                at: [selected.placement.kind === "absolute" ? selected.placement.at[0] : 0, value],
              })
            }
          />
          <NumericField
            unit="m"
            label="Elevation"
            value={selected.placement.elevationMeters}
            onChange={(elevationMeters) => updatePlacement({ elevationMeters })}
          />
          <NumericField
            unit="°"
            step={1}
            label="Rotation"
            value={(rotationFor(selected.placement) * 180) / Math.PI}
            onChange={(degrees) => {
              const radians = (degrees * Math.PI) / 180;
              updatePlacement(
                selected.placement.kind === "wall"
                  ? { rotationOffsetRadians: radians }
                  : { rotationYRadians: radians },
              );
            }}
          />
        </fieldset>
      )}
      {selected.placement.kind === "wall" && (
        <fieldset>
          <legend>Placement · wall</legend>
          <NumericField
            unit="plan units"
            metersPerUnit={floor?.coordinates.metersPerPlanUnit ?? 1}
            label="Offset"
            value={selected.placement.offsetFromWallStartPlanUnits}
            onChange={(offsetFromWallStartPlanUnits) =>
              updatePlacement({ offsetFromWallStartPlanUnits })
            }
          />
          <NumericField
            unit="m"
            label="Elevation"
            value={selected.placement.elevationMeters}
            onChange={(elevationMeters) => updatePlacement({ elevationMeters })}
          />
          <NumericField
            unit="m"
            label="Depth offset"
            value={selected.placement.depthOffsetMeters}
            onChange={(depthOffsetMeters) => updatePlacement({ depthOffsetMeters })}
          />
          <NumericField
            unit="°"
            step={1}
            label="Rotation"
            value={(rotationFor(selected.placement) * 180) / Math.PI}
            onChange={(degrees) => {
              const radians = (degrees * Math.PI) / 180;
              updatePlacement(
                selected.placement.kind === "wall"
                  ? { rotationOffsetRadians: radians }
                  : { rotationYRadians: radians },
              );
            }}
          />
        </fieldset>
      )}
      {selected.placement.kind === "ceiling" && (
        <fieldset>
          <legend>Placement · ceiling</legend>
          <NumericField
            unit="plan units"
            metersPerUnit={floor?.coordinates.metersPerPlanUnit ?? 1}
            label="X"
            value={selected.placement.at[0]}
            onChange={(value) =>
              updatePlacement({
                at: [value, selected.placement.kind === "ceiling" ? selected.placement.at[1] : 0],
              })
            }
          />
          <NumericField
            unit="plan units"
            metersPerUnit={floor?.coordinates.metersPerPlanUnit ?? 1}
            label="Z"
            value={selected.placement.at[1]}
            onChange={(value) =>
              updatePlacement({
                at: [selected.placement.kind === "ceiling" ? selected.placement.at[0] : 0, value],
              })
            }
          />
          <NumericField
            unit="m"
            label="Drop"
            value={selected.placement.dropMeters}
            onChange={(dropMeters) => updatePlacement({ dropMeters })}
          />
          <NumericField
            unit="°"
            step={1}
            label="Rotation"
            value={(rotationFor(selected.placement) * 180) / Math.PI}
            onChange={(degrees) => {
              const radians = (degrees * Math.PI) / 180;
              updatePlacement(
                selected.placement.kind === "wall"
                  ? { rotationOffsetRadians: radians }
                  : { rotationYRadians: radians },
              );
            }}
          />
        </fieldset>
      )}

      {((!!definition.defaultColor && !!onColorChange) ||
        (selected.kind === "device" &&
          !onEditLighting &&
          !!onLightStateChange &&
          resolveModelVariant(definition, selected.variant).sceneLight !== false &&
          selected.entitySlots.some(
            (slot) => slot.deviceRole === "primary" && slot.compatibleDomains.includes("light"),
          ))) && (
        <fieldset>
          <legend>Appearance</legend>
          {definition.defaultColor && onColorChange && (
            <>
              <label>
                <span>Color</span>
                <input
                  type="color"
                  value={selected.color ?? definition.defaultColor}
                  onInput={(event) =>
                    onColorChange(selected.id, event.currentTarget.value, definition)
                  }
                />
              </label>
              <button
                type="button"
                disabled={selected.color === undefined}
                onClick={() => onColorChange(selected.id, null, definition)}
              >
                Reset color
              </button>
            </>
          )}
          {!onEditLighting &&
            selected.kind === "device" &&
            resolveModelVariant(definition, selected.variant).sceneLight !== false &&
            selected.entitySlots.some(
              (slot) => slot.deviceRole === "primary" && slot.compatibleDomains.includes("light"),
            ) &&
            onLightStateChange && (
              <>
                <label>
                  <span>State</span>
                  <select
                    value={selected.lightState ?? "connected"}
                    onChange={(event) =>
                      onLightStateChange(
                        selected.id,
                        event.currentTarget.value as
                          "always-off" | "always-on" | "night-only" | "connected",
                      )
                    }
                  >
                    <option value="always-off">Always off</option>
                    <option value="always-on">Always on</option>
                    <option value="night-only">Night only</option>
                    <option value="connected">Connected</option>
                  </select>
                </label>
              </>
            )}
        </fieldset>
      )}
    </SelectionDetailsPanel>
  );
}
