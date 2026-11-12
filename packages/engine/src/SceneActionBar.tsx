import { ExtensionActionSlot } from "./action-bar/ExtensionActionSlot";
import { OrbitViewMenu } from "./action-bar/OrbitViewMenu";
import { SceneActionButton } from "./action-bar/SceneActionButton";
import { SceneActionGroup } from "./action-bar/SceneActionGroup";
import { WeatherMenu, type WeatherMenuProps } from "./weather/WeatherMenu";
import { SceneActionTargetSlot } from "./action-bar/SceneActionTargetSlot";
import type { ResolvedActionBarTarget } from "./action-bar/dashboard-action-targets";
import { useCabaneDom } from "./CabaneDom";
import viewIcon from "./assets/scene-actions/view.png";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import allLightsActionIcon from "./assets/scene-actions/all-lights.png";

import arrangeModeActionIcon from "./assets/scene-actions/arrange-mode.png";

import connectModeActionIcon from "./assets/scene-actions/connect-mode.png";

import constructModeActionIcon from "./assets/scene-actions/construct-mode.png";

import dayNightActionIcon from "./assets/scene-actions/day-night.png";

import examineRoomActionIcon from "./assets/scene-actions/examine-room.png";

import walkModeActionIcon from "./assets/scene-actions/walk-mode.png";

import wallTransparencyActionIcon from "./assets/scene-actions/wall-transparency.png";

import { type SolarLightingMode } from "./lighting";

import type { BuiltInShortcutId, SceneMode, ShortcutSpec } from "./types";
import { resolveActionBarItems, type ActionBarItem } from "./action-bar/action-bar-config";
import { SceneActionSlotFace } from "./SceneActionSlotFace";

const sceneActions: readonly ShortcutSpec[] = [
  { id: "construct", action: "construct-mode", context: "both", order: 0 },
  { id: "arrange", action: "arrange-mode", context: "both", order: 1 },
  { id: "connect", action: "connect-mode", context: "both", order: 2 },
  { id: "walk", action: "walk-mode", context: "both", order: 3 },
  { id: "lighting", action: "lighting-mode", context: "both", order: 4 },
  { id: "walls", action: "wall-fade", context: "both", order: 5 },
  { id: "lights", action: "all-lights", context: "both", order: 6 },
];

function ActionIcon({ action }: { action: BuiltInShortcutId }) {
  const paths: Record<BuiltInShortcutId, ReactNode> = {
    "home-view": (
      <>
        <path d="m3.5 11 8.5-7.4 8.5 7.4" />
        <path d="M5.8 9.5V20h12.4V9.5M9.5 20v-6h5v6" />
      </>
    ),
    "room-details": (
      <>
        <path d="M5 4.5h14v15H5z" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </>
    ),
    "construct-mode": <path d="m14 3 7 7-3 3-3-3L5 20l-3-3L12 7l-1-1z" />,
    "arrange-mode": <path d="M4 7h16v12H4zM8 7V4h8v3M8 12h8M12 9v6" />,
    "connect-mode": (
      <path d="m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
    ),
    "walk-mode": (
      <>
        <circle cx="12" cy="4.6" r="2" />
        <path d="m10.5 8-2 5 3 2.2-1.5 5M13.4 8.4l2.1 4.1 3 .5M11.5 15.2l4.3 4.3" />
      </>
    ),
    "lighting-mode": (
      <>
        <circle cx="12" cy="12" r="3.6" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </>
    ),
    "wall-fade": (
      <>
        <path d="M4 19V5h16v14" />
        <path d="M8 5v14M12 5v14" opacity=".42" />
        <path d="M16 5v14" opacity=".16" />
      </>
    ),
    "all-lights": (
      <>
        <path d="M9 15.8h6M9.8 19h4.4" />
        <path d="M8.5 13.5c-1.2-1-2-2.4-2-4a5.5 5.5 0 0 1 11 0c0 1.6-.8 3.1-2.1 4.1-.7.6-1 1.2-1 2.2h-4.8c0-1-.3-1.7-1.1-2.3Z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[action]}
    </svg>
  );
}

const actionLabel = (
  shortcut: ShortcutSpec,
  mode: SceneMode,
  lighting: SolarLightingMode,
  wallFade: boolean,
) => {
  switch (shortcut.action) {
    case "home-view":
      return "Home view";
    case "room-details":
      return "Room view";
    case "construct-mode":
      return "Open Construct";
    case "arrange-mode":
      return "Open Arrange";
    case "connect-mode":
      return "Open Connect";
    case "walk-mode":
      return mode === "walk" ? "Exit walk mode" : "Walk mode";
    case "lighting-mode":
      return lighting === "night" ? "Use daylight" : "Use night lighting";
    case "wall-fade":
      return wallFade ? "Keep walls solid" : "Fade facing walls";
    case "all-lights":
      return "Turn off all available Home Assistant lights";
  }
};

const actionCaption = (
  shortcut: ShortcutSpec,
  mode: SceneMode,
  lighting: SolarLightingMode,
  wallFade: boolean,
) => {
  switch (shortcut.action) {
    case "home-view":
      return "Home";
    case "room-details":
      return "Room";
    case "construct-mode":
      return "Construct";
    case "arrange-mode":
      return "Arrange";
    case "connect-mode":
      return "Connect";
    case "walk-mode":
      return mode === "walk" ? "Exit walk" : "Walk";
    case "lighting-mode":
      return lighting === "night" ? "Daylight" : "Night";
    case "wall-fade":
      return wallFade ? "Solid walls" : "Fade walls";
    case "all-lights":
      return "Lights off";
  }
};

const actionIllustration: Partial<Record<BuiltInShortcutId, string>> = {
  "room-details": examineRoomActionIcon,
  "construct-mode": constructModeActionIcon,
  "arrange-mode": arrangeModeActionIcon,
  "connect-mode": connectModeActionIcon,
  "walk-mode": walkModeActionIcon,
  "lighting-mode": dayNightActionIcon,
  "wall-fade": wallTransparencyActionIcon,
  "all-lights": allLightsActionIcon,
};

const actionKeyboardShortcut: Partial<
  Record<
    BuiltInShortcutId,
    {
      aria: string;
      label: string;
    }
  >
> = {
  "construct-mode": { aria: "C", label: "C" },
  "arrange-mode": { aria: "A", label: "A" },
  "connect-mode": { aria: "Shift+C", label: "⇧C" },
  "walk-mode": { aria: "W", label: "W" },
  "lighting-mode": { aria: "N", label: "N" },
  "wall-fade": { aria: "S", label: "S" },
  "all-lights": { aria: "L", label: "L" },
};

export function orbitalEditorActionFromKey(
  key: string,
  shiftKey = false,
): BuiltInShortcutId | null {
  const normalized = key.toLowerCase();
  if (normalized === "a" && !shiftKey) return "arrange-mode";
  if (normalized === "c") return shiftKey ? "connect-mode" : "construct-mode";
  if (shiftKey) return null;
  if (normalized === "w") return "walk-mode";
  if (normalized === "n") return "lighting-mode";
  if (normalized === "s") return "wall-fade";
  if (normalized === "l") return "all-lights";
  return null;
}

export function clampActionTrayLeft(
  triggerLeft: number,
  triggerWidth: number,
  trayWidth: number,
  sceneLeft: number,
  sceneRight: number,
): number {
  return Math.max(
    sceneLeft + 8,
    Math.min(triggerLeft + triggerWidth / 2 - trayWidth / 2, sceneRight - trayWidth - 8),
  );
}

export function SceneActionBar({
  walkTools = [],
  sceneFeatures = [],
  activeSceneFeatureIds,
  items = resolveActionBarItems(undefined, walkTools),
  targets = {},
  activeWalkToolId,
  mode,
  lighting,
  wallFade,
  allLightsEnabled,
  allLightsBusy,
  onAction,
  renderDeviceIcon,
  onChildAction = () => undefined,
  roofVisible = false,
  onToggleRoof,
  keyboardEnabled = true,
  weather,
  viewLocked = false,
  onToggleViewLock,
  onTopDown,
  onResetView,
}: {
  viewLocked?: boolean;
  onToggleViewLock?: () => void;
  onTopDown?: () => void;
  onResetView?: () => void;
  weather?: WeatherMenuProps | undefined;
  items?: readonly ActionBarItem[];
  walkTools?: readonly import("./walk-tools").WalkToolDefinition[] | undefined;
  activeWalkToolId?: string | null;
  sceneFeatures?: readonly import("./scene-features/types").SceneFeatureDefinition[] | undefined;
  activeSceneFeatureIds?: ReadonlySet<string>;
  targets?: Readonly<Record<string, ResolvedActionBarTarget>>;
  renderDeviceIcon?: ((modelId: string) => ReactNode) | undefined;
  roofVisible?: boolean;
  onToggleRoof?: (() => void) | undefined;
  keyboardEnabled?: boolean;
  mode: SceneMode;
  lighting: SolarLightingMode;
  wallFade: boolean;
  allLightsEnabled: boolean;
  allLightsBusy: boolean;
  onAction: (item: ActionBarItem) => void;
  onChildAction?: (action: BuiltInShortcutId) => void;
}) {
  const dom = useCabaneDom();
  const [open, setOpen] = useState<"Build" | "View" | "Weather" | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [visibleCapacity, setVisibleCapacity] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const shell = root.current?.parentElement;
    if (!shell) return;
    const measure = () => {
      const vertical =
        window.matchMedia?.("(orientation: landscape) and (max-height: 600px)").matches ?? false;
      const available = vertical
        ? shell.getBoundingClientRect().height - 64
        : shell.getBoundingClientRect().width - 14;
      const slot = root.current?.querySelector<HTMLButtonElement>(
        ".scene-action-bar .scene-action-slot",
      );
      const size = Number.parseFloat(slot ? window.getComputedStyle(slot).width : "") || 60;
      setVisibleCapacity(Math.max(1, Math.floor((available - 10 + 6) / (size + 6))));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(shell);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(null);
        setOverflowOpen(false);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && overflowOpen) {
        root.current?.querySelector<HTMLButtonElement>("[data-more-actions]")?.focus();
        setOverflowOpen(false);
        setOpen(null);
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && open) {
        root.current?.querySelector<HTMLButtonElement>(`[data-group="${open}"]`)?.focus();
        setOpen(null);
        event.preventDefault();
        return;
      }
      if (
        !keyboardEnabled ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        dom.root.querySelector("dialog[open]") ||
        (event.target instanceof HTMLElement &&
          (event.target.closest("input, textarea, select") || event.target.isContentEditable))
      )
        return;
      if (mode === "walk") {
        const tool = walkTools.find(
          (tool) => tool.shortcutKey?.toLowerCase() === event.key.toLowerCase(),
        );
        const item =
          tool &&
          items.find((item) => item.target.kind === "walk-tool" && item.target.toolId === tool.id);
        if (item) {
          event.preventDefault();
          onAction(item);
        }
        return;
      }
      const group =
        event.key.toLowerCase() === "b" ? "Build" : event.key.toLowerCase() === "v" ? "View" : null;
      if (
        group &&
        items.some(
          (item) => item.target.kind === "built-in" && item.target.action === group.toLowerCase(),
        )
      ) {
        event.preventDefault();
        setOpen(open === group ? null : group);
        root.current?.querySelector<HTMLButtonElement>(`[data-group="${group}"]`)?.focus();
      }
      if (event.key.toLowerCase() === "r" && onToggleRoof) {
        event.preventDefault();
        onToggleRoof();
      }
    };
    dom.events.addEventListener("pointerdown", outside);
    dom.events.addEventListener("keydown", keydown);
    return () => {
      dom.events.removeEventListener("pointerdown", outside);
      dom.events.removeEventListener("keydown", keydown);
    };
  }, [open, overflowOpen, keyboardEnabled, mode, onToggleRoof, items, walkTools, onAction, dom]);
  useEffect(() => {
    if (!open) return;
    const trigger = root.current?.querySelector<HTMLButtonElement>(`[data-group="${open}"]`);
    const group = trigger?.closest<HTMLElement>(".scene-action-group");
    const tray = group?.querySelector<HTMLElement>(".scene-action-group__tray");
    const shell = root.current?.parentElement;
    if (!trigger || !group || !tray || !shell || group.closest(".scene-action-overflow__tray"))
      return;
    const position = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      const sceneRect = shell.getBoundingClientRect();
      const trayWidth = tray.getBoundingClientRect().width;
      tray.style.left = `${
        clampActionTrayLeft(
          triggerRect.left,
          triggerRect.width,
          trayWidth,
          sceneRect.left,
          sceneRect.right,
        ) - groupRect.left
      }px`;
      tray.style.transform = "none";
    };
    position();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(position);
    observer?.observe(shell);
    window.addEventListener("resize", position);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
      tray.style.removeProperty("left");
      tray.style.removeProperty("transform");
    };
  }, [open, items, visibleCapacity]);
  const group = (name: "Build" | "View" | "Weather", children: ReactNode) => (
    <SceneActionGroup
      name={name}
      open={open === name}
      onOpen={(value) => setOpen(value ? name : null)}
    >
      {children}
    </SceneActionGroup>
  );
  const renderAction = (shortcut: ShortcutSpec, item?: ActionBarItem) => {
    const disabled = shortcut.action === "all-lights" && !allLightsEnabled;
    const busy = shortcut.action === "all-lights" && allLightsBusy;
    const active =
      (shortcut.action === "home-view" && mode === "overview") ||
      (shortcut.action === "room-details" && mode === "room") ||
      (shortcut.action === "walk-mode" && mode === "walk") ||
      (shortcut.action === "wall-fade" && wallFade);
    const keyboardShortcut = actionKeyboardShortcut[shortcut.action];
    const label = actionLabel(shortcut, mode, lighting, wallFade);
    return (
      <SceneActionButton
        key={item?.id ?? shortcut.id}
        active={active}
        busy={busy}
        disabled={disabled}
        accessibleLabel={label}
        label={actionCaption(shortcut, mode, lighting, wallFade)}
        shortcut={keyboardShortcut}
        icon={
          actionIllustration[shortcut.action] ? (
            <img src={actionIllustration[shortcut.action]} alt="" draggable={false} />
          ) : (
            <ActionIcon action={shortcut.action} />
          )
        }
        onClick={() => {
          setOpen(null);
          setOverflowOpen(false);
          if (item) onAction(item);
          else onChildAction(shortcut.action);
        }}
      />
    );
  };
  const renderItem = (item: ActionBarItem) => {
    if (item.target.kind === "walk-tool" || item.target.kind === "scene-feature")
      return (
        <ExtensionActionSlot
          key={item.id}
          {...{ item, walkTools, sceneFeatures, mode, activeWalkToolId, activeSceneFeatureIds }}
          onAction={(item) => {
            setOverflowOpen(false);
            onAction(item);
          }}
        />
      );
    if (item.target.kind !== "built-in") {
      const target = targets[item.id] ?? {
        label: `Unavailable ${item.target.kind}`,
        available: false,
      };
      return (
        <SceneActionTargetSlot
          key={item.id}
          {...{ item, target, renderDeviceIcon }}
          onAction={(item) => {
            setOverflowOpen(false);
            onAction(item);
          }}
        />
      );
    }
    switch (item.target.action) {
      case "build":
        return (
          <Fragment key={item.id}>
            {group(
              "Build",
              sceneActions.slice(0, 3).map((shortcut) => renderAction(shortcut)),
            )}
          </Fragment>
        );
      case "weather":
        return (
          <Fragment key={item.id}>
            {group(
              "Weather",
              <WeatherMenu
                preview={weather?.preview ?? "clear"}
                liveAvailable={weather?.liveAvailable ?? false}
                status={weather?.status ?? "Weather preview is unavailable here."}
                onSelect={(value) => {
                  weather?.onSelect(value);
                  root.current?.querySelector<HTMLButtonElement>('[data-group="Weather"]')?.focus();
                  setOpen(null);
                  setOverflowOpen(false);
                }}
              />,
            )}
          </Fragment>
        );
      case "walk":
        return renderAction(sceneActions[3], item);
      case "night":
        return renderAction(sceneActions[4], item);
      case "view":
        return (
          <Fragment key={item.id}>
            {group(
              "View",
              <>
                {renderAction(sceneActions[5])}
                <OrbitViewMenu
                  locked={viewLocked}
                  disabled={mode === "walk"}
                  onTopDown={onTopDown}
                  onResetView={onResetView}
                  onToggleLock={onToggleViewLock}
                  onClose={() => {
                    setOpen(null);
                    setOverflowOpen(false);
                  }}
                />
                <button
                  type="button"
                  className={`scene-action-slot is-filled ${roofVisible ? "is-active" : ""}`}
                  aria-label={roofVisible ? "Hide roof" : "Show roof"}
                  aria-pressed={roofVisible}
                  aria-keyshortcuts="R"
                  disabled={!onToggleRoof || mode === "walk"}
                  onClick={() => {
                    setOpen(null);
                    onToggleRoof?.();
                  }}
                >
                  <SceneActionSlotFace
                    icon={<img src={viewIcon} alt="" draggable={false} />}
                    label={roofVisible ? "Hide roof" : "Show roof"}
                    shortcut="R"
                  />
                </button>
              </>,
            )}
          </Fragment>
        );
      case "all-lights":
        return renderAction(sceneActions[6], item);
    }
  };
  if (items.length === 0) return null;
  const hasOverflow = visibleCapacity !== null && items.length > visibleCapacity;
  const visibleItems = hasOverflow ? items.slice(0, Math.max(0, visibleCapacity - 1)) : items;
  const overflowItems = hasOverflow ? items.slice(visibleItems.length) : [];
  return (
    <nav
      ref={root}
      className="scene-action-dock"
      data-collapsed={collapsed}
      aria-label="Scene actions"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          event.preventDefault();
          root.current?.querySelector<HTMLButtonElement>(`[data-group="${open}"]`)?.focus();
          setOpen(null);
        }
      }}
    >
      <button
        type="button"
        className="scene-action-dock__toggle"
        aria-label={collapsed ? "Show action bar" : "Hide action bar"}
        aria-expanded={!collapsed}
        aria-controls="scene-action-bar"
        title={collapsed ? "Show action bar" : "Hide action bar"}
        onClick={() => {
          setOpen(null);
          setCollapsed((value) => !value);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 14 6-6 6 6" />
        </svg>
      </button>
      <div
        id="scene-action-bar"
        className="scene-action-bar"
        hidden={collapsed}
        style={
          { "--scene-action-count": visibleItems.length + (hasOverflow ? 1 : 0) } as CSSProperties
        }
      >
        {visibleItems.map(renderItem)}
        {hasOverflow && (
          <div className="scene-action-overflow">
            <button
              type="button"
              className="scene-action-slot is-filled"
              data-more-actions
              aria-label="More actions"
              aria-expanded={overflowOpen}
              aria-controls="scene-action-overflow"
              onClick={() => {
                setOpen(null);
                setOverflowOpen((value) => !value);
              }}
            >
              <span className="scene-action-slot__icon" aria-hidden="true">
                •••
              </span>
              <span className="scene-action-slot__label" aria-hidden="true">
                More
              </span>
            </button>
            <div
              id="scene-action-overflow"
              className="scene-action-overflow__tray"
              role="group"
              aria-label="More actions list"
              hidden={!overflowOpen}
            >
              {overflowItems.map(renderItem)}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
