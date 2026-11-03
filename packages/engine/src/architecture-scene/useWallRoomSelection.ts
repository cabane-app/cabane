import { useRoomHoverTarget } from "../room-status/RoomHover";
import { useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { pointInsidePolygon, worldPointToPlan } from "../geometry";
import type { FloorSpec } from "../types";

export function useWallRoomSelection(floor: FloorSpec, onSelectRoom?: (id: string) => void) {
  const setRoomHover = useRoomHoverTarget();
  const press = useRef<{ pointerId: number; x: number; y: number; roomId: string } | null>(null);
  const roomAtFace = (event: ThreeEvent<PointerEvent>) => {
    if (!event.face || Math.abs(event.face.normal.y) > 0.5) return undefined;
    // Wall geometry is floor-local; sample just outside the clicked face.
    const point = event.object
      .worldToLocal(event.point.clone())
      .addScaledVector(event.face.normal, 0.02);
    const planPoint = worldPointToPlan(point, floor.coordinates);
    return floor.rooms.find((room) => pointInsidePolygon(planPoint, room.polygon))?.id;
  };
  const clearPress = () => {
    press.current = null;
  };
  const hoverFace = (event: ThreeEvent<PointerEvent>) => {
    const roomId = roomAtFace(event);
    if (roomId) event.stopPropagation();
    setRoomHover(roomId ?? null);
  };
  const leave = () => {
    clearPress();
    setRoomHover(null);
  };
  if (!onSelectRoom) return {};
  return {
    onPointerOver: hoverFace,
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      clearPress();
      const roomId = roomAtFace(event);
      if (!roomId || event.button !== 0) return;
      event.stopPropagation();
      press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, roomId };
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      hoverFace(event);
      const candidate = press.current;
      if (candidate && Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 10)
        clearPress();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      const candidate = press.current;
      clearPress();
      if (!candidate || candidate.pointerId !== event.pointerId) return;
      event.stopPropagation();
      if (
        Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) <= 10 &&
        roomAtFace(event) === candidate.roomId
      )
        onSelectRoom(candidate.roomId);
    },
    onPointerOut: leave,
    onPointerCancel: leave,
  };
}
