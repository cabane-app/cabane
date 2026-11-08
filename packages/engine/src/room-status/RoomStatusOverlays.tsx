import { useSceneOverlay } from "./SceneOverlayLayout";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { RoomDisconnectedIcon } from "../RoomDisconnectedIcon";
import { useHoveredRoom, useRoomHoverTarget } from "./RoomHover";
import { Html } from "@react-three/drei";
import { planPointToWorld, polygonCentroid } from "../geometry";
import type { FloorSpec, RoomSpec } from "../types";
import { RoomStatusBadges, roomStatusAccessibleText } from "./RoomStatusBadges";
import type { RoomStatusMap, RoomStatusSummary } from "./model";

const ROOM_TAP_TOLERANCE_PX = 10;

export const roomStatusOverlayPriority = (summary: RoomStatusSummary) => {
  if (summary.doorOpen || summary.heating || summary.cooling) return 3;
  if (summary.lighting === "on" || summary.presence === "present") return 2;
  if (
    summary.temperature ||
    summary.humidity ||
    summary.aqi ||
    summary.co2 ||
    summary.noise ||
    summary.lighting ||
    summary.presence
  )
    return 1;
  return 0;
};

const roomStatusOverlayLabelWidth = (roomName: string, summary: RoomStatusSummary) => {
  const iconCount =
    Number(summary.heating) +
    Number(summary.cooling) +
    Number(Boolean(summary.lighting)) +
    Number(Boolean(summary.presence)) +
    Number(summary.doorOpen);
  const statusWidth =
    12 +
    (summary.temperature ? 58 : 0) +
    (summary.humidity ? 58 : 0) +
    (summary.aqi ? 58 : 0) +
    (summary.co2 ? 58 : 0) +
    (summary.noise ? 58 : 0) +
    iconCount * 21;
  const nameWidth = 58 + roomName.length * 5.4;
  return Math.min(246, Math.max(88, statusWidth, nameWidth));
};

export const roomStatusOverlayPosition = (
  room: RoomSpec,
  floor: FloorSpec,
): readonly [number, number, number] => {
  const [x, z] = planPointToWorld(polygonCentroid(room.polygon), floor.coordinates);
  return [x, floor.defaultCeilingHeightMeters + 0.35, z];
};

export const shouldShowRoomStatusOverlays = (mode: "overview" | "room" | "walk") =>
  mode === "overview";

export function RoomStatusOverlayButton({
  labelRef,
  hovered = false,
  onHover,
  roomName,
  summary,
  onSelect,
  visible = true,
}: {
  labelRef?: import("react").Ref<HTMLButtonElement>;
  hovered?: boolean;
  onHover?: (hovered: boolean) => void;
  roomName: string;
  summary: RoomStatusSummary;
  onSelect: () => void;
  visible?: boolean;
}) {
  const statusText = roomStatusAccessibleText(summary);
  const press = useRef<AbortController | null>(null);
  const pointerTap = useRef(false);
  useEffect(() => () => press.current?.abort(), [visible]);
  const beginPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    press.current?.abort();
    pointerTap.current = false;
    if (event.button !== 0 || !event.isPrimary) return;
    const owner = event.currentTarget.ownerDocument;
    const { pointerId, clientX, clientY } = event;
    const controller = new AbortController();
    press.current = controller;
    const options = { capture: true, signal: controller.signal };
    const cancel = () => controller.abort();
    const withinTapDistance = (pointer: PointerEvent) =>
      Math.hypot(pointer.clientX - clientX, pointer.clientY - clientY) <= ROOM_TAP_TOLERANCE_PX;
    owner.addEventListener("pointerdown", cancel, options);
    owner.addEventListener("pointercancel", cancel, options);
    owner.addEventListener(
      "pointermove",
      (pointer) => {
        if (pointer.pointerId === pointerId && !withinTapDistance(pointer)) cancel();
      },
      options,
    );
    owner.addEventListener(
      "pointerup",
      (pointer) => {
        if (pointer.pointerId !== pointerId) return;
        pointerTap.current = withinTapDistance(pointer);
        cancel();
      },
      options,
    );
  };
  return (
    <button
      ref={labelRef}
      type="button"
      className="room-status-overlay"
      data-visible={visible}
      data-hovered={hovered}
      onPointerEnter={visible ? () => onHover?.(true) : undefined}
      onPointerLeave={() => onHover?.(false)}
      aria-hidden={!visible || undefined}
      aria-label={`Open ${roomName}${summary.connected === false ? ". Room not connected to Home Assistant" : ""}${statusText ? `. ${statusText}` : ""}`}
      tabIndex={visible ? undefined : -1}
      onPointerDown={visible ? beginPress : undefined}
      onClick={(event) => {
        event.stopPropagation();
        const activate = visible && (event.detail === 0 || pointerTap.current);
        pointerTap.current = false;
        if (activate) onSelect();
      }}
    >
      <span className="room-status-overlay__name">
        {roomName}
        {summary.connected === false && <RoomDisconnectedIcon />}
      </span>
      <RoomStatusBadges summary={summary} variant="compact" />
      <span className="room-status-overlay__stem" aria-hidden="true" />
    </button>
  );
}

export function RoomStatusOverlays({
  floor,
  summaries,
  roomNames,
  onSelectRoom,
}: {
  floor: FloorSpec;
  summaries: RoomStatusMap;
  roomNames: Readonly<Record<string, string>>;
  onSelectRoom: (roomId: string) => void;
}) {
  const hoveredRoom = useHoveredRoom();
  const setRoomHover = useRoomHoverTarget();

  return floor.rooms.map((room) => (
    <RoomStatusOverlay
      key={room.id}
      room={room}
      floor={floor}
      roomName={roomNames[room.id] ?? room.name}
      summary={summaries[room.id]}
      hovered={hoveredRoom === room.id}
      onHover={(hovered) => setRoomHover(hovered ? room.id : null)}
      onSelect={() => onSelectRoom(room.id)}
    />
  ));
}

function RoomStatusOverlay({
  room,
  floor,
  roomName,
  summary,
  hovered,
  onHover,
  onSelect,
}: {
  room: RoomSpec;
  floor: FloorSpec;
  roomName: string;
  summary: RoomStatusSummary;
  hovered: boolean;
  onHover: (hovered: boolean) => void;
  onSelect: () => void;
}) {
  const { anchorRef, labelRef, visible } = useSceneOverlay<HTMLButtonElement>({
    id: `room:${room.id}`,
    labelWidth: roomStatusOverlayLabelWidth(roomName, summary),
    labelHeight: 48,
    priority: roomStatusOverlayPriority(summary),
  });
  return (
    <group ref={anchorRef} position={roomStatusOverlayPosition(room, floor)}>
      <Html
        center
        zIndexRange={[8, 0]}
        pointerEvents="auto"
        wrapperClass="room-status-overlay-anchor"
      >
        <RoomStatusOverlayButton
          labelRef={labelRef}
          hovered={hovered}
          onHover={onHover}
          roomName={roomName}
          summary={summary}
          visible={visible}
          onSelect={onSelect}
        />
      </Html>
    </group>
  );
}
