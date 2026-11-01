import { closedOpeningCoverClearance } from "@cabane/catalog/architecture";
import { indoorRoomIdsOnWallFace, type FloorSpec, type ItemPlacement } from "@cabane/engine";

type WallPlacement = Extract<ItemPlacement, { kind: "wall" }>;

export function exteriorWindowPlacement(
  placement: WallPlacement,
  opening: FloorSpec["openings"][number],
  floor: FloorSpec,
  clearanceMeters: number,
): { placement: WallPlacement; roomName: string } | null {
  const opposite = {
    ...placement,
    face: placement.face === "left" ? ("right" as const) : ("left" as const),
  };
  const indoor = indoorRoomIdsOnWallFace(opposite, floor);
  if (indoor.length !== 1 || indoorRoomIdsOnWallFace(placement, floor).length !== 0) return null;
  const wall = floor.walls.find((wall) => wall.id === placement.wallId);
  if (!wall) return null;
  const clearance = closedOpeningCoverClearance(opening, placement.face);
  if (!clearance) return null;
  return {
    placement: {
      ...placement,
      // Follow the window frame, clearing closed handles and outlines even in thick walls.
      depthOffsetMeters:
        clearance.depthMeters + 0.004 + Math.max(0.003, clearanceMeters) - wall.thicknessMeters / 2,
    },
    roomName: floor.rooms.find((room) => room.id === indoor[0])?.name ?? "Window",
  };
}
