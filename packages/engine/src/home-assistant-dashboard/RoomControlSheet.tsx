import { useCabaneDom } from "./../CabaneDom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SupportedServiceCall } from "../home-assistant-controls";
import type { HomeAssistantConnectionStatus, ResolvedRoomBindings } from "../types";
import { RoomStatusBadges } from "../room-status/RoomStatusBadges";
import type { RoomStatusSummary } from "../room-status/model";
import { RoomModuleReorder, ReorderIcon } from "./RoomModuleReorder";
import { useRoomModuleOrder } from "./useRoomModuleOrder";
import { RoomModule } from "./RoomModule";
import { buildRoomModules, focusedDeviceModule, roomOverviewModules } from "./module-model";
import { useBottomSheetDrag } from "./useBottomSheetDrag";
import { useRoomHeroParallax } from "./useRoomHeroParallax";

import { RoomCleanAction } from "./RoomCleanAction";
import { HaRoomDashboard } from "../room-dashboards/HaRoomDashboard";
import type { RoomDashboardSettings } from "../room-dashboards/room-dashboard";
import { useHomeAssistantHostSession } from "../HomeAssistantHostSession";
import { useHomeAssistantRuntime } from "../HomeAssistantRuntimeContext";

export interface RoomControlSheetProps {
  dashboardSettings?: RoomDashboardSettings | undefined;
  cleaningAreaId?: string | undefined;
  homeId?: string;
  resolved: ResolvedRoomBindings;
  roomStatus: RoomStatusSummary | undefined;
  status: HomeAssistantConnectionStatus;
  canMutate: boolean;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string | null) => void;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
  onHome: () => void;
  onWalk: () => void;
  onConnectDevices?: (() => void) | undefined;
  onReconnect: () => void;
  onRetry: () => void;
  liveCameraDeviceIds?: ReadonlySet<string>;
  onOpenLiveFeed?: (deviceId: string) => void;
  deviceOverlay?: boolean;
  onEscape?: (() => void) | undefined;
}

const statusContent: Partial<
  Record<
    HomeAssistantConnectionStatus,
    {
      label: string;
      detail: string;
      action?: "reconnect" | "retry";
    }
  >
> = {
  authenticating: {
    label: "Home Assistant is authenticating",
    detail: "Finishing the secure connection…",
  },
  connecting: {
    label: "Home Assistant is connecting",
    detail: "Connecting to your home…",
  },
  reconnecting: {
    label: "Home Assistant is reconnecting",
    detail: "Controls will return as soon as the connection is restored.",
  },
  disconnected: {
    label: "Home Assistant is disconnected",
    detail: "Reconnect to use live controls.",
    action: "reconnect",
  },
  "auth-expired": {
    label: "Home Assistant authentication expired",
    detail: "Reconnect to securely authorize this home again.",
    action: "reconnect",
  },
  error: {
    label: "Home Assistant connection failed",
    detail: "The connection could not be restored.",
    action: "retry",
  },
};

function ConnectionProblem({
  status,
  onReconnect,
  onRetry,
}: {
  status: HomeAssistantConnectionStatus;
  onReconnect: () => void;
  onRetry: () => void;
}) {
  const content = statusContent[status];
  if (!content) return null;
  return (
    <details className={`connection-problem status-${status}`} aria-live="polite">
      <summary aria-label={content.label}>
        <span className="connection-problem__dot" aria-hidden="true" />
        <span>{content.label.replace("Home Assistant is ", "")}</span>
      </summary>
      <div className="connection-problem__detail" role="status">
        <p>{content.detail}</p>
        {content.action === "reconnect" && (
          <button type="button" onClick={onReconnect}>
            Reconnect
          </button>
        )}
        {content.action === "retry" && (
          <button type="button" onClick={onRetry}>
            Retry connection
          </button>
        )}
      </div>
    </details>
  );
}

export function RoomControlSheet({
  dashboardSettings,
  homeId = "default",
  cleaningAreaId,
  resolved,
  roomStatus,
  status,
  canMutate,
  selectedDeviceId,
  onSelectDevice,
  onCallService,
  onHome,
  onWalk,
  onConnectDevices,
  onReconnect,
  onRetry,
  liveCameraDeviceIds = new Set(),
  onOpenLiveFeed,
  deviceOverlay = false,
  onEscape,
}: RoomControlSheetProps) {
  const dom = useCabaneDom();
  const host = useHomeAssistantHostSession();
  const runtime = useHomeAssistantRuntime();
  const nativeHaPanel = Boolean(
    host &&
    runtime.origin === host.origin &&
    typeof window !== "undefined" &&
    window.location.origin === host.origin,
  );
  const outsideRooms = roomStatus === undefined;
  const roomOverview = !deviceOverlay && !outsideRooms;
  const [cabaneControlsRoom, setCabaneControlsRoom] = useState<string | null>(null);
  const hasHaDashboard =
    nativeHaPanel && roomOverview && dashboardSettings?.controls === "home-assistant";
  const showHaDashboard =
    hasHaDashboard && !selectedDeviceId && cabaneControlsRoom !== resolved.room.id;
  const modules = useMemo(() => buildRoomModules(resolved), [resolved]);
  const overviewModules = useMemo(() => roomOverviewModules(modules), [modules]);
  const { ordered, move } = useRoomModuleOrder(homeId, resolved.room.id, overviewModules);
  const [reorderingRoom, setReorderingRoom] = useState<string | null>(null);
  const reordering = reorderingRoom === resolved.room.id && !selectedDeviceId && !deviceOverlay;
  const selectedModule = useMemo(
    () => focusedDeviceModule(modules, selectedDeviceId),
    [modules, selectedDeviceId],
  );
  const focused = selectedModule !== undefined;
  const sheetRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const roomScrollTop = useRef(0);
  const wasFocused = useRef(focused);
  const [loadedPictureUrl, setLoadedPictureUrl] = useState<string | null>(null);
  const [failedPictureUrl, setFailedPictureUrl] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (focused) onSelectDevice(null);
    else onHome();
  }, [focused, onHome, onSelectDevice]);
  const sheetDrag = useBottomSheetDrag(goBack);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    roomScrollTop.current = 0;
  }, [resolved.room.id]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (focused && !wasFocused.current) scroll.scrollTop = 0;
    if (!focused && wasFocused.current) scroll.scrollTop = roomScrollTop.current;
    wasFocused.current = focused;
  }, [focused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (sheetRef.current?.inert) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (reordering) {
          setReorderingRoom(null);
          return;
        }
        if (onEscape) onEscape();
        else goBack();
        return;
      }
      if (!deviceOverlay || event.key !== "Tab") return;
      const controls = [
        ...(sheetRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex='-1'])",
        ) ?? []),
      ].filter((control) => control.getClientRects().length > 0);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && dom.root.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && dom.root.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dom.events.addEventListener("keydown", onKeyDown);
    return () => dom.events.removeEventListener("keydown", onKeyDown);
  }, [deviceOverlay, goBack, onEscape, dom, reordering]);

  useEffect(() => {
    if (deviceOverlay) backButtonRef.current?.focus();
  }, [deviceOverlay]);

  const pictureUrl = resolved.pictureUrl;
  const photoLoaded = pictureUrl !== null && loadedPictureUrl === pictureUrl;
  const photoFailed = pictureUrl !== null && failedPictureUrl === pictureUrl;
  const showPhotoFallback = !pictureUrl || photoFailed;
  useRoomHeroParallax({
    scrollRef,
    heroRef,
    enabled: !outsideRooms,
    resetKey: `${resolved.room.id}:${resolved.pictureUrl ?? "fallback"}:${selectedModule?.id ?? "room"}`,
  });

  const returnsToRoom = focused && !deviceOverlay;
  const dismissLabel = returnsToRoom
    ? "Back to room"
    : deviceOverlay
      ? "Close device controls"
      : "Close room controls";
  const navigationButton = (
    <button
      ref={backButtonRef}
      type="button"
      className="room-control-sheet__back"
      aria-label={dismissLabel}
      title={dismissLabel}
      onClick={goBack}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={returnsToRoom ? "m12 5-7 7 7 7M5 12h14" : "m6 6 12 12M18 6 6 18"} />
      </svg>
    </button>
  );

  return (
    <>
      {deviceOverlay && (
        <button
          type="button"
          className="device-control-overlay__backdrop"
          aria-label="Close device controls"
          tabIndex={-1}
          onClick={goBack}
        />
      )}
      <aside
        ref={sheetRef}
        className="room-control-sheet"
        aria-label={`${resolved.displayName} controls`}
        aria-modal={deviceOverlay ? "true" : undefined}
        data-expanded={sheetDrag.expanded ? "true" : "false"}
        data-device-overlay={deviceOverlay ? "true" : "false"}
        data-outside-rooms={outsideRooms ? "true" : undefined}
        data-ha-dashboard={showHaDashboard ? "true" : undefined}
        role={deviceOverlay ? "dialog" : undefined}
        style={sheetDrag.style}
      >
        <button
          type="button"
          className="room-control-sheet__drag-handle"
          aria-label={sheetDrag.expanded ? "Collapse room controls" : "Expand room controls"}
          {...sheetDrag.handleProps}
        />
        <nav
          className="room-control-sheet__nav"
          aria-label={focused || outsideRooms ? "Device navigation" : "Room navigation"}
        >
          {returnsToRoom && navigationButton}
          {outsideRooms && (
            <h1 className="room-control-sheet__group-heading">
              {selectedModule?.label ?? resolved.displayName}
            </h1>
          )}
          <div className="room-control-sheet__actions">
            {roomOverview && !showHaDashboard && !focused && overviewModules.length > 1 && (
              <button
                type="button"
                className="room-control-sheet__walk"
                aria-label={reordering ? "Done reordering devices" : "Reorder devices"}
                title={reordering ? "Done reordering devices" : "Reorder devices"}
                aria-pressed={reordering}
                onClick={() => setReorderingRoom(reordering ? null : resolved.room.id)}
              >
                {reordering ? "Done" : <ReorderIcon />}
              </button>
            )}
            {roomOverview && !focused && cleaningAreaId && (
              <RoomCleanAction
                key={cleaningAreaId}
                areaId={cleaningAreaId}
                roomId={resolved.room.id}
              />
            )}
            {roomOverview && (
              <button
                type="button"
                className="room-control-sheet__walk room-control-sheet__walk-entry"
                aria-label="Walk inside"
                title="Walk inside"
                onClick={onWalk}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="14" cy="4" r="2" />
                  <path d="m7 21 3-6-2-3 3-5 4 4 4 1M11 7l-5 3-2 4m6 1 5 2 1 4m-3-11-1 5" />
                </svg>
              </button>
            )}
          </div>
          {!returnsToRoom && navigationButton}
        </nav>

        <div
          className="room-control-sheet__scroll"
          ref={scrollRef}
          onScroll={(event) => {
            if (!focused) roomScrollTop.current = event.currentTarget.scrollTop;
          }}
        >
          {roomStatus && (
            <header
              ref={heroRef}
              className={`room-control-sheet__hero ${photoLoaded ? "is-photo-loaded" : ""} ${showPhotoFallback ? "has-fallback" : ""}`}
            >
              <div className="room-control-sheet__hero-visual">
                <div className="room-control-sheet__placeholder">
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M9 29.5 32 10l23 19.5" />
                    <path d="M15 27v27h34V27M25 54V36h14v18" />
                  </svg>
                </div>
                {pictureUrl && !photoFailed && (
                  <img
                    src={pictureUrl}
                    alt=""
                    loading="eager"
                    decoding="async"
                    onLoad={() => {
                      setFailedPictureUrl(null);
                      setLoadedPictureUrl(pictureUrl);
                    }}
                    onError={() => {
                      setLoadedPictureUrl(null);
                      setFailedPictureUrl(pictureUrl);
                    }}
                  />
                )}
                <div className="room-control-sheet__shade" />
              </div>
              <div className="room-control-sheet__foreground">
                <div className="room-control-sheet__title">
                  {focused && <p>{resolved.displayName}</p>}
                  <h1>{selectedModule?.label ?? resolved.displayName}</h1>
                </div>
                <RoomStatusBadges
                  summary={roomStatus}
                  variant="detailed"
                  className="room-control-sheet__status"
                  includeConnection
                />
              </div>
            </header>
          )}

          <div className="room-control-sheet__content">
            <ConnectionProblem status={status} onReconnect={onReconnect} onRetry={onRetry} />

            {showHaDashboard && dashboardSettings ? (
              <HaRoomDashboard
                key={resolved.room.id}
                settings={dashboardSettings}
                areaId={cleaningAreaId}
                roomName={resolved.displayName}
                onCabaneControls={() => setCabaneControlsRoom(resolved.room.id)}
              />
            ) : (
              <>
                {hasHaDashboard && !focused && (
                  <button
                    type="button"
                    className="room-dashboard-return"
                    onClick={() => {
                      setReorderingRoom(null);
                      setCabaneControlsRoom(null);
                    }}
                  >
                    Show Home Assistant dashboard
                  </button>
                )}
                {reordering ? (
                  <RoomModuleReorder modules={ordered} onMove={move} />
                ) : selectedModule ? (
                  <div className="room-control-sheet__grid is-focused">
                    <RoomModule
                      module={selectedModule}
                      canMutate={canMutate}
                      focused
                      onCallService={onCallService}
                      onOpenLiveFeed={
                        selectedModule.deviceSlotId &&
                        liveCameraDeviceIds.has(selectedModule.deviceSlotId)
                          ? () => onOpenLiveFeed?.(selectedModule.deviceSlotId!)
                          : undefined
                      }
                    />
                  </div>
                ) : overviewModules.length > 0 ? (
                  <div className="room-control-sheet__grid">
                    {ordered.map((module) => (
                      <RoomModule
                        key={module.id}
                        module={module}
                        canMutate={canMutate}
                        focused={false}
                        onCallService={onCallService}
                        onOpenLiveFeed={
                          module.deviceSlotId && liveCameraDeviceIds.has(module.deviceSlotId)
                            ? () => onOpenLiveFeed?.(module.deviceSlotId!)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <section className="room-control-sheet__empty">
                    <h2>No controls connected</h2>
                    <p>
                      {outsideRooms
                        ? "Connect devices placed outside rooms on this floor to use their controls."
                        : "This room can stay empty, or you can choose controls for it."}
                    </p>
                    {onConnectDevices && (
                      <button type="button" onClick={onConnectDevices}>
                        Connect devices
                      </button>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
