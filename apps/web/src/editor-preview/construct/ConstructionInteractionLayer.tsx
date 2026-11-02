import { WallFinishHighlight } from "./WallFinishHighlight";
import { useEffect, useRef } from "react";
import { beginSegmentPress, segmentPressAnchors, type SegmentPress } from "./segment-gesture";
import { ConstructionAlignmentGuide } from "./ConstructionAlignmentGuide";
import { floorEditorSelectionIncludes } from "@cabane/engine";

import { DoubleSide } from "three";

import { constructPlanToWorld } from "./drag-geometry";

import { ConstructionPlanWalls } from "./ConstructionPlanWalls";

import { noPlanRaycast, PlanOverlayMaterial, PlanStroke } from "./PlanDrawing";

import { ConstructionWallMeasurements } from "./ConstructionWallMeasurements";

import {
  capturePointer,
  PointerCaptureTarget,
  releasePointer,
  stopPointer,
} from "./construction-pointer-events";

import { ConstructionOpeningTargets } from "./ConstructionOpeningTargets";
import { ConstructionWallTargets } from "./ConstructionWallTargets";
import { useConstructionPointerController } from "./useConstructionPointerController";

export function ConstructionInteractionLayer(
  props: Parameters<typeof useConstructionPointerController>[0],
) {
  const {
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
    resizedWall,
    placementPreview,
    onClearSelection,
    onPlaceMeasure,
    measurePhase,
    onPreviewMeasure,
  } = useConstructionPointerController(props);
  const startingPress = useRef<SegmentPress | null>(null);
  useEffect(() => {
    startingPress.current = null;
  }, [tool]);
  return (
    <group name="construction-edit-layer">
      {props.previewFloor && (
        <WallFinishHighlight floor={props.previewFloor} selection={props.selection} />
      )}
      <ConstructionAlignmentGuide snap={snap} coordinates={coordinates} />
      <mesh
        name="construction-marquee-surface"
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={39}
        onPointerDown={(event) => {
          if (
            tool !== "select" ||
            event.button !== 0 ||
            !event.nativeEvent?.shiftKey ||
            event.nativeEvent.metaKey ||
            event.nativeEvent.ctrlKey ||
            event.nativeEvent.altKey
          )
            return;
          const point = rawPlanPointForEvent(event);
          if (!point) return;
          capturePointer(event);
          const client = clientPointForEvent(event);
          changeMarquee({
            from: point,
            to: point,
            clientFrom: client,
            clientTo: client,
            pointerId: event.pointerId,
            target: event.target as PointerCaptureTarget,
          });
          onDraggingChange?.(true);
          onMarqueeChange?.(true);
        }}
        onPointerMove={(event) => {
          const current = activeMarquee.current;
          if (!current || current.pointerId !== event.pointerId) return;
          event.stopPropagation();
          changeMarquee(updateMarqueeForEvent(event, current));
        }}
        onPointerUp={finishMarquee}
        onPointerCancel={(event) => {
          const current = activeMarquee.current;
          if (!current || current.pointerId !== event.pointerId) return;
          event.stopPropagation();
          releaseMarquee();
        }}
      >
        <planeGeometry args={[floorSpan, floorSpan]} />
        <PlanOverlayMaterial
          visible={false}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {marqueeWorldRectangle && (
        <group name="construction-marquee-preview">
          <mesh
            position={[marqueeWorldRectangle.center[0], 0.76, marqueeWorldRectangle.center[1]]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={40}
            raycast={noPlanRaycast}
          >
            <planeGeometry args={[marqueeWorldRectangle.width, marqueeWorldRectangle.depth]} />
            <PlanOverlayMaterial
              color="#ff754d"
              transparent
              opacity={0.11}
              depthTest={false}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          <PlanStroke
            from={[marqueeWorldRectangle.minX, marqueeWorldRectangle.minZ]}
            to={[marqueeWorldRectangle.maxX, marqueeWorldRectangle.minZ]}
            color="#cf6648"
            width={0.035}
            elevation={0.78}
          />
          <PlanStroke
            from={[marqueeWorldRectangle.maxX, marqueeWorldRectangle.minZ]}
            to={[marqueeWorldRectangle.maxX, marqueeWorldRectangle.maxZ]}
            color="#cf6648"
            width={0.035}
            elevation={0.78}
          />
          <PlanStroke
            from={[marqueeWorldRectangle.maxX, marqueeWorldRectangle.maxZ]}
            to={[marqueeWorldRectangle.minX, marqueeWorldRectangle.maxZ]}
            color="#cf6648"
            width={0.035}
            elevation={0.78}
          />
          <PlanStroke
            from={[marqueeWorldRectangle.minX, marqueeWorldRectangle.maxZ]}
            to={[marqueeWorldRectangle.minX, marqueeWorldRectangle.minZ]}
            color="#cf6648"
            width={0.035}
            elevation={0.78}
          />
        </group>
      )}
      {marqueeActive &&
        (draft.pools ?? [])
          .filter((pool) => floorEditorSelectionIncludes(highlightedSelection, "pool", pool.id))
          .map((pool) => (
            <group key={pool.id} name={`construction-marquee-pool-${pool.id}`}>
              {pool.polygon.map((from, index) => (
                <PlanStroke
                  key={index}
                  from={constructPlanToWorld(from, coordinates)}
                  to={constructPlanToWorld(
                    pool.polygon[(index + 1) % pool.polygon.length],
                    coordinates,
                  )}
                  color="#ff754d"
                  width={0.065}
                  elevation={0.79}
                />
              ))}
            </group>
          ))}
      {planMode && (
        <ConstructionPlanWalls draft={displayedDraft} attachments={displayedAttachments} />
      )}
      {roomTargets.map(({ room, geometry }) => {
        const selected = floorEditorSelectionIncludes(highlightedSelection, "room", room.id);
        return (
          <mesh
            key={room.id}
            name={`construction-room-target-${room.id}`}
            geometry={geometry}
            renderOrder={selected ? 12 : 1}
            userData={{ roomId: room.id }}
            onPointerDown={(event) => {
              if (tool !== "select" || event.nativeEvent?.shiftKey) return;
              stopPointer(event);
              onSelectRoom(room.id);
            }}
          >
            <ToonMaterial
              color="#ff754d"
              transparent
              visible={selected}
              opacity={selected ? 0.12 : 0}
              side={DoubleSide}
              depthTest={!selected}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      <ConstructionWallTargets
        {...{
          draft,
          highlightedSelection,
          directlySelected,
          draggingEndpoint,
          draggingWall,
          previewPoint,
          coordinates,
          openingTool,
          placeOpeningFromEvent,
          tool,
          onSelectWall,
          setOpeningPreview,
          placementPreviewFromEvent,
          ToonMaterial,
          planMode,
          translationPointForEvent,
          setDraggingWall,
          capturedSelectDrag,
          clientPointForEvent,
          onDraggingChange,
          wallDeltaForEvent,
          finishWallDrag,
          cancelWallDrag,
          setDraggingEndpoint,
          pointForEvent,
          finishEndpointDrag,
          cancelEndpointDrag,
        }}
      />

      <ConstructionOpeningTargets
        attachments={attachments}
        {...{
          draft,
          draggingOpening,
          resizingOpening,
          previewPoint,
          coordinates,
          highlightedSelection,
          directlySelected,
          planMode,
          tool,
          onSelectOpening,
          setDraggingOpening,
          capturedSelectDrag,
          clientPointForEvent,
          onDraggingChange,
          openingPlacementFromEvent,
          finishOpeningDrag,
          cancelOpeningDrag,
          ToonMaterial,
          setResizingOpening,
          resizedOpeningForEvent,
          finishOpeningResize,
          cancelOpeningResize,
        }}
      />

      {preview && preview.length > 0.001 && (
        <mesh
          name={`construction-${tool}-preview`}
          raycast={noPlanRaycast}
          position={[preview.center[0], 0.12, preview.center[1]]}
          rotation={[0, preview.rotationYRadians, 0]}
          renderOrder={22}
        >
          <boxGeometry args={[preview.length, 0.2, tool === "virtual-wall" ? 0.025 : 0.12]} />
          <ToonMaterial
            color={tool === "wall" || tool === "virtual-wall" ? wallExteriorColor : "#ff754d"}
            transparent
            opacity={0.72}
            depthTest={false}
          />
        </mesh>
      )}
      {drawing && segmentStart && segmentPreview && (
        <ConstructionWallMeasurements
          walls={drawingWalls}
          primary={{ from: segmentStart, to: segmentPreview }}
          junctions={[segmentStart, segmentPreview]}
          coordinates={coordinates}
          planMode={planMode}
          defaultThicknessMeters={
            tool === "wall" || tool === "virtual-wall" ? draft.interiorWallThicknessMeters : 0.055
          }
          labelKind={
            tool === "hedge"
              ? "Boundary"
              : tool === "wall"
                ? "Wall"
                : tool === "virtual-wall"
                  ? "Invisible wall"
                  : tool === "platform"
                    ? "Platform edge"
                    : tool === "pool"
                      ? "Pool edge"
                      : "Floor edge"
          }
        />
      )}
      {resizedWall && draggingEndpoint && tool === "select" && (
        <ConstructionWallMeasurements
          walls={displayedDraft.walls}
          primary={resizedWall}
          junctions={[draggingEndpoint.point]}
          coordinates={coordinates}
          planMode={planMode}
          defaultThicknessMeters={draft.interiorWallThicknessMeters}
        />
      )}

      {placementPreview && (
        <group
          name={`construction-opening-placement-preview-${openingTool}`}
          position={[
            placementPreview.x,
            placementPreview.sillHeightMeters + placementPreview.openingHeightMeters / 2,
            placementPreview.z,
          ]}
          rotation={[0, placementPreview.rotationY, 0]}
          userData={{
            validPlacement: placementPreview.valid,
            wallId: placementPreview.wallId,
            offsetPlanUnits: placementPreview.offsetPlanUnits,
          }}
        >
          <mesh renderOrder={28}>
            <boxGeometry
              args={[placementPreview.widthMeters, placementPreview.openingHeightMeters, 0.15]}
            />
            <ToonMaterial
              color={placementPreview.valid ? "#ff754d" : "#c45345"}
              transparent
              opacity={0.34}
              wireframe
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[
              0,
              -placementPreview.openingHeightMeters / 2 - placementPreview.sillHeightMeters + 0.055,
              0,
            ]}
            renderOrder={27}
          >
            <boxGeometry args={[placementPreview.widthMeters, 0.025, 0.28]} />
            <ToonMaterial
              color={placementPreview.valid ? "#ff754d" : "#c45345"}
              transparent
              opacity={0.72}
              depthTest={false}
            />
          </mesh>
        </group>
      )}

      <mesh
        name="construction-placement-surface"
        position={[0, -0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          if (tool === "select") {
            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
              stopPointer(event);
              onClearSelection?.();
            }
            return;
          }
          if (openingTool) return placeOpeningFromEvent(event);
          if (tool === "measure") {
            stopPointer(event);
            const point = pointForEvent(event);
            if (point) onPlaceMeasure?.(point);
            return;
          }
          if (!drawing) return;
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
          capturePointer(event);
          const point = pointForEvent(event);
          if (!point) return;
          onDraggingChange?.(true);
          startingPress.current = beginSegmentPress(
            event.pointerId,
            clientPointForEvent(event),
            point,
            Boolean(segmentStart),
          );
          if (segmentStart) previewSegment?.(point);
          else beginSegment?.(point);
        }}
        onPointerMove={(event) => {
          if (openingTool) {
            setOpeningPreview(placementPreviewFromEvent(event, openingTool));
            return;
          }
          if (tool === "measure" && measurePhase === "drawing") {
            stopPointer(event);
            const point = pointForEvent(event);
            if (point) onPreviewMeasure?.(point);
            return;
          }
          if (!drawing || !segmentStart) return;
          stopPointer(event);
          const point = pointForEvent(event);
          if (point) previewSegment?.(point);
        }}
        onPointerUp={(event) => {
          if (!drawing || !segmentStart) return;
          const press = startingPress.current;
          startingPress.current = null;
          const client = clientPointForEvent(event);
          // The initial click establishes an anchor. Small release jitter must
          // not create a wall along its supporting surface or move that anchor.
          const anchorOnly = segmentPressAnchors(press, event.pointerId, client);
          const point = anchorOnly ? null : pointForEvent(event);
          releasePointer(event);
          if (anchorOnly) previewSegment?.(press!.point);
          else if (point) commitSegment?.(point);
          onDraggingChange?.(false);
        }}
        onPointerCancel={(event) => {
          if (openingTool) {
            stopPointer(event);
            setOpeningPreview(null);
            return;
          }
          if (!drawing) return;
          startingPress.current = null;
          releasePointer(event);
          cancelDrawing?.();
          onDraggingChange?.(false);
        }}
      >
        <planeGeometry args={[floorSpan, floorSpan]} />
        <ToonMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
