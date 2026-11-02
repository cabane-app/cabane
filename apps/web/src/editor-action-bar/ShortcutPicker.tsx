import {
  ActionBarBuiltInIcon,
  RoomShortcutIcon,
  actionBarBuiltInLabels,
  haActionShortcutChoices,
  resolvedRoomIdForItem,
  type ActionBarBuiltIn,
  type ActionBarItem,
  type HomeProject,
  type HomeAssistantRuntimeValue,
  type RuntimeBindingProfile,
  type DeviceModelRegistry,
  type EntityId,
  type WalkToolDefinition,
} from "@cabane/engine";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { ShortcutDeviceIcon } from "./ShortcutDeviceIcon";
const builtIns: ActionBarBuiltIn[] = ["build", "walk", "night", "weather", "view", "all-lights"];
type Props = {
  picker: { kind: "built-in" | "room" | "device" | "scene" | "script"; replacingId: string | null };
  project: HomeProject;
  runtime?: HomeAssistantRuntimeValue | undefined;
  profile?: RuntimeBindingProfile | undefined;
  actionMappingEnabled: boolean;
  deviceModels: DeviceModelRegistry;
  walkTools: readonly WalkToolDefinition[];
  roomPictures: Readonly<Record<string, string | null>>;
  roomNames: Readonly<Record<string, string>>;
  deviceNames: Readonly<Record<string, string>>;
  disabled: boolean;
  rooms: readonly { id: string; name: string }[];
  devices: HomeProject["sceneItems"];
  query: string;
  setQuery: (query: string) => void;
  matching: (name: string) => boolean;
  duplicate: (target: ActionBarItem["target"]) => boolean;
  choose: (target: ActionBarItem["target"], entityId?: EntityId) => void;
  onClose: () => void;
};
export function ShortcutPicker({
  picker,
  project,
  runtime,
  profile,
  actionMappingEnabled,
  deviceModels,
  walkTools,
  roomPictures,
  roomNames,
  deviceNames,
  disabled,
  rooms,
  devices,
  query,
  setQuery,
  matching,
  duplicate,
  choose,
  onClose,
}: Props) {
  const deviceGroups = [
    ...rooms.map((room) => ({ id: room.id, name: roomNames[room.id] ?? room.name })),
    ...project.floors.map((floor) => ({
      id: `outside-rooms:${floor.id}`,
      name: project.floors.length > 1 ? `Outside rooms · ${floor.name}` : "Outside rooms",
    })),
  ]
    .map((group) => ({
      ...group,
      choices: devices.filter((device) => {
        const roomId = resolvedRoomIdForItem(device, project, deviceModels[device.modelId]);
        const groupId = roomId ?? `outside-rooms:${device.floorId}`;
        return (
          groupId === group.id &&
          (matching(group.name) ||
            matching(
              deviceNames[device.id] ?? deviceModels[device.modelId]?.label ?? device.modelId,
            ))
        );
      }),
    }))
    .filter((group) => group.choices.length > 0);
  return (
    <div className="shortcuts-picker">
      <div className="shortcuts-picker__heading">
        <div>
          <h2>
            {picker.kind === "built-in"
              ? "Choose an action"
              : picker.kind === "room"
                ? "Choose a room"
                : picker.kind === "device"
                  ? "Choose a device"
                  : `Choose a ${picker.kind}`}
          </h2>
          <p>
            {picker.replacingId ? "Replace the selected shortcut" : "Add a shortcut to the bar"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close choices">
          <EditorIcon name="close" />
        </button>
      </div>
      <label className="shortcuts-picker__search">
        <EditorIcon name="search" />
        <input
          type="search"
          value={query}
          placeholder="Search…"
          aria-label="Search shortcut choices"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="shortcuts-picker__grid">
        {(picker.kind === "scene" || picker.kind === "script") && (
          <>
            {!actionMappingEnabled || runtime?.status !== "connected" ? (
              <p>Connect to Home Assistant to choose scenes and scripts.</p>
            ) : (
              <>
                {haActionShortcutChoices(picker.kind, runtime)
                  .filter((choice) => matching(choice.label) || matching(choice.entityId))
                  .map((choice) => (
                    <button
                      key={choice.entityId}
                      type="button"
                      aria-label={choice.label}
                      title={choice.reason}
                      disabled={
                        disabled ||
                        !choice.available ||
                        Object.entries(profile?.actionEntityIdsByShortcutId ?? {}).some(
                          ([id, entityId]) =>
                            id !== picker.replacingId && entityId === choice.entityId,
                        )
                      }
                      onClick={() =>
                        choose({ kind: picker.kind as "scene" | "script" }, choice.entityId)
                      }
                    >
                      <span className="shortcuts-picker__icon">
                        <EditorIcon name={picker.kind === "scene" ? "grid" : "chevron"} />
                      </span>
                      <strong>{choice.label}</strong>
                      <small>{choice.entityId}</small>
                      {!choice.available && <small>Unavailable</small>}
                    </button>
                  ))}
                {haActionShortcutChoices(picker.kind, runtime).length === 0 && (
                  <p>No {picker.kind}s are available in Home Assistant.</p>
                )}
              </>
            )}
          </>
        )}
        {picker.kind === "built-in" &&
          builtIns
            .filter((action) => matching(actionBarBuiltInLabels[action]))
            .map((action) => {
              const target = { kind: "built-in" as const, action };
              return (
                <button
                  key={action}
                  type="button"
                  aria-label={actionBarBuiltInLabels[action]}
                  disabled={disabled || duplicate(target)}
                  onClick={() => choose(target)}
                >
                  <span className="shortcuts-picker__icon">
                    <ActionBarBuiltInIcon action={action} />
                  </span>
                  <strong>{actionBarBuiltInLabels[action]}</strong>
                </button>
              );
            })}
        {picker.kind === "built-in" &&
          walkTools
            .filter((tool) => matching(tool.label))
            .map((tool) => {
              const target = { kind: "walk-tool" as const, toolId: tool.id };
              return (
                <button
                  key={tool.id}
                  type="button"
                  aria-label={tool.label}
                  disabled={disabled || duplicate(target)}
                  onClick={() => choose(target)}
                >
                  <span className="shortcuts-picker__icon">
                    <tool.Icon />
                  </span>
                  <strong>{tool.label}</strong>
                  <small>Walk mode</small>
                </button>
              );
            })}
        {picker.kind === "room" &&
          rooms
            .filter((room) => matching(roomNames[room.id] ?? room.name))
            .map((room) => {
              const target = { kind: "room" as const, roomId: room.id };
              return (
                <button
                  key={room.id}
                  type="button"
                  aria-label={roomNames[room.id] ?? room.name}
                  disabled={disabled || duplicate(target)}
                  onClick={() => choose(target)}
                >
                  <span className="shortcuts-picker__icon">
                    <RoomShortcutIcon
                      name={roomNames[room.id] ?? room.name}
                      pictureUrl={roomPictures[room.id]}
                    />
                  </span>
                  <strong>{roomNames[room.id] ?? room.name}</strong>
                </button>
              );
            })}
        {picker.kind === "device" &&
          deviceGroups.map(({ id, name: roomName, choices }) => {
            return (
              <section className="shortcuts-picker__room" key={id} aria-label={roomName}>
                <h3>{roomName}</h3>
                <div className="shortcuts-picker__room-grid">
                  {choices.map((device) => {
                    const target = { kind: "device" as const, deviceId: device.id };
                    const name =
                      deviceNames[device.id] ??
                      deviceModels[device.modelId]?.label ??
                      device.modelId.replaceAll("-", " ");
                    return (
                      <button
                        key={device.id}
                        type="button"
                        aria-label={`${name} · ${roomName}`}
                        disabled={disabled || duplicate(target)}
                        onClick={() => choose(target)}
                      >
                        <span className="shortcuts-picker__icon">
                          <ShortcutDeviceIcon modelId={device.modelId} models={deviceModels} />
                        </span>
                        <strong>{name}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        {picker.kind === "device" && deviceGroups.length === 0 && (
          <p>
            {devices.length
              ? "No devices match your search."
              : "No devices are available. Add one in Arrange first."}
          </p>
        )}
      </div>
    </div>
  );
}
