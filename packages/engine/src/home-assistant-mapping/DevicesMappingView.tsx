import { useEffect, useRef, useState } from "react";
import type {
  HomeAssistantRuntimeSnapshot,
  HomeBindingManifest,
  RuntimeBindingProfile,
} from "../types";
import { DeviceMappingGroup } from "./DeviceMappingGroup";
import { DeviceMappingInspector, type DeviceMappingInspectorState } from "./DeviceMappingInspector";
import type { DeviceMappingActivationInput } from "./DeviceMappingRelationshipCard";
import { EntitySlotMappingRow } from "./EntitySlotMappingRow";
import { HomeAssistantAreaIcon } from "./HomeAssistantAreaIcon";
import { ModeledDeviceMappingRow } from "./ModeledDeviceMappingRow";
import { groupRoomMappingRelationships } from "./device-mapping-groups";

export function DevicesMappingView({
  manifest,
  runtime,
  roomAreaIds,
  entityIdsBySlotId,
  dirtyRoomIds,
  initialRoomId,
  onEntityIdsBySlotIdChange,
}: {
  manifest: HomeBindingManifest;
  runtime: HomeAssistantRuntimeSnapshot;
  roomAreaIds: RuntimeBindingProfile["roomAreaIds"];
  entityIdsBySlotId: RuntimeBindingProfile["entityIdsBySlotId"];
  dirtyRoomIds: ReadonlySet<string>;
  initialRoomId?: (string | null) | undefined;
  onEntityIdsBySlotIdChange: (
    entityIdsBySlotId: RuntimeBindingProfile["entityIdsBySlotId"],
  ) => void;
}) {
  const floor = manifest.floors[0];
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId ?? floor.rooms[0]?.id ?? "");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [inspectorState, setInspectorState] = useState<DeviceMappingInspectorState | "closed">(
    "closed",
  );
  const [announcement, setAnnouncement] = useState("");
  const relationshipElements = useRef<Record<string, HTMLButtonElement | null>>({});
  const choiceElement = useRef<HTMLElement | null>(null);
  const focusChoiceOnOpen = useRef(false);

  useEffect(() => {
    if (inspectorState !== "open" || !focusChoiceOnOpen.current) return;
    focusChoiceOnOpen.current = false;
    choiceElement.current?.focus();
  }, [inspectorState, selectedRelationshipId]);

  const selectedRoom = floor.rooms.find((room) => room.id === selectedRoomId) ?? floor.rooms[0];
  if (!selectedRoom) return <p className="devices-mapping-view__empty">No rooms available.</p>;
  const profile: RuntimeBindingProfile = {
    schemaVersion: 1,
    homeId: manifest.home.id,
    roomAreaIds,
    entityIdsBySlotId,
  };
  const hasSavedArea = Boolean(
    roomAreaIds[selectedRoom.id] &&
    runtime.areas.some((area) => area.area_id === roomAreaIds[selectedRoom.id]),
  );
  const roomDraftIsDirty = dirtyRoomIds.has(selectedRoom.id);
  const disabled = !hasSavedArea || roomDraftIsDirty;
  const groups = groupRoomMappingRelationships(manifest, selectedRoom.id);
  const selectedRelationship =
    groups
      .flatMap((group) => group.relationships)
      .find((relationship) => relationship.id === selectedRelationshipId) ?? null;
  const areaContextLabelForRoom = (roomId: string) => {
    const areaId = roomAreaIds[roomId];
    if (!areaId) return "No HA area";
    const areaName = runtime.areas.find((area) => area.area_id === areaId)?.name;
    return areaName ? `HA area: ${areaName}` : "HA area unavailable";
  };
  const areaIconForRoom = (roomId: string) => {
    const areaId = roomAreaIds[roomId];
    return areaId ? runtime.areas.find((area) => area.area_id === areaId)?.icon : null;
  };

  const focusSelectedRelationship = () => {
    if (!selectedRelationshipId || typeof requestAnimationFrame === "undefined") return;
    requestAnimationFrame(() => relationshipElements.current[selectedRelationshipId]?.focus());
  };

  const activateRelationship = (relationshipId: string, input: DeviceMappingActivationInput) => {
    focusChoiceOnOpen.current = input === "keyboard";
    setSelectedRelationshipId(relationshipId);
    setInspectorState("open");
  };

  const collapseInspector = () => {
    if (!selectedRelationshipId) return;
    setInspectorState("summary");
    focusSelectedRelationship();
  };

  const selectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedRelationshipId(null);
    setInspectorState("closed");
  };

  return (
    <div className="devices-mapping-view" data-inspector-state={inspectorState}>
      <div
        className="devices-mapping-view__content"
        inert={inspectorState === "open" ? true : undefined}
      >
        <nav className="devices-mapping-view__rooms" role="tablist" aria-label="Rooms">
          {floor.rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              role="tab"
              aria-selected={room.id === selectedRoom.id}
              aria-label={`${room.name}. ${areaContextLabelForRoom(room.id)}`}
              aria-controls="device-mapping-room-panel"
              onClick={() => selectRoom(room.id)}
            >
              <HomeAssistantAreaIcon
                icon={areaIconForRoom(room.id)}
                className="devices-mapping-view__room-icon"
              />
              <strong>{room.name}</strong>
            </button>
          ))}
        </nav>
        <section
          id="device-mapping-room-panel"
          className="devices-mapping-view__panel"
          role="tabpanel"
          aria-label={`${selectedRoom.name} devices`}
        >
          {!hasSavedArea && (
            <p className="devices-mapping-view__notice">Map this room in Rooms first.</p>
          )}
          {hasSavedArea && roomDraftIsDirty && (
            <p className="devices-mapping-view__notice">Save the room mapping first.</p>
          )}
          <div className="devices-mapping-view__groups">
            {groups.map((group) => (
              <DeviceMappingGroup key={group.id} group={group}>
                {group.relationships.map((relationship) =>
                  relationship.kind === "modeled-device" ? (
                    <ModeledDeviceMappingRow
                      key={relationship.id}
                      manifest={manifest}
                      room={selectedRoom}
                      device={relationship.device}
                      profile={profile}
                      runtime={runtime}
                      disabled={disabled}
                      selected={relationship.id === selectedRelationshipId}
                      onOpen={(input) => activateRelationship(relationship.id, input)}
                      onTriggerElement={(element) => {
                        relationshipElements.current[relationship.id] = element;
                      }}
                    />
                  ) : (
                    <EntitySlotMappingRow
                      key={relationship.id}
                      descriptor={relationship.descriptor}
                      room={selectedRoom}
                      profile={profile}
                      runtime={runtime}
                      disabled={disabled}
                      selected={relationship.id === selectedRelationshipId}
                      onOpen={(input) => activateRelationship(relationship.id, input)}
                      onTriggerElement={(element) => {
                        relationshipElements.current[relationship.id] = element;
                      }}
                    />
                  ),
                )}
              </DeviceMappingGroup>
            ))}
            {groups.length === 0 && (
              <p className="devices-mapping-view__empty">No modeled controls in this room.</p>
            )}
          </div>
        </section>
      </div>
      <DeviceMappingInspector
        manifest={manifest}
        room={selectedRoom}
        relationship={selectedRelationship}
        profile={profile}
        runtime={runtime}
        disabled={disabled}
        state={selectedRelationship ? inspectorState : "closed"}
        onEntityIdsBySlotIdChange={onEntityIdsBySlotIdChange}
        onSelectionMade={(targetLabel) => {
          if (!selectedRelationship) return;
          setAnnouncement(
            targetLabel === "Not connected"
              ? `${selectedRelationship.label} is not connected.`
              : `${selectedRelationship.label} is connected to ${targetLabel}.`,
          );
          setInspectorState("summary");
          focusSelectedRelationship();
        }}
        onCollapse={collapseInspector}
        onReopen={() => setInspectorState("open")}
        onChoiceElement={(element) => {
          choiceElement.current = element;
        }}
      />
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
