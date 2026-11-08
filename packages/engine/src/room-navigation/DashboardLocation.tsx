import { useCallback, useRef } from "react";
import { homePresenceLabel } from "../home-presence/HomePresenceStatus";
import { SceneRoomContext } from "../SceneRoomContext";
import { connectionLabel } from "../dashboard-contract";
import type { useDashboardController } from "../useDashboardController";
import { RoomNavigation } from "./RoomNavigation";

/** The floor summary and room navigation share one place in the scene header. */
export function DashboardLocation({
  dashboard,
}: {
  dashboard: ReturnType<typeof useDashboardController>;
}) {
  const {
    walkthrough,
    walkMode,
    setupOpen,
    mappingOpen,
    deviceOverlay,
    outsideRoom,
    openDevicePanel,
    floorNavigation,
    floor,
    manifest,
    mode,
    selectedRoomId,
    roomDisplayNames,
    reducedMotion,
    selectRoom,
    goHome,
    walkRoomDisplayName,
    selectedRoomDisplayName,
    walkRoomId,
    roomStatuses,
    homePresence,
    runtime,
    bindingManager,
    sessionPresentation,
    demoSession,
  } = dashboard;
  const restoreOutsideFocus = useRef(false);
  const restoreOutsideButtonFocus = useCallback((button: HTMLButtonElement | null) => {
    if (!button || !restoreOutsideFocus.current) return;
    restoreOutsideFocus.current = false;
    button.focus();
  }, []);
  if (walkthrough) return null;
  const navigation =
    !walkMode && !setupOpen && !mappingOpen && !deviceOverlay && !floorNavigation.wholeBuilding;
  const description =
    sessionPresentation?.label ?? (demoSession ? "Offline demo" : connectionLabel[runtime.status]);
  const session = sessionPresentation
    ? [sessionPresentation.label, sessionPresentation.detail].filter(Boolean).join(" · ")
    : undefined;
  if (!navigation)
    return (
      <SceneRoomContext
        mode={mode}
        displayName={walkMode ? walkRoomDisplayName : selectedRoomDisplayName}
        roomStatus={roomStatuses[(walkMode ? walkRoomId : selectedRoomId) ?? ""]}
        homePresence={homePresence}
        connectionStatus={runtime.status}
        connectionDescription={description}
        sessionStatus={session}
      />
    );
  const detail =
    [session, homePresence && homePresenceLabel(homePresence)].filter(Boolean).join(" · ") ||
    description;
  const summary = (
    <>
      <i
        className={`connection-dot status-${runtime.status}`}
        role="img"
        aria-label={description}
      />
      <span className="room-navigation__floor-copy">
        <strong>{floor.name}</strong>
        <small title={detail}>{detail}</small>
      </span>
    </>
  );
  // HA's area registry list already follows its user-configured order.
  const areaOrder = new Map(runtime.areas.map((area, index) => [area.area_id, index]));
  const roomOrder = (roomId: string) => {
    const areaId = bindingManager.profile.roomAreaIds[roomId];
    return (areaId ? areaOrder.get(areaId) : undefined) ?? runtime.areas.length;
  };
  const rooms = [...floor.rooms].sort((a, b) => roomOrder(a.id) - roomOrder(b.id));
  return (
    <RoomNavigation
      floor={floor}
      floors={manifest.floors}
      summary={summary}
      rooms={rooms}
      outsideControls={
        outsideRoom
          ? {
              label: outsideRoom.name,
              restoreFocus: restoreOutsideButtonFocus,
              onOpen: () => {
                restoreOutsideFocus.current = true;
                openDevicePanel(outsideRoom.id, null);
              },
            }
          : undefined
      }
      names={roomDisplayNames}
      selectedId={mode === "room" ? selectedRoomId : null}
      onSelect={selectRoom}
      onOverview={goHome}
      onSelectFloor={(id) => {
        floorNavigation.selectFloor(id, "picker");
        goHome();
      }}
      reducedMotion={reducedMotion}
    />
  );
}
