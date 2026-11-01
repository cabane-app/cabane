import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { StairFlight } from "@cabane/engine";
import { SelectionActionBar } from "../editor-chrome/SelectionActionBar";
import { EditorActionButton } from "../editor-chrome/EditorActionButton";
import { selectionToolbarPosition } from "../editor-chrome/selection-toolbar-position";

export function SelectedStairControls({
  flight,
  destinationName,
  onGoToFloor,
  onDelete,
}: {
  flight: StairFlight;
  destinationName: string;
  onGoToFloor?: (() => void) | undefined;
  onDelete: () => void;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const toolbar = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const scratch = useMemo(() => new Vector3(), []);
  const footprintCenter = useMemo(
    () =>
      [
        (Math.min(...flight.footprintWorld.map((p) => p[0])) +
          Math.max(...flight.footprintWorld.map((p) => p[0]))) /
          2,
        (Math.min(...flight.footprintWorld.map((p) => p[1])) +
          Math.max(...flight.footprintWorld.map((p) => p[1]))) /
          2,
      ] as const,
    [flight],
  );
  useLayoutEffect(() => {
    invalidate();
  }, [invalidate, flight, size]);
  useFrame(() => {
    if (!toolbar.current || !overlay.current) return;
    const project = (x: number, z: number) => {
      scratch.set(x, 0.13, z).project(camera);
      return {
        x: ((scratch.x + 1) * size.width) / 2,
        y: ((1 - scratch.y) * size.height) / 2,
        z: scratch.z,
      };
    };
    const points = flight.footprintWorld.map(([x, z]) => project(x, z));
    const center = project(...footprintCenter);
    overlay.current.style.visibility = "hidden";
    if (
      center.z < -1 ||
      center.z > 1 ||
      center.x < 0 ||
      center.x > size.width ||
      center.y < 0 ||
      center.y > size.height
    )
      return;
    const header = gl.domElement
      .closest(".direction-preview")
      ?.querySelector(".editor-header")
      ?.getBoundingClientRect();
    const at = selectionToolbarPosition({
      centerX: center.x,
      itemTop: Math.min(...points.map((p) => p.y)),
      itemBottom: Math.max(...points.map((p) => p.y)),
      width: size.width,
      height: size.height,
      toolbarWidth: toolbar.current.offsetWidth,
      toolbarHeight: toolbar.current.offsetHeight,
      topInset: header ? header.bottom - gl.domElement.getBoundingClientRect().top + 8 : 8,
    });
    overlay.current.style.visibility = "visible";
    toolbar.current.style.transform = `translate(${at.x}px, ${at.y}px)`;
  });
  return (
    <Html
      fullscreen
      calculatePosition={(_object, _camera, viewport) => [viewport.width / 2, viewport.height / 2]}
      zIndexRange={[6, 6]}
      style={{ pointerEvents: "none" }}
    >
      <div ref={overlay} className="selected-item-controls">
        <SelectionActionBar ref={toolbar} mode="construct" label="Selected stair actions">
          {onGoToFloor && (
            <>
              <EditorActionButton
                icon="floor"
                label={`Go to ${destinationName}`}
                onClick={onGoToFloor}
              />
              <span className="selected-item-actions__separator" aria-hidden="true" />
            </>
          )}
          <EditorActionButton icon="delete" label="Delete stairs" onClick={onDelete} />
        </SelectionActionBar>
      </div>
    </Html>
  );
}
