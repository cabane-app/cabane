import type { EditorWorkspaceSnapshot } from "../home-editor/workspace-history";
import { collectProjectIds } from "./cross-references";
import type { DraftLayoutFloorSpec } from "./types";

export interface FloorCopyOptions {
  sourceFloorId: string;
}

/** Copy only floor-owned portable data. Stairs, home settings and private bindings stay put. */
export const copyFloorContents = (
  snapshot: EditorWorkspaceSnapshot,
  destination: DraftLayoutFloorSpec,
  options: FloorCopyOptions,
): EditorWorkspaceSnapshot => {
  const project = snapshot.project;
  const source = project.floors.find((floor) => floor.id === options.sourceFloorId);
  if (!source) throw new Error("The source floor no longer exists.");
  const used = new Set(collectProjectIds(project));
  used.add(destination.id);
  const ids = new Map<string, string>([[source.id, destination.id]]);
  let serial = 0;
  const remapId = (old: string): string => {
    const existing = ids.get(old);
    if (existing) return existing;
    let id: string;
    do {
      id = `${destination.id}-copy-${++serial}`;
    } while ([id, `${id}-contact`, `${id}-cover`].some((value) => used.has(value)));
    // Reserve implicit opening slots as well as explicit identities.
    for (const value of [id, `${id}-contact`, `${id}-cover`]) used.add(value);
    ids.set(old, id);
    return id;
  };
  // These are the only identity/reference fields in floor architecture.
  // Finish presets and all other strings are values, never references to remap.
  const copy = <T>(value: T): T => {
    const visit = (entry: unknown): unknown => {
      if (Array.isArray(entry)) return entry.map(visit);
      if (entry === null || typeof entry !== "object") return entry;
      return Object.fromEntries(
        Object.entries(entry).map(([key, child]) => [
          key,
          ["id", "wallId", "roomId", "floorId"].includes(key) && typeof child === "string"
            ? remapId(child)
            : ["wallIds", "roomIds"].includes(key) && Array.isArray(child)
              ? child.map((id: string) => remapId(id))
              : visit(child),
        ]),
      );
    };
    return visit(value) as T;
  };
  const { belowGround: _belowGround, ...architecture } = copy(source);
  const floor: DraftLayoutFloorSpec = {
    ...architecture,
    id: destination.id,
    name: destination.name,
    ...(destination.belowGround ? { belowGround: true } : {}),
  };
  return {
    ...snapshot,
    project: {
      ...project,
      floors: project.floors.map((value) => (value.id === destination.id ? floor : value)),
    },
  };
};
