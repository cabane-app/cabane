import { formatLength, formatArea, useMeasurementUnits } from "@cabane/engine";
import { CommittedTextInput } from "./CommittedTextInput";
import { LengthInput } from "../../editor-chrome/LengthInput";
import { useMemo } from "react";
import {
  pointInsidePolygon,
  resolveRoomFloorFinish,
  roomInteriorAreaSquareMeters,
} from "@cabane/engine";
import type { ConstructionInspectorProps } from "./construction-inspector-contract";
import { SelectionDetailsPanel } from "../../editor-chrome/SelectionDetailsPanel";
import { EditorButton } from "../../editor-chrome/EditorButton";

import { RoomMembershipFields } from "./RoomMembershipFields";
import { DebouncedColorInput } from "./DebouncedColorInput";
import { FloorFinishPalette } from "./FloorFinishPalette";
import { WallFinishFields } from "./WallFinishFields";
import { PlatformProperties } from "./PlatformProperties";
import { PoolProperties } from "./PoolProperties";
import { HedgeProperties } from "./HedgeProperties";
import { wallMeasurement } from "./drag-geometry";

export function ConstructionSelectionProperties({
  editor,
  onClose,
}: Pick<ConstructionInspectorProps, "editor"> & { onClose: () => void }) {
  const units = useMeasurementUnits();
  const selectedWallId = editor.selection?.kind === "wall" ? editor.selection.id : null;
  const selectedPoolId = editor.selection?.kind === "pool" ? editor.selection.id : null;
  const selectedRoomId = editor.selection?.kind === "room" ? editor.selection.id : null;
  const selectedFloorZoneId = editor.selection?.kind === "floor-zone" ? editor.selection.id : null;
  const selectedWall = selectedWallId
    ? editor.draft.walls.find((wall) => wall.id === selectedWallId)
    : undefined;
  const selectedPool = selectedPoolId
    ? editor.draft.pools?.find((pool) => pool.id === selectedPoolId)
    : undefined;
  const selectedRoom = selectedRoomId
    ? editor.previewFloor.rooms.find((room) => room.id === selectedRoomId)
    : undefined;
  const selectedRoomIdentity = selectedRoom
    ? editor.draft.rooms.find((room) => room.id === selectedRoom.id)
    : undefined;
  const selectedFloorZone = selectedFloorZoneId
    ? [
        ...(editor.draft.groundZones ?? []),
        ...editor.draft.rooms.flatMap((room) => room.floorZones ?? []),
      ].find((zone) => zone.id === selectedFloorZoneId)
    : undefined;
  const mergedRoomIdentities = selectedRoom
    ? editor.draft.rooms.filter((room) => pointInsidePolygon(room.anchor, selectedRoom.polygon))
    : [];
  const roomAreaSquareMeters = useMemo(
    () => (selectedRoom ? roomInteriorAreaSquareMeters(selectedRoom, editor.previewFloor) : 0),
    [selectedRoom, editor.previewFloor],
  );
  const roomCeilingHeight =
    selectedRoomIdentity?.ceilingHeightMeters ?? editor.draft.defaultCeilingHeightMeters;
  const resolvedWall = selectedWall
    ? editor.previewFloor.walls.find((wall) => wall.id === selectedWall.id)
    : undefined;
  const selectedWallIsExterior =
    selectedWall &&
    (resolvedWall?.classification === "exterior" ||
      editor.wallRuns.some(
        (run) => run.sourceWallId === selectedWall.id && run.classification === "exterior",
      ));
  const wallMetrics = selectedWall
    ? wallMeasurement(selectedWall, editor.previewFloor.coordinates)
    : undefined;
  const wallHeight = selectedWall?.heightMeters ?? editor.draft.defaultWallHeightMeters;
  const wallThickness =
    selectedWall?.thicknessMeters ??
    resolvedWall?.thicknessMeters ??
    editor.draft.exteriorWallThicknessMeters;
  const platformId =
    editor.selection?.kind === "outdoor-platform" ? editor.selection.id : undefined;
  const selectedPlatform =
    editor.tool === "select" && platformId
      ? editor.draft.outdoorPlatforms?.find((platform) => platform.id === platformId)
      : undefined;
  const multipleSelection = editor.selection?.kind === "multiple";
  const deletionCounts = useMemo(() => {
    const counts = {
      "outdoor-platform": 0,
      hedge: 0,
      wall: 0,
      opening: 0,
      room: 0,
      pool: 0,
      "floor-zone": 0,
    };
    const seen = new Set<string>();
    for (const target of editor.deletionTargets ?? []) {
      const key = `${target.kind}:${target.id}`;
      if (!seen.has(key)) counts[target.kind]++;
      seen.add(key);
    }
    return counts;
  }, [editor.deletionTargets]);
  const deletionCount = Object.values(deletionCounts).reduce((sum, count) => sum + count, 0);
  const kind = editor.selection?.kind;
  const names = {
    wall: selectedWall?.virtual ? "Invisible wall" : "Wall",
    room: selectedRoom?.name || "Unnamed room",
    hedge: "Boundary",
    pool: "Pool",
    "floor-zone": "Floor area",
    "outdoor-platform": "Platform",
    multiple: `${deletionCount} elements selected`,
    opening: "Opening",
  };
  const typeLabel = kind ? names[kind] : "Properties";
  const title = selectedWall?.name || typeLabel;
  return (
    <SelectionDetailsPanel
      title={title}
      subtitle={
        selectedWall?.name ? `${typeLabel} · ${editor.previewFloor.name}` : editor.previewFloor.name
      }
      label="Construction properties"
      mode="construct"
      onClose={onClose}
    >
      <section className="construction-inspector construction-selection-properties">
        {kind === "hedge" && <HedgeProperties editor={editor} />}
        {selectedPlatform && <PlatformProperties platform={selectedPlatform} editor={editor} />}
        {multipleSelection && (
          <div className="construction-inspector__selection construction-inspector__bulk-selection">
            <p>
              Whole source walls and their attached openings are included. Shift-drag again to
              replace this selection.
            </p>
            <dl
              className="construction-inspector__bulk-facts"
              aria-label="Elements selected for deletion"
            >
              {deletionCounts.room > 0 && (
                <div>
                  <dt>Rooms</dt>
                  <dd>{deletionCounts.room}</dd>
                </div>
              )}
              {deletionCounts.wall > 0 && (
                <div>
                  <dt>Walls</dt>
                  <dd>{deletionCounts.wall}</dd>
                </div>
              )}
              {deletionCounts.opening > 0 && (
                <div>
                  <dt>Openings</dt>
                  <dd>{deletionCounts.opening}</dd>
                </div>
              )}
              {deletionCounts.hedge > 0 && (
                <div>
                  <dt>Boundaries</dt>
                  <dd>{deletionCounts.hedge}</dd>
                </div>
              )}
              {deletionCounts.pool > 0 && (
                <div>
                  <dt>Pools</dt>
                  <dd>{deletionCounts.pool}</dd>
                </div>
              )}
              {deletionCounts["floor-zone"] > 0 && (
                <div>
                  <dt>Floor areas</dt>
                  <dd>{deletionCounts["floor-zone"]}</dd>
                </div>
              )}
            </dl>
            <EditorButton variant="text" type="button" onClick={editor.deleteSelected}>
              Delete selection
            </EditorButton>
          </div>
        )}
        {selectedPool && <PoolProperties pool={selectedPool} editor={editor} />}
        {selectedFloorZone && (
          <div className="construction-inspector__selection">
            <FloorFinishPalette
              value={selectedFloorZone.finish}
              onChange={(finish) => editor.updateFloorZone(selectedFloorZone.id, { finish })}
            />
            <EditorButton variant="text" type="button" onClick={editor.deleteSelected}>
              Delete floor area
            </EditorButton>
          </div>
        )}
        {selectedWall && (
          <div className="construction-inspector__selection">
            <dl className="construction-inspector__wall-facts">
              <div>
                <dt>Length</dt>
                <dd>{wallMetrics && formatLength(wallMetrics.lengthMeters, units)}</dd>
              </div>
              <div>
                <dt>Direction</dt>
                <dd>{wallMetrics?.directionDegrees.toFixed(1)}°</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>
                  {selectedWall.virtual ? "Invisible" : (resolvedWall?.classification ?? "Pending")}
                </dd>
              </div>
            </dl>
            {selectedWall.virtual && (
              <p className="construction-inspector__tool-hint">
                This boundary separates rooms without blocking the view or walking.
              </p>
            )}
            <fieldset>
              <legend>Name</legend>
              <CommittedTextInput
                key={selectedWall.id}
                label="Wall name"
                value={selectedWall.name ?? ""}
                placeholder={selectedWall.id}
                onCommit={(name) => editor.updateSelectedWallMetadata({ name: name || undefined })}
              />
            </fieldset>
            {!selectedWall.virtual && (
              <>
                <fieldset>
                  <legend>Dimensions</legend>
                  <label>
                    Thickness
                    <LengthInput
                      label="Wall thickness"
                      min={0.04}
                      step={0.01}
                      value={wallThickness}
                      onCommit={(value) =>
                        editor.updateSelectedWallMetadata({ thicknessMeters: value })
                      }
                    />
                  </label>
                  <label>
                    Height
                    <LengthInput
                      label="Wall height"
                      min={0.3}
                      step={0.05}
                      value={wallHeight}
                      onCommit={(value) =>
                        editor.updateSelectedWallMetadata({ heightMeters: value })
                      }
                    />
                  </label>
                </fieldset>
                <WallFinishFields
                  editor={editor}
                  wall={selectedWall}
                  isExterior={!!selectedWallIsExterior}
                />
              </>
            )}
            <EditorButton variant="text" type="button" onClick={editor.deleteSelected}>
              Delete wall
            </EditorButton>
          </div>
        )}
        {selectedRoom && (
          <div className="construction-inspector__selection">
            <p className="editor-property-fact">
              Interior area{" "}
              <span
                title="Interior floor area"
                aria-label={`Interior floor area: ${formatArea(roomAreaSquareMeters, units).replace("m²", "square meters").replace("ft²", "square feet")}`}
              >
                <strong>{formatArea(roomAreaSquareMeters, units)}</strong>
              </span>
            </p>
            {mergedRoomIdentities.length > 1 && (
              <div className="construction-inspector__merge" role="alert">
                <strong>Choose the room to keep</strong>
                <p>This wall change joined existing rooms. Keep one identity before continuing.</p>
                <div>
                  {mergedRoomIdentities.map((identity) => (
                    <EditorButton
                      variant="secondary"
                      key={identity.id}
                      type="button"
                      onClick={() => editor.resolveRoomMerge(identity.id)}
                    >
                      Keep {identity.name || identity.id}
                    </EditorButton>
                  ))}
                </div>
              </div>
            )}
            <RoomMembershipFields
              enabled={!selectedRoom.isSolid}
              name={selectedRoomIdentity?.name ?? selectedRoom.name}
              placeholder="e.g. Living room"
              description="Turn off to fill a cupboard, shaft or pillar as a structural block, without room navigation or area mapping."
              onEnabledChange={(useAsRoom) => editor.updateSelectedRoom({ isSolid: !useAsRoom })}
              onNameCommit={(name) => editor.updateSelectedRoom({ name })}
            >
              <label>
                Accent
                <DebouncedColorInput
                  label="Room accent color"
                  value={selectedRoomIdentity?.accent ?? selectedRoom.accent}
                  onCommit={(accent) => editor.updateSelectedRoom({ accent })}
                />
              </label>
            </RoomMembershipFields>
            {!selectedRoom.isSolid && (
              <>
                <fieldset>
                  <legend>Floor finish</legend>
                  <FloorFinishPalette
                    value={resolveRoomFloorFinish(selectedRoom)}
                    onChange={(finish) => editor.paintRoomFloor(selectedRoom.id, finish, false)}
                  />
                </fieldset>
                <fieldset>
                  <legend>Ceiling</legend>
                  <label>
                    Ceiling
                    <LengthInput
                      label="Room ceiling height"
                      min={0.3}
                      step={0.05}
                      value={roomCeilingHeight}
                      onCommit={(ceilingHeightMeters) =>
                        editor.updateSelectedRoom({ ceilingHeightMeters })
                      }
                    />
                  </label>
                </fieldset>
              </>
            )}
            <fieldset>
              <legend>Actions</legend>
              <div className="construction-inspector__room-actions">
                <EditorButton
                  variant="text"
                  type="button"
                  disabled={
                    editor.deletionTargets?.some(
                      (target) => target.kind === "room" && target.id === selectedRoom.id,
                    ) === false
                  }
                  onClick={editor.deleteSelected}
                >
                  {selectedRoom.isSolid ? "Delete space" : "Delete room"}
                </EditorButton>
              </div>
              {editor.deletionTargets?.some(
                (target) => target.kind === "room" && target.id === selectedRoom.id,
              ) === false && (
                <p className="construction-inspector__room-action-note" role="status">
                  Shared walls. Edit the walls to delete this room.
                </p>
              )}
            </fieldset>
          </div>
        )}
      </section>
    </SelectionDetailsPanel>
  );
}
