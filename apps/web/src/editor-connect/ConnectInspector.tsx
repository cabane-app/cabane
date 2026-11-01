import { useEffect, useRef, useState } from "react";
import {
  DeviceConnectionWorkbench,
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
  const [deviceOpen, setDeviceOpen] = useState(Boolean(editor.relationship));
  const scrollRoot = useRef<HTMLDivElement>(null);
  const room = editor.room;
  useEffect(() => {
    setDeviceOpen(false);
  }, [room?.id]);
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
            <section className="connect-workspace-empty connection-column-heading">
              <h2>{editor.groups.length ? "Choose a device" : "No devices yet"}</h2>
              <p>
                {editor.groups.length
                  ? "Select a device to see its connections and readings."
                  : "Add an object in Arrange to get started."}
              </p>
            </section>
          )}
        </ModelThumbnailRenderer>
      </div>
    </section>
  );
}
