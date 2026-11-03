import { createContext, useContext } from "react";
import type { TerrainSurface } from "./terrain-surface";

export const TerrainSurfaceContext = createContext<TerrainSurface>(null);
export const useTerrainSurface = () => useContext(TerrainSurfaceContext);
