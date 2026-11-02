import { ShortcutPicker } from "./ShortcutPicker";
import { useCabaneDom } from "@cabane/engine";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ActionBarBuiltInIcon,
  roomsForFloor,
  RoomShortcutIcon,
  SceneActionSlotFace,
  actionBarBuiltInLabels,
  resolveHaActionShortcut,
  type HomeAssistantRuntimeValue,
  type RuntimeBindingProfile,
  type EntityId,
  createBrowserUuid,
  isActionBarDeviceNavigable,
  resolveActionBarItems,
  type ActionBarItem,
  type DeviceModelRegistry,
  type HomeProject,
} from "@cabane/engine";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { ShortcutDeviceIcon } from "./ShortcutDeviceIcon";
import { moveActionBarItem, removeActionBarItem, replaceActionBarItem } from "./action-bar-edits";
import "./action-bar-editor.css";

type Category = "built-in" | "room" | "device" | "scene" | "script";
type Picker = { kind: Category; replacingId: string | null } | null;

export function ActionBarEditor({
  project,
  runtime,
  profile,
  actionMappingEnabled = false,
  deviceModels,
  walkTools = [],
  roomPictures,
  roomNames = {},
  deviceNames = {},
  disabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChange,
}: {
  runtime?: HomeAssistantRuntimeValue;
  profile?: RuntimeBindingProfile;
  actionMappingEnabled?: boolean;
  walkTools?: readonly import("@cabane/engine").WalkToolDefinition[];
  project: HomeProject;
  deviceModels: DeviceModelRegistry;
  roomPictures: Readonly<Record<string, string | null>>;
  roomNames?: Readonly<Record<string, string>>;
  deviceNames?: Readonly<Record<string, string>>;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChange: (items: readonly ActionBarItem[], mapping?: { id: string; entityId: EntityId }) => void;
}) {
  const dom = useCabaneDom();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [query, setQuery] = useState("");
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLDivElement>(null);
  const items = resolveActionBarItems(project.actionBar, walkTools);
  const rooms = project.floors.flatMap(roomsForFloor);
  const devices = project.sceneItems.filter(
    (item) => item.kind === "device" && isActionBarDeviceNavigable(project, item.id, deviceModels),
  );
  const selected = items.find((item) => item.id === selectedId);
  const actionWarnings =
    runtime && profile
      ? items
          .filter((item) => item.target.kind === "scene" || item.target.kind === "script")
          .map((item) => resolveHaActionShortcut(item, profile, runtime))
          .filter((target) => !target.available)
      : [];
  const missingCount = items.filter((item) => {
    const target = item.target;
    return target.kind === "room"
      ? !rooms.some((room) => room.id === target.roomId)
      : target.kind === "device" && !devices.some((device) => device.id === target.deviceId);
  }).length;
  useEffect(() => {
    const measure = () => {
      if (!bar.current) return;
      if (bar.current.clientWidth <= 0) {
        setCapacity(null);
        return;
      }
      const slot = bar.current.querySelector<HTMLElement>(".scene-action-slot");
      const dock = bar.current.querySelector<HTMLElement>(".scene-action-bar");
      if (!slot || !dock) return;
      const size = Number.parseFloat(window.getComputedStyle(slot).width);
      if (!Number.isFinite(size) || size <= 0) return;
      const style = window.getComputedStyle(dock);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const inset = [
        style.paddingLeft,
        style.paddingRight,
        style.borderLeftWidth,
        style.borderRightWidth,
      ].reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
      setCapacity(Math.max(2, Math.floor((bar.current.clientWidth - inset + gap) / (size + gap))));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (bar.current) observer?.observe(bar.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!picker && selectedId === null && !overflowOpen)) return;
      event.preventDefault();
      if (picker) setPicker(null);
      else if (overflowOpen) setOverflowOpen(false);
      else setSelectedId(null);
    };
    dom.events.addEventListener("keydown", dismiss);
    return () => dom.events.removeEventListener("keydown", dismiss);
  }, [picker, selectedId, overflowOpen, dom]);
  const hasOverflow = capacity !== null && items.length + 1 > capacity;
  const visible = hasOverflow ? items.slice(0, Math.max(0, capacity - 2)) : items;
  const overflow = hasOverflow ? items.slice(visible.length) : [];
  const label = (item: ActionBarItem): string => {
    const target = item.target;
    if (target.kind === "built-in") return actionBarBuiltInLabels[target.action];
    if (target.kind === "walk-tool")
      return walkTools.find((tool) => tool.id === target.toolId)?.label ?? "Unavailable tool";
    if (target.kind === "room")
      return (
        roomNames[target.roomId] ??
        rooms.find((room) => room.id === target.roomId)?.name ??
        "Missing room"
      );
    if (target.kind === "scene" || target.kind === "script")
      return runtime && profile
        ? resolveHaActionShortcut(item, profile, runtime).label
        : `Unmapped ${target.kind}`;
    const device = devices.find((device) => device.id === target.deviceId);
    return device
      ? (deviceNames[device.id] ??
          deviceModels[device.modelId]?.label ??
          device.modelId.replaceAll("-", " "))
      : "Missing device";
  };
  const icon = (item: ActionBarItem) => {
    const target = item.target;
    if (target.kind === "built-in") return <ActionBarBuiltInIcon action={target.action} />;
    if (target.kind === "walk-tool") {
      const tool = walkTools.find((tool) => tool.id === target.toolId);
      return tool ? <tool.Icon /> : <EditorIcon name="devices" />;
    }
    if (target.kind === "room")
      return <RoomShortcutIcon name={label(item)} pictureUrl={roomPictures[target.roomId]} />;
    if (target.kind === "scene" || target.kind === "script")
      return <EditorIcon name={target.kind === "scene" ? "grid" : "chevron"} />;
    const device = devices.find((device) => device.id === target.deviceId);
    return device ? (
      <ShortcutDeviceIcon modelId={device.modelId} models={deviceModels} />
    ) : (
      <EditorIcon name="devices" />
    );
  };
  const slot = (item: ActionBarItem) => (
    <button
      key={item.id}
      type="button"
      className="scene-action-slot is-filled"
      aria-label={`Edit ${label(item)} shortcut`}
      aria-pressed={selectedId === item.id}
      disabled={disabled}
      onClick={() => {
        setSelectedId(item.id);
        setPicker(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedId(item.id);
          requestAnimationFrame(() =>
            tray.current?.querySelector<HTMLButtonElement>("button")?.focus(),
          );
        }
      }}
    >
      <SceneActionSlotFace
        icon={icon(item)}
        label={label(item)}
        shortcut={
          item.target.kind === "built-in"
            ? {
                build: "B",
                walk: "W",
                night: "N",
                weather: undefined,
                view: "V",
                "all-lights": "L",
              }[item.target.action]
            : item.target.kind === "walk-tool"
              ? walkTools.find(
                  (tool) => item.target.kind === "walk-tool" && tool.id === item.target.toolId,
                )?.shortcutKey
              : undefined
        }
        chevron={
          item.target.kind === "built-in" &&
          (item.target.action === "build" ||
            item.target.action === "view" ||
            item.target.action === "weather")
        }
      />
    </button>
  );
  const choose = (target: ActionBarItem["target"], entityId?: EntityId) => {
    if (!picker) return;
    const id = picker.replacingId ?? createBrowserUuid();
    const next = replaceActionBarItem(items, picker.replacingId, target, () => id);
    onChange(next, entityId ? { id, entityId } : undefined);
    setSelectedId(null);
    setPicker(null);
    setQuery("");
    setOverflowOpen(false);
  };
  const openPicker = (kind: Category) => {
    setPicker({ kind, replacingId: selected?.id ?? null });
    setQuery("");
  };
  const matching = (name: string) =>
    name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const duplicate = (target: ActionBarItem["target"]) =>
    items.some(
      (item) =>
        item.id !== picker?.replacingId && JSON.stringify(item.target) === JSON.stringify(target),
    );
  return (
    <section className="shortcuts-workspace" aria-label="Customize shortcuts">
      <div className="shortcuts-workspace__intro">
        <h2>Home action bar</h2>
        <div className="shortcuts-workspace__history" role="group" aria-label="Shortcut history">
          <button type="button" disabled={disabled || !canUndo} onClick={onUndo}>
            <EditorIcon name="undo" />
            Undo
          </button>
          <button type="button" disabled={disabled || !canRedo} onClick={onRedo}>
            <EditorIcon name="redo" />
            Redo
          </button>
          <button
            type="button"
            aria-label="Restore defaults"
            disabled={disabled}
            onClick={() => {
              onChange(
                resolveActionBarItems(undefined, walkTools).map((item) => ({
                  ...item,
                  target: { ...item.target },
                })),
              );
              setSelectedId(null);
              setPicker(null);
            }}
          >
            Restore defaults
          </button>
        </div>
      </div>
      {missingCount > 0 && (
        <p className="shortcuts-workspace__warning" role="alert">
          {missingCount} shortcut target{missingCount === 1 ? " is" : "s are"} missing. Replace or
          remove before Save.
        </p>
      )}
      {actionWarnings.length > 0 && (
        <p className="shortcuts-workspace__warning" role="status">
          {actionWarnings.map((target) => `${target.label}: ${target.reason}`).join(" ")}
        </p>
      )}
      <div className="shortcuts-workspace__canvas">
        {picker ? (
          <ShortcutPicker
            {...{
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
            }}
            onClose={() => setPicker(null)}
          />
        ) : (
          <div className="shortcuts-workspace__prompt">
            <h2>Choose a shortcut</h2>
            <p>Select a shortcut below to edit it, or select Add to create one.</p>
          </div>
        )}
      </div>
      <div className="shortcuts-workspace__bar-zone">
        {selectedId !== null && !picker && (
          <div
            className="shortcuts-workspace__tray"
            ref={tray}
            role="group"
            aria-label={selected ? `Edit ${label(selected)}` : "Add shortcut"}
          >
            <button type="button" disabled={disabled} onClick={() => openPicker("built-in")}>
              <EditorIcon name="grid" />
              {selected ? "Replace with action" : "Add action"}
            </button>
            <button type="button" disabled={disabled} onClick={() => openPicker("room")}>
              <EditorIcon name="rooms" />
              {selected ? "Replace with room" : "Add room"}
            </button>
            <button type="button" disabled={disabled} onClick={() => openPicker("device")}>
              <EditorIcon name="devices" />
              {selected ? "Replace with device" : "Add device"}
            </button>
            {(["scene", "script"] as const).map((kind) => (
              <button key={kind} type="button" disabled={disabled} onClick={() => openPicker(kind)}>
                <EditorIcon name={kind === "scene" ? "grid" : "chevron"} />
                {selected ? `Replace with ${kind}` : `Add ${kind}`}
              </button>
            ))}
            {selected && (
              <div
                className="shortcuts-workspace__tray-actions"
                role="group"
                aria-label="Shortcut position and removal"
              >
                <span className="shortcuts-workspace__tray-separator" />
                <button
                  type="button"
                  aria-label="Move left"
                  disabled={disabled || items[0]?.id === selected.id}
                  onClick={() => onChange(moveActionBarItem(items, selected.id, -1))}
                >
                  <EditorIcon name="chevronLeft" />
                </button>
                <button
                  type="button"
                  aria-label="Move right"
                  disabled={disabled || items.at(-1)?.id === selected.id}
                  onClick={() => onChange(moveActionBarItem(items, selected.id, 1))}
                >
                  <EditorIcon name="chevron" />
                </button>
                <button
                  type="button"
                  aria-label="Remove shortcut"
                  disabled={disabled}
                  onClick={() => {
                    onChange(removeActionBarItem(items, selected.id));
                    setSelectedId(null);
                  }}
                >
                  <EditorIcon name="delete" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="shortcuts-workspace__bar-measure" ref={bar}>
          <nav className="scene-action-dock" aria-label="Draft action bar">
            <div
              className="scene-action-bar"
              style={
                {
                  "--scene-action-count": visible.length + (hasOverflow ? 1 : 0) + 1,
                } as CSSProperties
              }
            >
              {visible.map(slot)}
              {hasOverflow && (
                <div className="scene-action-overflow">
                  <button
                    type="button"
                    className="scene-action-slot is-filled"
                    aria-label="More shortcuts"
                    aria-expanded={overflowOpen}
                    onClick={() => setOverflowOpen(!overflowOpen)}
                  >
                    <SceneActionSlotFace icon="•••" label="More" />
                  </button>
                  {overflowOpen && (
                    <div
                      className="scene-action-overflow__tray"
                      role="group"
                      aria-label="More shortcuts"
                    >
                      {overflow.map(slot)}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className="scene-action-slot shortcuts-workspace__empty"
                aria-label="Add shortcut"
                aria-pressed={selectedId === ""}
                disabled={disabled}
                onClick={() => {
                  setSelectedId("");
                  setPicker(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedId("");
                    requestAnimationFrame(() =>
                      tray.current?.querySelector<HTMLButtonElement>("button")?.focus(),
                    );
                  }
                }}
              >
                <SceneActionSlotFace icon={<EditorIcon name="plus" />} label="Add" />
              </button>
            </div>
          </nav>
        </div>
      </div>
    </section>
  );
}
