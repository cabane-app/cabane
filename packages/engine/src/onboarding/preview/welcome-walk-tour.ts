import type { PlanPoint, RenderableFloorSpec } from "../../types";

interface WelcomeWalkTour {
  roomId: string;
  stops: readonly { at: PlanPoint; yaw: number }[];
}

// Eye-level loops stay within one room and look towards the furnishings.
const tours: readonly WelcomeWalkTour[] = [
  {
    roomId: "ground-floor:room-1",
    stops: [
      { at: [4.4, 3], yaw: -85 },
      { at: [5.5, 1.8], yaw: -105 },
      { at: [6, 3.8], yaw: -60 },
      { at: [6, 6.2], yaw: -135 },
      { at: [4.4, 7.1], yaw: 75 },
      { at: [3.8, 5.2], yaw: 145 },
    ],
  },
  {
    roomId: "open-plan-living",
    stops: [
      { at: [5.9, 12.05], yaw: -142 },
      { at: [9.1, 11.85], yaw: -154 },
      { at: [12.4, 11.95], yaw: 179 },
      { at: [13.1, 14.6], yaw: 108 },
      { at: [12.3, 16.85], yaw: 76 },
      { at: [8.55, 16.7], yaw: 68 },
      { at: [6.65, 15.95], yaw: 42 },
      { at: [6.05, 13.4], yaw: -65 },
    ],
  },
];

export function welcomeWalkTour(floor: RenderableFloorSpec) {
  return tours.find((tour) => floor.rooms.some((room) => room.id === tour.roomId && !room.isSolid));
}
