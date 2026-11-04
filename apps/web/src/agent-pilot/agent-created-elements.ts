import type { HomeProject } from "@cabane/engine";

function elementIds(project: HomeProject) {
  const floors = project.floors;
  const rooms = floors.flatMap((floor) => floor.rooms);
  const ids = (elements: readonly { id: string }[]) => elements.map((element) => element.id);
  return {
    floors: ids(floors),
    walls: ids(floors.flatMap((floor) => floor.walls)),
    rooms: ids(rooms),
    openings: ids(floors.flatMap((floor) => floor.openings)),
    ceilings: ids(floors.flatMap((floor) => floor.ceilings ?? [])),
    hedges: ids(floors.flatMap((floor) => floor.hedges ?? [])),
    pools: ids(floors.flatMap((floor) => floor.pools ?? [])),
    outdoorPlatforms: ids(floors.flatMap((floor) => floor.outdoorPlatforms ?? [])),
    floorZones: ids(rooms.flatMap((room) => room.floorZones ?? [])),
    groundZones: ids(floors.flatMap((floor) => floor.groundZones ?? [])),
    stairs: ids(project.stairs),
    items: ids(project.sceneItems),
    groups: [...new Set(project.sceneItems.flatMap((item) => (item.group ? [item.group.id] : [])))],
  };
}

/** Report actual saved identities, including copies and newly derived rooms. */
export function createdAgentElements(before: HomeProject, after: HomeProject) {
  const previous = elementIds(before);
  return Object.fromEntries(
    Object.entries(elementIds(after)).flatMap(([kind, ids]) => {
      const existing = new Set(previous[kind as keyof typeof previous]);
      const created = ids.filter((id) => !existing.has(id));
      return created.length ? [[kind, created]] : [];
    }),
  ) as Partial<Record<keyof ReturnType<typeof elementIds>, string[]>>;
}
