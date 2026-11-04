import { createEmptyHomeProject, type HomeProject } from "@cabane/engine";
import { stableFurnishingRegistry } from "@cabane/catalog/furnishing";

// Synthetic geometry only. This is deliberately unrelated to the reporter's plan.
export function createPerformanceApartment(): HomeProject {
  const project = createEmptyHomeProject("performance-apartment", "Performance apartment");
  const floorId = "ground-floor";
  const columns = 4,
    rows = 3,
    side = 3;
  const rooms: HomeProject["floors"][number]["rooms"] = Array.from(
    { length: columns * rows },
    (_, index) => {
      const x = (index % columns) * side,
        y = Math.floor(index / columns) * side;
      return {
        id: `apartment-room-${index}`,
        name: `Apartment room ${index + 1}`,
        polygon: [
          [x + 0.08, y + 0.08],
          [x + side - 0.08, y + 0.08],
          [x + side - 0.08, y + side - 0.08],
          [x + 0.08, y + side - 0.08],
        ],
        accent: index % 2 ? "#c7d9cf" : "#efc5a9",
        dashboardSlots: [],
        devices: [],
      };
    },
  );
  const walls: HomeProject["floors"][number]["walls"] = [
    ...Array.from({ length: columns + 1 }, (_, column) => ({
      id: `apartment-v-${column}`,
      from: [column * side, 0] as const,
      to: [column * side, rows * side] as const,
      classification:
        column === 0 || column === columns ? ("exterior" as const) : ("interior" as const),
      thicknessMeters: 0.12,
    })),
    ...Array.from({ length: rows + 1 }, (_, row) => ({
      id: `apartment-h-${row}`,
      from: [0, row * side] as const,
      to: [columns * side, row * side] as const,
      classification: row === 0 || row === rows ? ("exterior" as const) : ("interior" as const),
      thicknessMeters: 0.12,
    })),
  ];
  const furnishings = [
    ["round-coffee-table", 1.5, 1.5, 0],
    ["two-seat-loveseat", 1.5, 0.5, Math.PI],
    ["oak-dining-chair", 1.5, 2.3, 0],
    ["oak-nightstand", 0.45, 0.55, 0],
    ["potted-plant", 2.55, 0.5, 0],
    ["oak-bookshelf", 0.3, 1.6, Math.PI / 2],
    ["pedestal-side-table", 2.45, 2.4, 0],
    ["upholstered-ottoman", 0.55, 2.4, 0],
  ] as const;
  return {
    ...project,
    seedRevision: "performance-apartment-v1",
    floors: [
      {
        ...project.floors[0],
        footprint: [
          [0, 0],
          [columns * side, 0],
          [columns * side, rows * side],
          [0, rows * side],
        ],
        rooms,
        walls,
        wallJunctions: Array.from({ length: (columns + 1) * (rows + 1) }, (_, index) => {
          const column = index % (columns + 1),
            row = Math.floor(index / (columns + 1));
          return {
            id: `apartment-junction-${index}`,
            at: [column * side, row * side] as const,
            wallIds: [`apartment-v-${column}`, `apartment-h-${row}`],
          };
        }),
        openings: Array.from({ length: columns - 1 }, (_, index) =>
          Array.from({ length: rows }, (_, row) => ({
            id: `apartment-door-${index}-${row}`,
            wallId: `apartment-v-${index + 1}`,
            kind: "door" as const,
            offsetFromWallStartPlanUnits: row * side + 1.05,
            widthPlanUnits: 0.85,
            openingHeightMeters: 2.1,
            sillHeightMeters: 0,
            operation: "hinged" as const,
            variant: "panel",
            finish: "wood",
            leafCount: 1,
          })),
        ).flat(),
      },
    ],
    sceneItems: rooms.flatMap((room, index) =>
      furnishings.map(([modelId, localX, localY, rotation], itemIndex) => ({
        id: `${room.id}-item-${itemIndex}`,
        kind: "furnishing" as const,
        floorId,
        modelId,
        size: stableFurnishingRegistry[modelId].defaultSize,
        placement: {
          kind: "absolute" as const,
          at: [
            (index % columns) * side + localX,
            Math.floor(index / columns) * side + localY,
          ] as const,
          elevationMeters: 0.001,
          rotationYRadians: rotation,
        },
      })),
    ),
    roomProfiles: Object.fromEntries(rooms.map((room) => [room.id, { dashboardSlots: [] }])),
  };
}
