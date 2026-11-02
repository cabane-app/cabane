import { DEFAULT_WALL_COLORS } from "@cabane/engine";
import { previewWallAttachments } from "./wall-attachment-preview";
import { openingPlacementPreview, openingToolDimensions } from "./opening-placement-preview";
import { omitUndefinedProperties } from "@cabane/engine";
import { useCabaneDom } from "@cabane/engine";
import { useThree } from "@react-three/fiber";

import {
  editorWallAttachments,
  DEFAULT_DOOR_CONFIGURATION,
  createFloorEditorSelection,
  floorEditorSelectionTargets,
  ToonMaterial as LitMaterial,
  PlanPoint,
  type SnapTarget,
  worldPointToPlan,
} from "@cabane/engine";

import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from "three";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  constructPlanToWorld,
  openingPlacementForPlanPoint,
  resizeWallAttachmentAtPoint,
  wallOverlayTransform,
  worldDragToConstructPlan,
  worldDragToSnappedConstructPlan,
} from "./drag-geometry";

import { PlanOverlayMaterial } from "./PlanDrawing";

import { constructPixelsPerMeter, wallSnapRadiusPixels } from "./plan-screen-scale";

import {
  constructionMarqueeTargets,
  constructionSelectionRectangle,
  resolveConstructionDeletionTargets,
} from "./selection-geometry";

import { beginSelectDrag } from "./select-drag-activation";

import { ConstructionEditLayerProps } from "./construction-edit-contract";

import {
  isConstructionDrawingTool,
  CapturedSelectDrag,
  groundPlane,
  MarqueeDrag,
  OpeningTool,
  PointerCaptureTarget,
  PointerEvent3D,
  releasePointer,
  samePlanPoint,
  stopPointer,
} from "./construction-pointer-events";

export function useConstructionPointerController({
  doorConfiguration = DEFAULT_DOOR_CONFIGURATION,
  planMode = false,
  referenceWalls = [],
  draft,
  coordinates,
  rooms,
  selection,
  deletionTargets = floorEditorSelectionTargets(selection),
  previewFloor,
  wallRuns = [],
  tool,
  drawStart = null,
  drawPreview = null,
  drawAngleReferenceRadians = null,
  wallExteriorColor = DEFAULT_WALL_COLORS.exterior,
  poolPoints = [],
  floorPaintTarget = "room",
  floorZonePoints = [],
  floorZonePreview = null,
  onCancelFloorZone,
  measurePhase = "idle",
  onSelectWall,
  onSelectOpening,
  onSelectRoom,
  onSelectMany,
  onClearSelection,
  onMoveEndpoint,
  onTranslateWall,
  onMoveOpening,
  onResizeOpening,
  onPlaceOpening,
  onBeginWall,
  onPreviewWall,
  onAddWall,
  onCancelWall,
  onPlaceMeasure,
  onPreviewMeasure,
  onPlaceFloorZonePoint,
  onPreviewFloorZonePoint,
  onDraggingChange,
  onMarqueeChange,
}: ConstructionEditLayerProps) {
  const attachments = useMemo(() => editorWallAttachments(draft), [draft]);
  const dom = useCabaneDom();
  const ToonMaterial = planMode ? PlanOverlayMaterial : LitMaterial;
  const getCanvasState = useThree((state) => state.get);
  const scratch = useRef(new Vector3());
  const [snap, setSnap] = useState<SnapTarget | null>(null);
  useEffect(() => setSnap(null), [tool, drawStart, floorZonePoints.length, selection]);
  const [draggingEndpoint, setDraggingEndpoint] = useState<
    | (CapturedSelectDrag & {
        wallId: string;
        endpoint: "from" | "to";
        origin: PlanPoint;
        angleOrigin: PlanPoint;
        point: PlanPoint;
      })
    | null
  >(null);
  const [draggingWall, setDraggingWall] = useState<
    | (CapturedSelectDrag & {
        wallId: string;
        from: PlanPoint;
        to: PlanPoint;
        grab: PlanPoint;
        delta: PlanPoint;
      })
    | null
  >(null);
  const [draggingOpening, setDraggingOpening] = useState<
    | (CapturedSelectDrag & {
        openingId: string;
        wallId: string;
        offsetPlanUnits: number;
      })
    | null
  >(null);
  const [resizingOpening, setResizingOpening] = useState<
    | (CapturedSelectDrag & {
        openingId: string;
        wallId: string;
        edge: "start" | "end";
        originalOffsetPlanUnits: number;
        originalWidthPlanUnits: number;
        offsetPlanUnits: number;
        widthPlanUnits: number;
      })
    | null
  >(null);
  const [openingPreview, setOpeningPreview] = useState<{
    wallId: string;
    offsetPlanUnits: number;
    valid: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeDrag | null>(null);
  const activeMarquee = useRef<MarqueeDrag | null>(null);
  const changeMarquee = useCallback((next: MarqueeDrag | null) => {
    activeMarquee.current = next;
    setMarquee(next);
  }, []);
  const releaseMarquee = useCallback(() => {
    const current = activeMarquee.current;
    if (current?.target.hasPointerCapture?.(current.pointerId) !== false) {
      current?.target.releasePointerCapture?.(current.pointerId);
    }
    changeMarquee(null);
    onDraggingChange?.(false);
    onMarqueeChange?.(false);
  }, [changeMarquee, onDraggingChange, onMarqueeChange]);
  useEffect(() => {
    if (
      !draggingEndpoint ||
      (tool === "select" && selection?.kind === "wall" && selection.id === draggingEndpoint.wallId)
    )
      return;
    const { target, pointerId } = draggingEndpoint;
    if (target.hasPointerCapture?.(pointerId) !== false) target.releasePointerCapture?.(pointerId);
    setDraggingEndpoint(null);
    setSnap(null);
    if (draggingEndpoint.dragActive) onDraggingChange?.(false);
  }, [tool, selection, draggingEndpoint, onDraggingChange]);
  useEffect(() => {
    if (tool !== "select" && activeMarquee.current) releaseMarquee();
  }, [releaseMarquee, tool]);
  useEffect(() => {
    if (typeof globalThis.addEventListener !== "function") return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeMarquee.current) return;
      event.preventDefault();
      releaseMarquee();
    };
    dom.events.addEventListener("keydown", cancel, true);
    return () => dom.events.removeEventListener("keydown", cancel, true);
  }, [releaseMarquee, dom]);
  useEffect(
    () => () => {
      const current = activeMarquee.current;
      if (current?.target.hasPointerCapture?.(current.pointerId) !== false) {
        current?.target.releasePointerCapture?.(current.pointerId);
      }
    },
    [],
  );
  const openingTool: OpeningTool | null =
    tool === "door" || tool === "window" || tool === "passage" || tool === "niche" ? tool : null;
  useEffect(() => setOpeningPreview(null), [tool]);
  const drawingFloorZone = tool === "floor" && floorPaintTarget === "custom-area";
  const drawing = isConstructionDrawingTool(tool) || drawingFloorZone;
  const outlinePoints =
    tool === "pool" || tool === "platform" ? poolPoints : drawingFloorZone ? floorZonePoints : [];
  const segmentStart = drawingFloorZone ? (floorZonePoints.at(-1) ?? null) : drawStart;
  const segmentPreview = drawingFloorZone ? floorZonePreview : drawPreview;
  const beginSegment = drawingFloorZone ? onPlaceFloorZonePoint : onBeginWall;
  const previewSegment = drawingFloorZone ? onPreviewFloorZonePoint : onPreviewWall;
  const commitSegment = drawingFloorZone ? onPlaceFloorZonePoint : onAddWall;
  const cancelDrawing = drawingFloorZone ? onCancelFloorZone : onCancelWall;
  const drawingSegments = outlinePoints.slice(1).map((to, index) => ({
    id: `construction-draft-${index}`,
    from: outlinePoints[index],
    to,
  }));
  const snapWalls = [...draft.walls, ...referenceWalls];
  const drawingWalls = [...snapWalls, ...(draft.hedges ?? []), ...drawingSegments];
  const previousSegment = drawingSegments.at(-1);
  const angleReference = previousSegment
    ? Math.atan2(
        previousSegment.to[1] - previousSegment.from[1],
        previousSegment.to[0] - previousSegment.from[0],
      )
    : (drawAngleReferenceRadians ?? undefined);
  const floorSpan = useMemo(() => {
    const coordinatesList = [
      ...draft.walls.flatMap((wall) => [wall.from, wall.to]),
      ...(draft.pools ?? []).flatMap((pool) => pool.polygon),
      ...(draft.outdoorPlatforms ?? []).flatMap((p) => p.polygon),
      ...poolPoints,
      ...floorZonePoints,
    ];
    const extent = Math.max(20, ...coordinatesList.flatMap((point) => point.map(Math.abs))) * 4;
    return extent * coordinates.metersPerPlanUnit;
  }, [
    coordinates.metersPerPlanUnit,
    draft.walls,
    draft.pools,
    draft.outdoorPlatforms,
    poolPoints,
    floorZonePoints,
  ]);
  const marqueeDistancePixels = marquee
    ? Math.hypot(
        marquee.clientTo[0] - marquee.clientFrom[0],
        marquee.clientTo[1] - marquee.clientFrom[1],
      )
    : 0;
  const marqueeActive = marqueeDistancePixels >= 4;
  const marqueeTargets = useMemo(
    () =>
      marqueeActive && marquee
        ? constructionMarqueeTargets({ from: marquee.from, to: marquee.to, draft, rooms })
        : [],
    [draft, marquee, marqueeActive, rooms],
  );
  const marqueeDeletionTargets = useMemo(
    () =>
      marqueeActive && previewFloor
        ? resolveConstructionDeletionTargets({
            selection: marqueeTargets,
            draft,
            previewFloor,
            wallRuns,
          })
        : marqueeTargets,
    [draft, marqueeActive, marqueeTargets, previewFloor, wallRuns],
  );
  const highlightedSelection = useMemo(
    () => createFloorEditorSelection(marqueeActive ? marqueeDeletionTargets : deletionTargets),
    [deletionTargets, marqueeActive, marqueeDeletionTargets],
  );
  const directlySelected = marqueeActive || selection?.kind === "multiple" ? null : selection;
  const roomTargets = useMemo(
    () =>
      rooms.map((room) => {
        const contour = room.polygon.map((point) => {
          const [x, z] = constructPlanToWorld(point, coordinates);
          return new Vector2(x, z);
        });
        const positions = ShapeUtils.triangulateShape(contour, []).flatMap((triangle) =>
          triangle.flatMap((index) => [contour[index].x, 0.018, contour[index].y]),
        );
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        return { room, geometry };
      }),
    [coordinates, rooms],
  );
  useEffect(
    () => () => {
      roomTargets.forEach(({ geometry }) => geometry.dispose());
    },
    [roomTargets],
  );
  const pointForEvent = (event: PointerEvent3D) => {
    const intersection = event.ray.intersectPlane(groundPlane, scratch.current);
    if (!intersection) return null;
    const editingWall = drawing || draggingEndpoint !== null;
    const { camera, size } = getCanvasState();
    const pixelsPerMeter = editingWall
      ? constructPixelsPerMeter(camera, size.height, draft.view.pixelsPerMeter)
      : draft.view.pixelsPerMeter;
    if (outlinePoints.length >= 3 && !event.nativeEvent.altKey) {
      const [x, z] = constructPlanToWorld(outlinePoints[0], coordinates);
      if (
        Math.hypot(intersection.x - x, intersection.z - z) * pixelsPerMeter <=
        wallSnapRadiusPixels(event.nativeEvent.pointerType)
      ) {
        setSnap(null);
        return outlinePoints[0];
      }
    }
    return worldDragToSnappedConstructPlan(
      omitUndefinedProperties({
        point: intersection,
        coordinates,
        walls: drawing || draggingEndpoint ? drawingWalls : snapWalls,
        onSnap: setSnap,
        pixelsPerMeter,
        snapRadiusPixels: editingWall
          ? wallSnapRadiusPixels(event.nativeEvent.pointerType)
          : undefined,
        pointerType: event.nativeEvent.pointerType,
        angleOrigin:
          draggingEndpoint?.angleOrigin ?? (drawing ? (segmentStart ?? undefined) : undefined),
        angleReferenceRadians: draggingEndpoint ? undefined : angleReference,
        movingEndpoint: draggingEndpoint?.origin,
        absolute: event.nativeEvent.altKey,
      }),
    );
  };

  const rawPlanPointForEvent = (event: PointerEvent3D) => {
    const intersection = event.ray.intersectPlane(groundPlane, scratch.current);
    return intersection
      ? worldPointToPlan({ x: intersection.x, z: intersection.z }, coordinates)
      : null;
  };

  const clientPointForEvent = (event: PointerEvent3D): readonly [number, number] => [
    event.nativeEvent.clientX,
    event.nativeEvent.clientY,
  ];

  const capturedSelectDrag = (event: PointerEvent3D): CapturedSelectDrag => ({
    ...beginSelectDrag(event.pointerId, clientPointForEvent(event)),
    target: event.target as PointerCaptureTarget,
  });

  const updateMarqueeForEvent = (event: PointerEvent3D, current: MarqueeDrag) => {
    const point = rawPlanPointForEvent(event);
    return point ? { ...current, to: point, clientTo: clientPointForEvent(event) } : current;
  };

  const finishMarquee = (event: PointerEvent3D) => {
    const current = activeMarquee.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const completed = updateMarqueeForEvent(event, current);
    const distance = Math.hypot(
      completed.clientTo[0] - completed.clientFrom[0],
      completed.clientTo[1] - completed.clientFrom[1],
    );
    if (distance >= 4) {
      onSelectMany?.(
        constructionMarqueeTargets({
          from: completed.from,
          to: completed.to,
          draft,
          rooms,
        }),
      );
    }
    releaseMarquee();
  };

  const translationPointForEvent = (event: PointerEvent3D) => {
    const intersection = event.ray.intersectPlane(groundPlane, scratch.current);
    if (!intersection) return null;
    return worldDragToConstructPlan({
      point: intersection,
      coordinates,
      absolute: event.nativeEvent.altKey,
    });
  };

  const wallDeltaForEvent = (event: PointerEvent3D, grab: PlanPoint): PlanPoint | null => {
    const point = translationPointForEvent(event);
    return point
      ? [Number((point[0] - grab[0]).toFixed(4)), Number((point[1] - grab[1]).toFixed(4))]
      : null;
  };

  const openingPlacementFromEvent = (event: PointerEvent3D, widthPlanUnits: number) => {
    const point = translationPointForEvent(event);
    return point
      ? openingPlacementForPlanPoint({
          point,
          walls: snapWalls,
          widthPlanUnits,
          metersPerPlanUnit: coordinates.metersPerPlanUnit,
        })
      : null;
  };

  const placementPreviewFromEvent = (event: PointerEvent3D, kind: OpeningTool) => {
    const dimensions = openingToolDimensions(
      kind,
      doorConfiguration,
      coordinates.metersPerPlanUnit,
    );
    return openingPlacementPreview(
      draft,
      kind,
      rawPlanPointForEvent(event),
      openingPlacementFromEvent(event, dimensions.widthPlanUnits),
      dimensions,
    );
  };

  const placeOpeningFromEvent = (event: PointerEvent3D) => {
    if (!openingTool) return;
    stopPointer(event);
    const placement = placementPreviewFromEvent(event, openingTool);
    setOpeningPreview(null);
    if (placement?.valid) {
      onPlaceOpening(openingTool, placement.wallId, placement.offsetPlanUnits, placement.side);
    }
  };

  const resizedOpeningForEvent = (
    event: PointerEvent3D,
    resize: NonNullable<typeof resizingOpening>,
  ) => {
    const point = translationPointForEvent(event);
    return point
      ? resizeWallAttachmentAtPoint(draft, resize, point, event.nativeEvent.altKey, coordinates)
      : null;
  };

  const finishEndpointDrag = (event: PointerEvent3D) => {
    if (!draggingEndpoint) return;
    const point = draggingEndpoint.dragActive ? pointForEvent(event) : null;
    releasePointer(event);
    setDraggingEndpoint(null);
    setSnap(null);
    if (draggingEndpoint.dragActive) onDraggingChange?.(false);
    if (point) onMoveEndpoint(draggingEndpoint.wallId, draggingEndpoint.endpoint, point);
  };

  const finishOpeningDrag = (event: PointerEvent3D) => {
    if (!draggingOpening) return;
    const opening = draggingOpening.dragActive
      ? attachments.find((candidate) => candidate.id === draggingOpening.openingId)
      : null;
    const placement = opening
      ? (openingPlacementFromEvent(event, opening.widthPlanUnits) ?? draggingOpening)
      : null;
    releasePointer(event);
    setDraggingOpening(null);
    if (draggingOpening.dragActive) onDraggingChange?.(false);
    if (placement)
      onMoveOpening(draggingOpening.openingId, placement.wallId, placement.offsetPlanUnits);
  };

  const finishOpeningResize = (event: PointerEvent3D) => {
    if (!resizingOpening) return;
    const resized = resizingOpening.dragActive
      ? (resizedOpeningForEvent(event, resizingOpening) ?? resizingOpening)
      : null;
    releasePointer(event);
    setResizingOpening(null);
    if (resizingOpening.dragActive) onDraggingChange?.(false);
    if (resized) onResizeOpening(resized.offsetPlanUnits, resized.widthPlanUnits);
  };

  const finishWallDrag = (event: PointerEvent3D) => {
    if (!draggingWall) return;
    const delta = draggingWall.dragActive ? wallDeltaForEvent(event, draggingWall.grab) : null;
    releasePointer(event);
    setDraggingWall(null);
    if (draggingWall.dragActive) onDraggingChange?.(false);
    if (delta && (delta[0] !== 0 || delta[1] !== 0)) {
      onTranslateWall(draggingWall.wallId, delta);
    }
  };

  const cancelEndpointDrag = (event: PointerEvent3D) => {
    if (!draggingEndpoint) return;
    releasePointer(event);
    setDraggingEndpoint(null);
    setSnap(null);
    if (draggingEndpoint.dragActive) onDraggingChange?.(false);
  };

  const cancelOpeningDrag = (event: PointerEvent3D) => {
    if (!draggingOpening) return;
    releasePointer(event);
    setDraggingOpening(null);
    if (draggingOpening.dragActive) onDraggingChange?.(false);
  };

  const cancelOpeningResize = (event: PointerEvent3D) => {
    if (!resizingOpening) return;
    releasePointer(event);
    setResizingOpening(null);
    if (resizingOpening.dragActive) onDraggingChange?.(false);
  };

  const cancelWallDrag = (event: PointerEvent3D) => {
    if (!draggingWall) return;
    releasePointer(event);
    setDraggingWall(null);
    if (draggingWall.dragActive) onDraggingChange?.(false);
  };

  const previewPoint = useCallback(
    (point: PlanPoint): PlanPoint => {
      if (draggingEndpoint && samePlanPoint(point, draggingEndpoint.origin)) {
        return draggingEndpoint.point;
      }
      if (draggingWall) {
        if (samePlanPoint(point, draggingWall.from))
          return [
            draggingWall.from[0] + draggingWall.delta[0],
            draggingWall.from[1] + draggingWall.delta[1],
          ];
        if (samePlanPoint(point, draggingWall.to))
          return [
            draggingWall.to[0] + draggingWall.delta[0],
            draggingWall.to[1] + draggingWall.delta[1],
          ];
      }
      return point;
    },
    [draggingEndpoint, draggingWall],
  );

  const preview =
    drawing && segmentStart && segmentPreview
      ? wallOverlayTransform(segmentStart, segmentPreview, coordinates)
      : null;
  const placementPreview =
    openingTool && openingPreview
      ? (() => {
          const wall = draft.walls.find((candidate) => candidate.id === openingPreview.wallId);
          if (!wall) return null;
          const { widthPlanUnits, openingHeightMeters, sillHeightMeters } = openingToolDimensions(
            openingTool,
            doorConfiguration,
            coordinates.metersPerPlanUnit,
          );
          const [fromX, fromZ] = constructPlanToWorld(wall.from, coordinates);
          const [toX, toZ] = constructPlanToWorld(wall.to, coordinates);
          const wallLength = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
          const progress = (openingPreview.offsetPlanUnits + widthPlanUnits / 2) / wallLength;
          return {
            ...openingPreview,
            widthMeters: widthPlanUnits * coordinates.metersPerPlanUnit,
            openingHeightMeters,
            sillHeightMeters,
            x: fromX + (toX - fromX) * progress,
            z: fromZ + (toZ - fromZ) * progress,
            rotationY: -Math.atan2(toZ - fromZ, toX - fromX),
          };
        })()
      : null;

  const displayedDraft = useMemo(
    () => ({
      ...draft,
      walls:
        draggingEndpoint || draggingWall
          ? draft.walls.map((wall) => ({
              ...wall,
              from: previewPoint(wall.from),
              to: previewPoint(wall.to),
            }))
          : draft.walls,
      openings:
        draggingOpening || resizingOpening
          ? draft.openings.map((opening) => {
              if (draggingOpening?.openingId === opening.id)
                return {
                  ...opening,
                  wallId: draggingOpening.wallId,
                  offsetPlanUnits: draggingOpening.offsetPlanUnits,
                };
              if (resizingOpening?.openingId === opening.id)
                return {
                  ...opening,
                  offsetPlanUnits: resizingOpening.offsetPlanUnits,
                  widthPlanUnits: resizingOpening.widthPlanUnits,
                };
              return opening;
            })
          : draft.openings,
    }),
    [draft, draggingEndpoint, draggingWall, draggingOpening, resizingOpening, previewPoint],
  );
  const displayedAttachments = previewWallAttachments(
    attachments,
    draggingOpening,
    resizingOpening,
  );
  const resizedWall = draggingEndpoint
    ? displayedDraft.walls.find((wall) => wall.id === draggingEndpoint.wallId)
    : null;
  const marqueeWorldRectangle =
    marqueeActive && marquee
      ? (() => {
          const rectangle = constructionSelectionRectangle(marquee.from, marquee.to);
          const [minX, minZ] = constructPlanToWorld([rectangle.minX, rectangle.minY], coordinates);
          const [maxX, maxZ] = constructPlanToWorld([rectangle.maxX, rectangle.maxY], coordinates);
          return {
            minX,
            maxX,
            minZ,
            maxZ,
            center: [(minX + maxX) / 2, (minZ + maxZ) / 2] as const,
            width: Math.max(0.001, maxX - minX),
            depth: Math.max(0.001, maxZ - minZ),
          };
        })()
      : null;

  return {
    snap,
    drawing,
    segmentStart,
    segmentPreview,
    beginSegment,
    previewSegment,
    commitSegment,
    cancelDrawing,
    drawingWalls,
    tool,
    rawPlanPointForEvent,
    clientPointForEvent,
    changeMarquee,
    onDraggingChange,
    onMarqueeChange,
    activeMarquee,
    updateMarqueeForEvent,
    finishMarquee,
    releaseMarquee,
    floorSpan,
    marqueeWorldRectangle,
    marqueeActive,
    draft,
    highlightedSelection,
    coordinates,
    planMode,
    displayedDraft,
    attachments,
    displayedAttachments,
    roomTargets,
    onSelectRoom,
    ToonMaterial,
    directlySelected,
    draggingEndpoint,
    draggingWall,
    previewPoint,
    openingTool,
    placeOpeningFromEvent,
    onSelectWall,
    setOpeningPreview,
    placementPreviewFromEvent,
    translationPointForEvent,
    setDraggingWall,
    capturedSelectDrag,
    wallDeltaForEvent,
    finishWallDrag,
    cancelWallDrag,
    setDraggingEndpoint,
    pointForEvent,
    finishEndpointDrag,
    cancelEndpointDrag,
    draggingOpening,
    resizingOpening,
    onSelectOpening,
    setDraggingOpening,
    openingPlacementFromEvent,
    finishOpeningDrag,
    cancelOpeningDrag,
    setResizingOpening,
    resizedOpeningForEvent,
    finishOpeningResize,
    cancelOpeningResize,
    preview,
    wallExteriorColor,
    drawStart,
    drawPreview,
    resizedWall,
    placementPreview,
    onClearSelection,
    onPlaceMeasure,
    drawingFloorZone,
    onPreviewWall,
    onBeginWall,
    measurePhase,
    onPreviewMeasure,
    onPreviewFloorZonePoint,
    onPlaceFloorZonePoint,
    onAddWall,
    onCancelWall,
  };
}
