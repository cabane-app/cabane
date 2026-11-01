import { useCallback, useRef, useState, type Dispatch } from "react";
import type { FloorEditorDraft, PlanPoint } from "@cabane/engine";
import type {
  ConstructEditorAction,
  ConstructEditorController,
} from "./construct-controller-contract";
import { closesWallLoop } from "./wall-loop-closure";

/** One drawing chain for physical walls, invisible boundaries and hedges. */
export function useWallDrawing({
  tool,
  walls,
  hedgeSettings,
  exteriorWallColor,
  dispatch,
}: {
  tool: FloorEditorDraft["tool"];
  walls: FloorEditorDraft["walls"];
  hedgeSettings: ConstructEditorController["hedgeSettings"];
  exteriorWallColor: string;
  dispatch: Dispatch<ConstructEditorAction>;
}) {
  const [drawStart, setDrawStart] = useState<PlanPoint | null>(null);
  const [drawPreview, setDrawPreview] = useState<PlanPoint | null>(null);
  const [drawAngleReferenceRadians, setDrawAngleReferenceRadians] = useState<number | null>(null);
  const drawStartRef = useRef<PlanPoint | null>(null);
  const beginWall = useCallback((from: PlanPoint) => {
    drawStartRef.current = from;
    setDrawStart(from);
    setDrawPreview(from);
    setDrawAngleReferenceRadians(null);
  }, []);
  const addWall = useCallback(
    (to: PlanPoint) => {
      const from = drawStartRef.current;
      if (!from) return;
      if (tool === "hedge") {
        dispatch({ type: "add-hedge", hedge: { from, to, ...hedgeSettings } });
        drawStartRef.current = to;
        setDrawStart(to);
        setDrawPreview(to);
        setDrawAngleReferenceRadians(Math.atan2(to[1] - from[1], to[0] - from[0]));
        return;
      }
      const closesLoop = closesWallLoop(walls, from, to);
      dispatch({
        type: "add-wall",
        from,
        to,
        exteriorColor: exteriorWallColor,
        virtual: tool === "virtual-wall",
      });
      if (closesLoop) {
        dispatch({ type: "set-tool", tool: "select" });
        drawStartRef.current = null;
        setDrawStart(null);
        setDrawPreview(null);
        setDrawAngleReferenceRadians(null);
        return;
      }
      drawStartRef.current = to;
      setDrawStart(to);
      setDrawPreview(to);
      setDrawAngleReferenceRadians(Math.atan2(to[1] - from[1], to[0] - from[0]));
    },
    [exteriorWallColor, walls, tool, hedgeSettings, dispatch],
  );
  const cancelWall = useCallback(() => {
    drawStartRef.current = null;
    setDrawStart(null);
    setDrawPreview(null);
    setDrawAngleReferenceRadians(null);
  }, []);
  return {
    drawStart,
    drawPreview,
    drawAngleReferenceRadians,
    beginWall,
    previewWall: setDrawPreview,
    addWall,
    cancelWall,
  };
}
