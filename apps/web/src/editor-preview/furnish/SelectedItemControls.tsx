import { useCabaneDom } from "@cabane/engine";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import {
  resolveItemTransform,
  type FloorSpec,
  type ItemPlacement,
  type SceneItemSpec,
  type SceneItemSize,
  type SceneModelEditorDescriptor,
} from "@cabane/engine";
import { EditorActionButton } from "../../editor-chrome/EditorActionButton";
import { placementForWorldDrag, planPointForWorldDrag, selectionBoxGeometry } from "./editor-state";
import {
  itemRotation,
  normalizeRotation,
  rotationDelta,
  selectionRingRadius,
  selectionToolbarPosition,
} from "./selection-geometry";
import { SelectedItemActionBar, type SelectedItemActions } from "./SelectedItemActionBar";

import { SelectedItemResizeButton } from "./SelectedItemResizeButton";

interface RotationSession {
  kind: "rotation";
  pointerId: number;
  target: SVGPathElement;
  previousAngle: number;
  rotation: number;
}

interface ElevationSession {
  kind: "elevation";
  pointerId: number;
  target: HTMLDivElement;
  startY: number;
  pixelsPerMeter: number;
  placement: ItemPlacement;
}

interface MoveSession {
  kind: "move";
  pointerId: number;
  target: HTMLDivElement;
  elevation: number;
  offsetX: number;
  offsetZ: number;
}

export function SelectedItemControls({
  item,
  definition,
  floor,
  actions,
  busy,
  onRotate,
  onMovePlacement,
  onResize,
  onSelect,
  onBegin,
  onCommit,
  onCancel,
  actionsOnly = false,
  freePlacement = false,
}: {
  item: SceneItemSpec;
  definition: SceneModelEditorDescriptor;
  floor: FloorSpec;
  actions: SelectedItemActions;
  busy: boolean;
  onRotate: (id: string, radians: number) => void;
  onMovePlacement: (id: string, placement: ItemPlacement) => void;
  onResize: (id: string, size: SceneItemSize, definition: SceneModelEditorDescriptor) => void;
  onSelect: (id: string) => void;
  onBegin: () => void;
  onCommit: () => void;
  onCancel: () => void;
  actionsOnly?: boolean;
  freePlacement?: boolean;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const overlay = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGPathElement>(null);
  const hitRing = useRef<SVGPathElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const centerHandle = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const elevationHandle = useRef<HTMLDivElement>(null);
  const resizeHandle = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const session = useRef<RotationSession | MoveSession | ElevationSession | null>(null);
  const [rotating, setRotating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [elevating, setElevating] = useState(false);
  const transform = resolveItemTransform(item.placement, floor);
  const box = selectionBoxGeometry(item, definition);
  const radius = selectionRingRadius(item, definition);
  const scratch = useMemo(() => new Vector3(), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const pointer = useMemo(() => new Vector2(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0)), []);
  const callbacks = useRef({ onCancel, onCommit });
  useLayoutEffect(() => {
    callbacks.current = { onCancel, onCommit };
  });

  const finish = (cancel: boolean) => {
    const active = session.current;
    if (!active) return;
    session.current = null;
    setRotating(false);
    setMoving(false);
    setElevating(false);
    if (cancel) callbacks.current.onCancel();
    else callbacks.current.onCommit();
    if (active.target.hasPointerCapture?.(active.pointerId))
      active.target.releasePointerCapture(active.pointerId);
  };

  const dom = useCabaneDom();
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !session.current) return;
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    };
    const blur = () => finish(true);
    dom.events.addEventListener("keydown", cancel, true);
    window.addEventListener("blur", blur);
    return () => {
      dom.events.removeEventListener("keydown", cancel, true);
      window.removeEventListener("blur", blur);
      if (session.current) {
        session.current = null;
        callbacks.current.onCancel();
      }
    };
  }, [dom]);
  useLayoutEffect(() => {
    invalidate();
  }, [camera, invalidate, item, size]);

  const pointerPoint = (event: PointerEvent<Element>, elevation: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    plane.constant = -elevation;
    return raycaster.ray.intersectPlane(plane, scratch);
  };

  const pointerAngle = (event: PointerEvent<SVGPathElement>) => {
    const point = pointerPoint(event, transform.position[1]);
    return point
      ? Math.atan2(point.z - transform.position[2], point.x - transform.position[0])
      : null;
  };

  // Project into the canvas overlay without causing a React render on camera frames.
  useFrame(() => {
    if (!overlay.current || !toolbar.current) return;
    const project = (x: number, y: number, z: number) => {
      scratch.set(x, y, z).project(camera);
      return {
        x: ((scratch.x + 1) * size.width) / 2,
        y: ((1 - scratch.y) * size.height) / 2,
        z: scratch.z,
      };
    };
    const [px, py, pz] = transform.position;
    const center = project(px, py, pz);
    const visible =
      center.z >= -1 &&
      center.z <= 1 &&
      center.x >= 0 &&
      center.x <= size.width &&
      center.y >= 0 &&
      center.y <= size.height;
    overlay.current.style.visibility = visible ? "visible" : "hidden";
    if (!visible) return;
    const metre = project(px + 1, py, pz);
    const metreZ = project(px, py, pz + 1);
    const pixelsPerMetre = Math.max(
      Math.hypot(metre.x - center.x, metre.y - center.y),
      Math.hypot(metreZ.x - center.x, metreZ.y - center.y),
      1,
    );
    const displayedRadius = Math.max(radius, 72 / pixelsPerMetre);
    const points = Array.from({ length: 65 }, (_, index) => {
      const a = (index / 64) * Math.PI * 2;
      return project(px + Math.cos(a) * displayedRadius, py, pz + Math.sin(a) * displayedRadius);
    });
    const d =
      points
        .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" ") + " Z";
    ring.current?.setAttribute("d", d);
    hitRing.current?.setAttribute("d", d);
    const leftPoint = points.reduce((a, b) => (a.x < b.x ? a : b));
    const rightPoint = points.reduce((a, b) => (a.x > b.x ? a : b));
    const top = points.reduce((a, b) => (a.y < b.y ? a : b));
    const bottom = points.reduce((a, b) => (a.y > b.y ? a : b));
    const placeHandle = (element: HTMLElement | null, point: { x: number; y: number }) => {
      if (element)
        element.style.transform = `translate(${Math.max(24, Math.min(size.width - 24, point.x))}px, ${Math.max(24, Math.min(size.height - 24, point.y))}px) translate(-50%, -50%)`;
    };
    placeHandle(left.current, leftPoint);
    placeHandle(centerHandle.current, center);
    placeHandle(right.current, rightPoint);
    placeHandle(elevationHandle.current, { x: rightPoint.x, y: rightPoint.y - 52 });
    placeHandle(resizeHandle.current, { x: leftPoint.x, y: leftPoint.y + 52 });
    const corners = [];
    const c = Math.cos(transform.rotationYRadians),
      s = Math.sin(transform.rotationYRadians);
    for (const xSide of [-1, 1])
      for (const ySide of [-1, 1])
        for (const zSide of [-1, 1]) {
          const x = box.center[0] + (xSide * box.size[0]) / 2;
          const z = box.center[2] + (zSide * box.size[2]) / 2;
          corners.push(
            project(
              px + x * c + z * s,
              py + box.center[1] + (ySide * box.size[1]) / 2,
              pz - x * s + z * c,
            ),
          );
        }
    const canvasRect = gl.domElement.getBoundingClientRect();
    const header = gl.domElement
      .closest(".direction-preview")
      ?.querySelector(".editor-header")
      ?.getBoundingClientRect();
    const at = selectionToolbarPosition({
      centerX: (Math.min(...corners.map((p) => p.x)) + Math.max(...corners.map((p) => p.x))) / 2,
      itemTop: Math.min(...corners.map((p) => p.y)),
      itemBottom: Math.max(...corners.map((p) => p.y)),
      width: size.width,
      height: size.height,
      toolbarWidth: toolbar.current.offsetWidth,
      toolbarHeight: toolbar.current.offsetHeight,
      topInset: header ? header.bottom - canvasRect.top + 8 : 8,
    });
    toolbar.current.style.transform = `translate(${at.x}px, ${at.y}px)`;
    const readoutY = Math.min(size.height - 24, bottom.y + 25);
    const overlapsToolbar =
      bottom.x + 24 > at.x &&
      bottom.x - 24 < at.x + toolbar.current.offsetWidth &&
      readoutY + 14 > at.y &&
      readoutY - 14 < at.y + toolbar.current.offsetHeight;
    placeHandle(
      readout.current,
      overlapsToolbar ? { x: top.x, y: top.y - 25 } : { x: bottom.x, y: readoutY },
    );
  });

  const rotation = itemRotation(item.placement);
  const step = (direction: number) =>
    onRotate(item.id, normalizeRotation(rotation + (direction * Math.PI) / 2));
  return (
    <Html
      fullscreen
      calculatePosition={(_object, _camera, viewport) => [viewport.width / 2, viewport.height / 2]}
      zIndexRange={[6, 6]}
      style={{ pointerEvents: "none" }}
    >
      <div
        ref={overlay}
        className="selected-item-controls"
        data-item-id={item.id}
        data-rotating={rotating}
        data-moving={moving}
        data-actions-only={actionsOnly}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <svg className="selected-item-ring" aria-label={`Rotation ring for ${definition.label}`}>
          <path ref={ring} className="selected-item-ring__line" />
          <path
            ref={hitRing}
            className="selected-item-ring__target"
            style={{ pointerEvents: busy && !rotating ? "none" : undefined }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              if (event.button !== 0 || busy || session.current) return;
              event.preventDefault();
              event.stopPropagation();
              const angle = pointerAngle(event);
              if (angle === null) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              session.current = {
                kind: "rotation",
                pointerId: event.pointerId,
                target: event.currentTarget,
                previousAngle: angle,
                rotation,
              };
              setRotating(true);
              onBegin();
            }}
            onPointerMove={(event) => {
              const active = session.current;
              if (active?.kind !== "rotation" || active.pointerId !== event.pointerId) return;
              event.stopPropagation();
              const angle = pointerAngle(event);
              if (angle === null) return;
              active.rotation += rotationDelta(active.previousAngle, angle);
              active.previousAngle = angle;
              onRotate(item.id, normalizeRotation(active.rotation));
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              if (event.pointerId === session.current?.pointerId) finish(false);
            }}
            onPointerCancel={() => finish(true)}
            onLostPointerCapture={() => finish(true)}
          />
        </svg>
        <div ref={left} className="selected-item-rotation-button">
          <EditorActionButton
            icon="rotateLeft"
            label="Rotate counterclockwise 90°"
            disabled={busy}
            onClick={() => step(1)}
          />
        </div>
        <div
          ref={centerHandle}
          className="selected-item-rotation-button selected-item-move-button"
          onPointerDown={(event) => {
            if (event.button !== 0 || busy || session.current) return;
            event.preventDefault();
            event.stopPropagation();
            const point = pointerPoint(event, transform.position[1]);
            if (!point) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            session.current = {
              kind: "move",
              pointerId: event.pointerId,
              target: event.currentTarget,
              elevation: transform.position[1],
              offsetX: transform.position[0] - point.x,
              offsetZ: transform.position[2] - point.z,
            };
            setMoving(true);
            onSelect(item.id);
            onBegin();
          }}
          onPointerMove={(event) => {
            const active = session.current;
            if (active?.kind !== "move" || active.pointerId !== event.pointerId) return;
            event.stopPropagation();
            const point = pointerPoint(event, active.elevation);
            if (!point) return;
            onMovePlacement(
              item.id,
              freePlacement && item.placement.kind === "absolute"
                ? {
                    ...item.placement,
                    at: planPointForWorldDrag(
                      { x: point.x + active.offsetX, z: point.z + active.offsetZ },
                      floor.coordinates,
                      event.altKey,
                    ),
                  }
                : placementForWorldDrag({
                    world: { x: point.x + active.offsetX, z: point.z + active.offsetZ },
                    item,
                    definition,
                    floor,
                    raw: event.altKey,
                  }),
            );
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            if (event.pointerId === session.current?.pointerId) finish(false);
          }}
          onPointerCancel={() => finish(true)}
          onLostPointerCapture={() => finish(true)}
        >
          <EditorActionButton
            icon="move"
            label="Drag to move"
            disabled={busy && !moving}
            onClick={() => onSelect(item.id)}
          />
        </div>
        <div ref={right} className="selected-item-rotation-button">
          <EditorActionButton
            icon="rotateRight"
            label="Rotate clockwise 90°"
            disabled={busy}
            onClick={() => step(-1)}
          />
        </div>
        <div
          ref={elevationHandle}
          className="selected-item-rotation-button selected-item-elevation-button"
          onPointerDown={(event) => {
            if (event.button !== 0 || busy || session.current) return;
            event.preventDefault();
            event.stopPropagation();
            const anchor = new Vector3(...transform.position);
            const projected = anchor.clone().project(camera);
            const above = anchor
              .add(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion))
              .project(camera);
            event.currentTarget.setPointerCapture(event.pointerId);
            session.current = {
              kind: "elevation",
              pointerId: event.pointerId,
              target: event.currentTarget,
              startY: event.clientY,
              pixelsPerMeter: Math.max(
                1,
                (Math.abs(above.y - projected.y) * gl.domElement.getBoundingClientRect().height) /
                  2,
              ),
              placement: item.placement,
            };
            setElevating(true);
            onSelect(item.id);
            onBegin();
          }}
          onPointerMove={(event) => {
            const active = session.current;
            if (active?.kind !== "elevation" || active.pointerId !== event.pointerId) return;
            event.stopPropagation();
            const delta = (active.startY - event.clientY) / active.pixelsPerMeter;
            const placement = active.placement;
            onMovePlacement(
              item.id,
              placement.kind === "ceiling"
                ? { ...placement, dropMeters: placement.dropMeters - delta }
                : { ...placement, elevationMeters: placement.elevationMeters + delta },
            );
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            if (event.pointerId === session.current?.pointerId) finish(false);
          }}
          onPointerCancel={() => finish(true)}
          onLostPointerCapture={() => finish(true)}
        >
          <EditorActionButton
            icon="elevation"
            label="Drag to change elevation"
            disabled={busy && !elevating}
            onClick={() => onSelect(item.id)}
          />
        </div>
        <SelectedItemResizeButton
          ref={resizeHandle}
          item={item}
          definition={definition}
          busy={busy}
          onResize={onResize}
          onBegin={onBegin}
          onCommit={onCommit}
          onCancel={onCancel}
        />
        <output ref={readout} className="selected-item-angle" aria-label="Rotation angle">
          {Number(((normalizeRotation(rotation) * 180) / Math.PI).toFixed(1))}°
        </output>
        <SelectedItemActionBar
          ref={toolbar}
          {...actions}
          isDevice={item.kind === "device" || !!item.lightSlotId}
          disabled={busy}
        />
      </div>
    </Html>
  );
}
