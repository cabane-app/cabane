import { outdoorPlatformRoomId } from "../outdoor-platforms/platform-rooms";
import type { HomeProject } from "./types";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

interface RegisteredId {
  path: string;
  kind: "architecture" | "slot" | "shortcut" | "item" | "group";
}

const visitProjectIds = (
  project: HomeProject,
  register: (id: string, path: string, kind: RegisteredId["kind"]) => void,
) => {
  project.floors.forEach((floor, floorIndex) => {
    register(floor.id, `floors[${floorIndex}].id`, "architecture");
    floor.hedges?.forEach((hedge, index) =>
      register(hedge.id, `floors[${floorIndex}].hedges[${index}].id`, "architecture"),
    );
    floor.outdoorPlatforms?.forEach((platform, index) => {
      register(platform.id, `floors[${floorIndex}].outdoorPlatforms[${index}].id`, "architecture");
      if (platform.useAsRoom)
        register(
          outdoorPlatformRoomId(platform.id),
          `floors[${floorIndex}].outdoorPlatforms[${index}].useAsRoom`,
          "architecture",
        );
      platform.edges.forEach((edge, i) =>
        register(
          edge.id,
          `floors[${floorIndex}].outdoorPlatforms[${index}].edges[${i}].id`,
          "architecture",
        ),
      );
    });
    floor.pools?.forEach((pool, index) =>
      register(pool.id, `floors[${floorIndex}].pools[${index}].id`, "architecture"),
    );
    floor.groundZones?.forEach((zone, index) =>
      register(zone.id, `floors[${floorIndex}].groundZones[${index}].id`, "architecture"),
    );
    floor.rooms.forEach((room, index) =>
      register(room.id, `floors[${floorIndex}].rooms[${index}].id`, "architecture"),
    );
    floor.walls.forEach((wall, index) => {
      register(wall.id, `floors[${floorIndex}].walls[${index}].id`, "architecture");
      wall.niches?.forEach((niche, nicheIndex) =>
        register(
          niche.id,
          `floors[${floorIndex}].walls[${index}].niches[${nicheIndex}].id`,
          "architecture",
        ),
      );
    });
    floor.wallJunctions.forEach((junction, index) =>
      register(junction.id, `floors[${floorIndex}].wallJunctions[${index}].id`, "architecture"),
    );
    floor.openings.forEach((opening, index) =>
      register(opening.id, `floors[${floorIndex}].openings[${index}].id`, "architecture"),
    );
    floor.ceilings?.forEach((ceiling, index) =>
      register(ceiling.id, `floors[${floorIndex}].ceilings[${index}].id`, "architecture"),
    );
  });
  project.stairs.forEach((stair, index) =>
    register(stair.id, `stairs[${index}].id`, "architecture"),
  );

  for (const [roomId, profile] of Object.entries(project.roomProfiles)) {
    profile.dashboardSlots.forEach((slot, index) =>
      register(slot.id, `roomProfiles.${roomId}.dashboardSlots[${index}].id`, "slot"),
    );
  }
  project.sceneItems.forEach((item, itemIndex) => {
    if (item.lightSlotId) {
      register(item.lightSlotId, `sceneItems[${itemIndex}].lightSlotId`, "slot");
      register(`${item.lightSlotId}-entity`, `sceneItems[${itemIndex}].lightSlotId.entity`, "slot");
    }
    (item.entitySlots ?? []).forEach((slot, slotIndex) =>
      register(slot.id, `sceneItems[${itemIndex}].entitySlots[${slotIndex}].id`, "slot"),
    );
  });
  for (const [openingId, profile] of Object.entries(project.openingProfiles)) {
    if (profile.coverSlot)
      register(profile.coverSlot.id, `openingProfiles.${openingId}.coverSlot.id`, "slot");
    if (profile.contactSlot)
      register(profile.contactSlot.id, `openingProfiles.${openingId}.contactSlot.id`, "slot");
  }
  project.floors.forEach((floor, floorIndex) =>
    floor.openings.forEach((opening, index) => {
      if (
        opening.kind === "door" &&
        opening.operation === "roll-up" &&
        !project.openingProfiles[opening.id]?.coverSlot
      )
        register(
          `${opening.id}-cover`,
          `floors[${floorIndex}].openings[${index}].coverSlot`,
          "slot",
        );
      if (opening.kind !== "passage" && !project.openingProfiles[opening.id]?.contactSlot) {
        register(
          `${opening.id}-contact`,
          `floors[${floorIndex}].openings[${index}].contactSlot`,
          "slot",
        );
      }
    }),
  );
  project.shortcuts.forEach((shortcut, index) =>
    register(shortcut.id, `shortcuts[${index}].id`, "shortcut"),
  );

  const groups = new Set<string>();
  project.sceneItems.forEach((item, index) => {
    register(item.id, `sceneItems[${index}].id`, "item");
    if (item.group && !groups.has(item.group.id)) {
      register(item.group.id, `sceneItems[${index}].group.id`, "group");
      groups.add(item.group.id);
    }
  });
};

/** The same identity namespace used by validation, including implicit opening slots. */
export const collectProjectIds = (project: HomeProject): string[] => {
  const ids: string[] = [];
  visitProjectIds(project, (id) => ids.push(id));
  return ids;
};

const identityLabel = (project: HomeProject, path: string): string => {
  const room = /^floors\[(\d+)\]\.rooms\[(\d+)\]\.id$/.exec(path);
  if (room) {
    const floor = project.floors[Number(room[1])];
    return `Room “${floor.rooms[Number(room[2])].name}” on “${floor.name}”`;
  }
  const item = /^sceneItems\[(\d+)\]/.exec(path);
  if (item) {
    const value = project.sceneItems[Number(item[1])];
    const floor = project.floors.find((floor) => floor.id === value.floorId);
    return `${path.includes("entitySlots") ? "Device slot for" : "Scene item"} “${value.modelId}” on “${floor?.name ?? value.floorId}”`;
  }
  return path;
};

export const validateGlobalProjectIds = (project: HomeProject, issues: HomeProjectIssue[]) => {
  const ids = new Map<string, RegisteredId>();
  visitProjectIds(project, (id, path, kind) => {
    const prior = ids.get(id);
    if (!prior) {
      ids.set(id, { path, kind });
      return;
    }
    const roomConflict = /\.rooms\[\d+\]\.id$/.test(path);
    addProjectIssue(
      issues,
      kind === "item" ? "project.item-id-duplicate" : "project.id-duplicate",
      path,
      `${identityLabel(project, path)} has internal ID “${id}”, already used by ${identityLabel(project, prior.path)} (${prior.path}). ` +
        (roomConflict
          ? "Room names may repeat; give these rooms distinct IDs in the project JSON. Renaming a room does not change its ID."
          : kind === "item" || path.includes("entitySlots")
            ? "Catalog models may repeat; delete and re-add the conflicting item in Arrange, or assign distinct item and slot IDs in the project JSON."
            : "Assign distinct IDs to these entries in the project JSON."),
    );
  });
};
