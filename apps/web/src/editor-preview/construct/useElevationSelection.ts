import { useState } from "react";
import type { FloorEditorDraft, FloorEditorSelection } from "@cabane/engine";

export function useElevationSelection(
  draft: FloorEditorDraft,
  select: (selection: FloorEditorSelection) => void,
) {
  const [selectedElevationEdge, setSelectedElevationEdge] = useState<{
    areaId: string;
    index: number;
  } | null>(null);
  const [selectedPlatformEdgeId, setSelectedPlatformEdgeId] = useState<string | null>(null);
  return {
    selectedElevationEdge,
    selectedPlatformEdgeId,
    selectElevationEdge: (areaId: string, index: number | null) => {
      setSelectedElevationEdge(index === null ? null : { areaId, index });
      const platform = draft.outdoorPlatforms?.find((p) => p.id === areaId);
      select({ kind: platform ? "outdoor-platform" : "floor-zone", id: areaId });
      if (platform)
        setSelectedPlatformEdgeId(index === null ? null : (platform.edges[index]?.id ?? null));
    },
    selectPlatform: (id: string) => {
      setSelectedElevationEdge(null);
      setSelectedPlatformEdgeId(null);
      select({ kind: "outdoor-platform", id });
    },
    selectPlatformEdge: (id: string, edgeId: string) => {
      const index =
        draft.outdoorPlatforms?.find((p) => p.id === id)?.edges.findIndex((e) => e.id === edgeId) ??
        -1;
      setSelectedElevationEdge(index < 0 ? null : { areaId: id, index });
      setSelectedPlatformEdgeId(edgeId);
      select({ kind: "outdoor-platform", id });
    },
  };
}
