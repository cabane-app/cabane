import { useMemo, useState } from "react";
import {
  DeviceCategoryIcon,
  entityConnectionSummary,
  type DeviceMappingRelationship,
  type DeviceModelRegistry,
  type HomeBindingManifest,
} from "@cabane/engine";
import type { ConnectEditor } from "./useConnectEditor";
import { ModelThumbnail } from "../editor-preview/furnish/catalog/ModelThumbnailRenderer";
import type { ModelPreviewEntry } from "../editor-preview/furnish/catalog/model-preview-entry";
import { openingPreviewEntry } from "../editor-preview/openings/opening-preview-entry";

export function ConnectDevicePreview({
  relationship,
  models,
  manifest,
  selected = false,
}: {
  relationship: DeviceMappingRelationship;
  models: DeviceModelRegistry;
  manifest: HomeBindingManifest;
  selected?: boolean;
}) {
  const definition =
    relationship.kind === "modeled-device" ? models[relationship.device.model] : undefined;
  const modelId = relationship.kind === "modeled-device" ? relationship.device.model : "";
  const openingId =
    relationship.kind === "entity-slot" ? relationship.descriptor.openingId : undefined;
  const entry = useMemo<ModelPreviewEntry | null>(
    () =>
      openingId
        ? openingPreviewEntry(manifest, openingId)
        : definition
          ? { key: `device:${modelId}`, kind: "device", modelId, definition }
          : null,
    [definition, modelId, manifest, openingId],
  );
  const domain =
    relationship.kind === "modeled-device"
      ? (relationship.device.entitySlots.find((slot) => slot.deviceRole === "primary")
          ?.compatibleDomains[0] ?? relationship.device.entitySlots[0]?.compatibleDomains[0])
      : relationship.descriptor.spec.compatibleDomains[0];
  const fallback = <DeviceCategoryIcon domain={domain ?? "unknown"} size={30} />;
  return (
    <span
      className={`connect-device-preview${selected ? " is-selected-preview" : ""}`}
      aria-hidden="true"
    >
      {entry ? (
        <ModelThumbnail entry={entry} showAdd={false} fallback={fallback} />
      ) : (
        <span className="connect-device-preview__icon">{fallback}</span>
      )}
    </span>
  );
}

export function ConnectDeviceGrid({
  editor,
  manifest,
  models,
  onOpen,
}: {
  editor: ConnectEditor;
  manifest: HomeBindingManifest;
  models: DeviceModelRegistry;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const relationships = editor.groups.flatMap((group) => group.relationships);
  const matches = relationships.filter((relationship) =>
    relationship.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <nav className="connect-device-rail" aria-label="Devices in this room">
      <header className="connect-device-rail__heading connection-column-heading">
        <h2>{editor.room?.name}</h2>
        <p>{relationships.length} devices and connections</p>
      </header>
      <label className="connect-device-search">
        <input
          type="search"
          aria-label="Find a device in this room"
          placeholder="Find a device…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="connect-device-rail__list">
        {matches.map((relationship) => {
          const descriptors =
            relationship.kind === "modeled-device"
              ? relationship.descriptors
              : [relationship.descriptor];
          const primary =
            descriptors.find((descriptor) => descriptor.spec.deviceRole === "primary") ??
            descriptors[0];
          const current = primary ? editor.profile.entityIdsBySlotId[primary.slotId] : undefined;
          const summary = entityConnectionSummary(current, editor.displayRuntime);
          const missing = descriptors.filter(
            (descriptor) =>
              descriptor.spec.required && !editor.profile.entityIdsBySlotId[descriptor.slotId],
          ).length;
          return (
            <button
              type="button"
              key={relationship.id}
              aria-pressed={editor.relationshipId === relationship.id}
              onClick={() => onOpen(relationship.id)}
              className="connect-device-nav"
            >
              <ConnectDevicePreview
                relationship={relationship}
                models={models}
                manifest={manifest}
              />
              <span>
                <strong>{relationship.label}</strong>
                <small
                  className={
                    !current || missing ? "is-pending" : !summary.available ? "is-unavailable" : ""
                  }
                >
                  {missing
                    ? `${missing} connection${missing === 1 ? "" : "s"} to finish`
                    : summary.status}
                </small>
              </span>
            </button>
          );
        })}
        {!matches.length && (
          <p className="connect-empty">
            {relationships.length ? "No matching devices." : "No devices in this room."}
          </p>
        )}
      </div>
    </nav>
  );
}
