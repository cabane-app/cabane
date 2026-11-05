import { createContext, useContext, useMemo } from "react";
import type { FloorSpec } from "../types";
import type { TerrainSettings } from "./terrain-settings";
import { createTerrainSurface, type TerrainSurface } from "./terrain-surface";

export const TerrainSurfaceContext = createContext<TerrainSurface>(null);
export const useTerrainSurface = () => useContext(TerrainSurfaceContext);

/** Editor composition replaces FloorSpecs for item edits and floor selection.
 * Keep the prepared ground buffers until their actual grade, extent or cuts change. */
export function usePreparedTerrainSurface(
  settings: TerrainSettings | undefined,
  floors: readonly FloorSpec[],
) {
  const surface = createTerrainSurface(settings, floors);
  // The surface's serializable data owns bounds/cutouts; settings own offsetAt.
  // This also detects in-place architecture or grade edits without tying costly
  // geometry to room/device profile objects or the selected editor floor.
  const key = JSON.stringify([settings, surface]);
  // The content key deliberately replaces the freshly composed object identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => surface, [key]);
}
