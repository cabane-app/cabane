import { useEffect, useRef, useState } from "react";
import {
  DeviceConnectionWorkbench,
  RoomDashboardSettings,
  type DeviceModelRegistry,
  type HomeBindingManifest,
} from "@cabane/engine";
import type { ConnectEditor } from "./useConnectEditor";
import { ConnectDeviceGrid, ConnectDevicePreview } from "./ConnectDeviceGrid";
import { ModelThumbnailRenderer } from "../editor-preview/furnish/catalog/ModelThumbnailRenderer";
import "./connect-panel.css";
import "./connect-workspace.css";

const NO_MODELS: DeviceModelRegistry = {};

export function ConnectInspector({
  editor,
  manifest,
  deviceModels = NO_MODELS,
}: {
  editor: ConnectEditor;
  manifest: HomeBindingManifest;
  deviceModels?: DeviceModelRegistry;
}) {
  const relationshipId = editor.relationship?.id;
  const [deviceOpen, setDeviceOpen] = useState(Boolean(relationshipId));
  const scrollRoot = useRef<HTMLDivElement>(null);
  const room = editor.room;
  useEffect(() => {
    setDeviceOpen(Boolean(relationshipId));
  }, [relationshipId]);
  useEffect(() => {
    if (editor.slotId) setDeviceOpen(true);
  }, [room?.id, editor.slotId]);
  const selectDevice = (id: string) => {
    editor.selectRelationship(id);
    setDeviceOpen(true);
  };
  if (!room) return null;
  return (
    <section
      className="connect-inspector connect-room-view"
      aria-label={`${room.name} connections`}
      data-device-open={deviceOpen}
    >
      {editor.disconnected && (
        <p className="connect-offline">
          Home Assistant is offline. Saved connections are retained.
        </p>
      )}
      <div className="connect-room-workspace" ref={scrollRoot}>
        <ModelThumbnailRenderer enabled scrollRoot={scrollRoot}>
          <ConnectDeviceGrid
            editor={editor}
            manifest={manifest}
            models={deviceModels}
            onOpen={selectDevice}
            onRoomControls={() => {
              editor.selectRelationship(null);
              setDeviceOpen(true);
            }}
          />
          {editor.relationship ? (
            <DeviceConnectionWorkbench
              key={editor.relationship.id}
              relationship={editor.relationship}
              room={room}
              profile={editor.profile}
              runtime={editor.displayRuntime}
              disabled={editor.disconnected}
              slotId={editor.slotId}
              onSlotChange={editor.selectSlotId}
              onEntityIdsBySlotIdChange={editor.assignEntities}
              onAddReading={editor.addReading}
              onBack={() => setDeviceOpen(false)}
              preview={
                <ConnectDevicePreview
                  selected
                  relationship={editor.relationship}
                  models={deviceModels}
                  manifest={manifest}
                />
              }
            />
          ) : (
            <section className="connect-workspace-empty connect-room-controls connection-column-heading">
              <button
                type="button"
                className="connection-mobile-back"
                onClick={() => setDeviceOpen(false)}
              >
                Back to devices
              </button>
              <h2>{room.name}</h2>
              {manifest.floors.some((floor) =>
                floor.rooms.some((candidate) => candidate.id === room.id),
              ) ? (
                <>
                  <label className="connect-room-area">
                    Home Assistant area
                    <select
                      aria-label={`Home Assistant area for ${room.name}`}
                      value={editor.profile.roomAreaIds[room.id] ?? ""}
                      disabled={editor.disconnected}
                      onChange={(event) =>
                        editor.assignRoomArea(room.id, event.target.value || null)
                      }
                    >
                      <option value="">No Home Assistant area</option>
                      {editor.profile.roomAreaIds[room.id] &&
                        !editor.displayRuntime.areas.some(
                          (area) => area.area_id === editor.profile.roomAreaIds[room.id],
                        ) && (
                          <option value={editor.profile.roomAreaIds[room.id]}>
                            Saved area unavailable
                          </option>
                        )}
                      {editor.displayRuntime.areas.map((area) => (
                        <option
                          key={area.area_id}
                          value={area.area_id}
                          disabled={Object.entries(editor.profile.roomAreaIds).some(
                            ([id, mapped]) => id !== room.id && mapped === area.area_id,
                          )}
                        >
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="connect-room-area-copy">
                    Used for the room’s name, readings, and automatic dashboard.
                  </p>
                  <RoomDashboardSettings
                    key={room.id}
                    value={editor.profile.roomDashboards?.[room.id]}
                    areaId={editor.profile.roomAreaIds[room.id]}
                    onChange={editor.setRoomDashboard}
                  />
                </>
              ) : (
                <p>Select a device to see its connections and readings.</p>
              )}
            </section>
          )}
        </ModelThumbnailRenderer>
      </div>
    </section>
  );
}
