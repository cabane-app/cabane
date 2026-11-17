import { DataTexture, LinearFilter, RedFormat } from "three";
import { elevationAreas, transitionTriangles, triangleHeight } from "../elevation/surfaces";
import { floorZonePointWithinRoom } from "../floor-finishes/finish-geometry";
import { openingCutTop, pointInsidePolygon, worldPointToPlan } from "../geometry";
import type { FloorSpec, WallSpec } from "../types";
import { wallFrame } from "./wall-coordinate-frame";
import { wallGablesForFloor } from "./wall-gable-geometry";

const reach = 0.38;
const falloff = (distance: number) => Math.max(0, 1 - Math.max(0, distance) / reach) ** 2;

/** Bake only structural contacts in metres. Each directed face has its own tile. */
export function bakeWallContacts(floor: FloorSpec, singleWall?: WallSpec) {
  const rooms = floor.rooms.filter((room) => !room.isSolid);
  if (!rooms.length) return null;
  const source = singleWall
    ? [...floor.walls.filter((wall) => wall.id !== singleWall.id), singleWall]
    : floor.walls;
  const frames = new Map(source.map((wall) => [wall.id, wallFrame(wall, floor)]));
  const walls = source.filter((wall) => !wall.virtual && frames.get(wall.id)!.length > 1e-6);
  const targets = singleWall ? walls.filter((wall) => wall.id === singleWall.id) : walls;
  if (!targets.length) return null;
  const openings = new Map(
    walls.map((wall) => [wall.id, floor.openings.filter((opening) => opening.wallId === wall.id)]),
  );
  const zones = elevationAreas(floor).filter((zone) => zone.roomId);
  const slopes = zones.flatMap((zone) =>
    transitionTriangles(zone, floor.coordinates.metersPerPlanUnit, () => 0),
  );
  const gables = wallGablesForFloor(
    source.some((wall) => wall.gable && frames.get(wall.id)!.length <= 1e-6)
      ? { ...floor, walls }
      : floor,
  );
  const y0 = Math.min(0, ...zones.map((zone) => zone.elevation.offsetMeters)) - 0.05;
  const y1 =
    Math.max(
      ...walls.map((wall) => wall.heightMeters ?? floor.defaultWallHeightMeters),
      ...[...gables.values()].flatMap((shapes) =>
        shapes.profile.flatMap((run) => run.map(([, y]) => y)),
      ),
    ) + reach;
  const span = Math.max(0.1, ...targets.map((wall) => frames.get(wall.id)!.length));
  const tileCount = targets.length * 2;
  const columns = Math.min(
    tileCount,
    Math.max(1, Math.ceil(Math.sqrt((tileCount * (y1 - y0)) / span))),
  );
  const rows = Math.ceil(tileCount / columns);
  const tileWidth = Math.min(Math.ceil(span * 16) + 2, Math.floor(767 / columns));
  const tileHeight = Math.min(Math.ceil((y1 - y0) * 16) + 2, Math.floor(767 / rows));
  if (tileWidth < 3 || tileHeight < 3) return null;
  // The unoccupied first pixel is white for cut edges, lintels, sills and trim.
  const width = tileWidth * columns + 1,
    height = tileHeight * rows;
  const data = new Uint8Array(width * height).fill(255);
  const indices = new Map(targets.map((wall, i) => [wall.id, i * 2]));
  const scale = floor.coordinates.metersPerPlanUnit;
  let hasContact = false;
  targets.forEach((wall) => {
    const frame = frames.get(wall.id)!;
    const incident = new Set(
      floor.wallJunctions
        .filter((joint) => joint.wallIds.includes(wall.id))
        .flatMap((joint) => joint.wallIds),
    );
    const neighbors = walls.filter((other) => other.id !== wall.id && incident.has(other.id));
    for (const side of [0, 1]) {
      const tile = indices.get(wall.id)! + side;
      const ox = 1 + (tile % columns) * tileWidth,
        oy = Math.floor(tile / columns) * tileHeight;
      const nx = frame.normal[0] * (side ? -1 : 1),
        nz = frame.normal[1] * (side ? -1 : 1);
      // Exclude a collinear continuation and a T-junction projecting into the opposite room.
      const facing = neighbors.filter((other) => {
        const f = frames.get(other.id)!;
        if (Math.abs(nx * f.direction[0] + nz * f.direction[1]) < 0.01) return false;
        return [f.from, f.to].some(
          ([x, z]) =>
            (x - frame.from[0]) * nx + (z - frame.from[1]) * nz > wall.thicknessMeters / 2,
        );
      });
      for (let u = 0; u < tileWidth; u++) {
        const along = (frame.length * u) / (tileWidth - 1);
        const x =
          frame.from[0] + along * frame.direction[0] + nx * (wall.thicknessMeters / 2 + 0.006);
        const z =
          frame.from[1] + along * frame.direction[1] + nz * (wall.thicknessMeters / 2 + 0.006);
        const point = worldPointToPlan({ x, z }, floor.coordinates);
        // Older room outlines can stop a few centimetres short of the wall face.
        // Use the same 8 cm indoor probe as the structural wall renderer.
        const roomPoint = worldPointToPlan(
          { x: x + nx * 0.074, z: z + nz * 0.074 },
          floor.coordinates,
        );
        if (!rooms.some((room) => pointInsidePolygon(roomPoint, room.polygon))) continue;
        const level = zones.find((zone) => floorZonePointWithinRoom(point, zone.polygon));
        let floorY = level?.elevation.offsetMeters ?? 0;
        if (!level) {
          for (const slope of slopes) {
            const y = triangleHeight(point, slope.polygon, slope.heights);
            if (y !== null) {
              floorY = y;
              break;
            }
          }
        }
        const corners = facing.flatMap((other) => {
          const f = frames.get(other.id)!;
          const dx = x - f.from[0],
            dz = z - f.from[1];
          const station = dx * f.direction[0] + dz * f.direction[1];
          const offset = Math.abs(dx * f.normal[0] + dz * f.normal[1]) - other.thicknessMeters / 2;
          const distance = Math.hypot(
            Math.max(0, -station, station - f.length),
            Math.max(0, offset),
          );
          if (distance >= reach) return [];
          let top = other.heightMeters ?? floor.defaultWallHeightMeters;
          for (const run of gables.get(other.id)?.profile ?? []) {
            const index = run.findIndex(
              ([s], i) => i > 0 && station >= run[i - 1][0] && station <= s && s > run[i - 1][0],
            );
            if (index < 1) continue;
            const [s0, h0] = run[index - 1],
              [s1, h1] = run[index];
            const roofHeight = h0 + ((h1 - h0) * (station - s0)) / (s1 - s0);
            top = other.gable?.fill === "glass" ? Math.min(top, roofHeight) : roofHeight;
            break;
          }
          return [
            {
              strength: 0.25 * falloff(distance),
              top,
              holes: openings
                .get(other.id)!
                .filter(
                  (o) =>
                    station >= o.offsetFromWallStartPlanUnits * scale &&
                    station <= (o.offsetFromWallStartPlanUnits + o.widthPlanUnits) * scale,
                )
                .map((opening) => ({
                  bottom: opening.sillHeightMeters,
                  top: openingCutTop(opening, top),
                })),
            },
          ];
        });
        const top = Math.max(floorY + reach, ...corners.map((corner) => corner.top));
        const last = Math.min(
          tileHeight - 1,
          Math.ceil(((top - y0) / (y1 - y0)) * (tileHeight - 1)),
        );
        for (let v = 0; v <= last; v++) {
          const y = y0 + ((y1 - y0) * v) / (tileHeight - 1);
          let shade = 0.35 * falloff(y - floorY);
          for (const corner of corners) {
            if (y > corner.top || corner.holes.some((hole) => y >= hole.bottom && y <= hole.top))
              continue;
            shade = Math.max(shade, corner.strength * Math.min(1, (corner.top - y) / 0.12));
          }
          if (shade > 0) {
            hasContact = true;
            data[(oy + v) * width + ox + u] = Math.round(255 * (1 - shade));
          }
        }
      }
    }
  });
  if (!hasContact) return null;
  const map = new DataTexture(data, width, height, RedFormat);
  map.channel = 1;
  map.minFilter = map.magFilter = LinearFilter;
  map.generateMipmaps = false; // UVs end at texel centres; never filter across charts.
  map.needsUpdate = true;
  function uv(
    wallId: string | undefined,
    side: "left" | "right",
    x: number,
    y: number,
    z: number,
  ): readonly [number, number] {
    const base = wallId === undefined ? undefined : indices.get(wallId);
    if (base === undefined || wallId === undefined) return [0.5 / width, 0.5 / height];
    const tile = base + Number(side === "right"),
      frame = frames.get(wallId)!;
    const u = Math.min(
      1,
      Math.max(
        0,
        ((x - frame.from[0]) * frame.direction[0] + (z - frame.from[1]) * frame.direction[1]) /
          frame.length,
      ),
    );
    const v = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    return [
      (1.5 + (tile % columns) * tileWidth + u * (tileWidth - 1)) / width,
      (0.5 + Math.floor(tile / columns) * tileHeight + v * (tileHeight - 1)) / height,
    ];
  }
  return { map, uv };
}
export type WallContacts = NonNullable<ReturnType<typeof bakeWallContacts>>;
