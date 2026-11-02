import { MAX_ORTHOGRAPHIC_ZOOM } from "./navigation/camera-zoom";
import {
  readOrbitView,
  writeOrbitView,
  fitSavedOrbitView,
  type SavedOrbitView,
  type OrbitViewActions,
} from "./navigation/orbit-view";
import { deriveFloorLevels } from "./building/floor-levels";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MapControls, OrthographicCamera } from "@react-three/drei";

import { useThree } from "@react-three/fiber";

import { Spherical, Vector3, type OrthographicCamera as ThreeOrthographicCamera } from "three";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type Ref } from "react";

import { worldBoundsForFloorScene } from "./pools/pool-footprint";

import type { FloorSpec, RoomSpec } from "./types";
import { ROOF_MAX_RISE_METERS, ROOF_THICKNESS_METERS } from "./roof/roof-settings";
import { RoomCameraTransition, type RoomFocusFrame } from "./room-navigation";
import { useCameraWheelZoom } from "./useCameraWheelZoom";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const ORBIT_DOUBLE_TAP_DELAY_MS = 320;

const ORBIT_DOUBLE_TAP_DISTANCE_PX = 24;

const ORBIT_TAP_MOVEMENT_PX = 12;

const ORBIT_DOUBLE_TAP_ZOOM_FACTOR = 1.5;

function OrbitDoubleTapZoom({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, gl, invalidate } = useThree();
  const gesture = useRef<{
    active: Map<number, { x: number; y: number }>;
    hadMultiplePointers: boolean;
    lastTap: { time: number; x: number; y: number } | null;
  }>({
    active: new Map(),
    hadMultiplePointers: false,
    lastTap: null,
  });

  useEffect(() => {
    const element = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !controls.current?.enabled) return;
      const current = gesture.current;
      current.active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (current.active.size > 1) current.hadMultiplePointers = true;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !controls.current?.enabled) return;
      const current = gesture.current;
      const start = current.active.get(event.pointerId);
      current.active.delete(event.pointerId);

      if (!start || current.hadMultiplePointers) {
        if (current.active.size === 0) current.hadMultiplePointers = false;
        current.lastTap = null;
        return;
      }

      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (movement > ORBIT_TAP_MOVEMENT_PX) {
        current.lastTap = null;
        return;
      }

      const previous = current.lastTap;
      const isDoubleTap =
        previous !== null &&
        event.timeStamp - previous.time <= ORBIT_DOUBLE_TAP_DELAY_MS &&
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <=
          ORBIT_DOUBLE_TAP_DISTANCE_PX;

      if (!isDoubleTap) {
        current.lastTap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
        return;
      }

      current.lastTap = null;
      event.preventDefault();
      const orbitCamera = camera as ThreeOrthographicCamera;
      if (!orbitCamera.isOrthographicCamera) return;
      controls.current?.dispatchEvent({ type: "start", target: controls.current });
      orbitCamera.zoom = Math.min(
        MAX_ORTHOGRAPHIC_ZOOM,
        orbitCamera.zoom * ORBIT_DOUBLE_TAP_ZOOM_FACTOR,
      );
      orbitCamera.updateProjectionMatrix();
      controls.current?.dispatchEvent({ type: "change", target: controls.current });
      controls.current?.dispatchEvent({ type: "end", target: controls.current });
      invalidate();
    };

    const onPointerCancel = (event: PointerEvent) => {
      const current = gesture.current;
      current.active.delete(event.pointerId);
      if (current.active.size === 0) current.hadMultiplePointers = false;
      current.lastTap = null;
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerCancel);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [camera, gl, invalidate, controls]);

  return null;
}

export const cameraZoomForViewport = (
  viewportWidth: number,
  viewportHeight: number,
  bounds: { width: number; depth: number },
  focused: boolean,
) => {
  const widthFit = viewportWidth / Math.max(1, bounds.width * (focused ? 1.28 : 1.6));
  const depthFit = viewportHeight / Math.max(1, bounds.depth * (focused ? 1.15 : 1.55));
  return clamp(Math.min(widthFit, depthFit), focused ? 46 : 8, focused ? 160 : 115);
};

interface OrbitCameraProps {
  viewKey?: string;
  locked?: boolean;
  viewActions?: React.RefObject<OrbitViewActions | null>;
  controlsRef?: Ref<OrbitControlsImpl>;
  floor: FloorSpec;
  showRoof?: boolean;
  elevation?: number;
  buildingFloors?: readonly (FloorSpec & { elevationMeters?: number })[];
  room?: RoomSpec;
  roomFrame?: RoomFocusFrame | null;
  roomRequestKey?: number;
  reducedMotion?: boolean;
  resetKey: number;
}

export function OrbitCamera(props: OrbitCameraProps) {
  return <OrbitCameraRig key={`${props.viewKey ?? ""}:${props.resetKey}`} {...props} />;
}

function OrbitCameraRig({
  viewKey,
  locked = false,
  viewActions,
  showRoof = false,
  controlsRef,
  elevation = 0,
  buildingFloors,
  floor,
  room,
  roomFrame = null,
  roomRequestKey = 0,
  reducedMotion = false,
}: OrbitCameraProps) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  useCameraWheelZoom(orbitRef);
  const interruptRoomFlight = useRef<(() => void) | null>(null);
  const attachControls = useCallback(
    (controls: OrbitControlsImpl | null) => {
      orbitRef.current = controls;
      if (typeof controlsRef === "function") controlsRef(controls);
      else if (controlsRef) controlsRef.current = controls;
    },
    [controlsRef],
  );
  // MapControls reconnects its pointer listeners when onStart changes. Keep the
  // callback stable so dashboard updates cannot strand an active touch/drag.
  const manual = useRef(false);
  const interruptNavigation = useCallback(() => {
    interruptRoomFlight.current?.();
    manual.current = true;
  }, []);
  const automaticNavigation = useCallback(() => {
    manual.current = false;
  }, []);
  const { width, height } = useThree((state) => state.size);
  const defaultFraming = useMemo(() => {
    const bounds = worldBoundsForFloorScene(floor);
    if (buildingFloors?.length) {
      for (const level of buildingFloors) {
        const other = worldBoundsForFloorScene(level);
        bounds.minX = Math.min(bounds.minX, other.minX);
        bounds.maxX = Math.max(bounds.maxX, other.maxX);
        bounds.minZ = Math.min(bounds.minZ, other.minZ);
        bounds.maxZ = Math.max(bounds.maxZ, other.maxZ);
      }
      bounds.width = bounds.maxX - bounds.minX;
      bounds.depth = bounds.maxZ - bounds.minZ;
      bounds.centerX = (bounds.minX + bounds.maxX) / 2;
      bounds.centerZ = (bounds.minZ + bounds.maxZ) / 2;
    }
    const levels = deriveFloorLevels(buildingFloors ?? []);
    const buildingBase = levels[0]?.elevationMeters ?? 0;
    const buildingHeight =
      (levels.length
        ? levels.at(-1)!.elevationMeters +
          buildingFloors!.at(-1)!.floorToFloorHeightMeters -
          buildingBase
        : 0) + (showRoof ? ROOF_MAX_RISE_METERS + ROOF_THICKNESS_METERS + 0.16 : 0);
    const span = Math.max(bounds.width, bounds.depth, buildingHeight, 2);
    const stacked = showRoof || (buildingFloors?.length ?? 0) > 1;
    const targetHeight = stacked ? buildingBase + buildingHeight / 2 : 0.2 + elevation;
    const zoom = cameraZoomForViewport(
      width,
      height,
      stacked ? { width: bounds.width, depth: bounds.depth + buildingHeight * 0.75 } : bounds,
      false,
    );
    return {
      position: [
        bounds.centerX + span * 0.82,
        span * 1.16 + 2.8 + targetHeight,
        bounds.centerZ + span * 0.92,
      ] as const,
      target: [bounds.centerX, targetHeight, bounds.centerZ] as const,
      zoom,
    };
  }, [buildingFloors, elevation, floor, height, showRoof, width]);
  // Orthographic magnification comes from zoom, not the orbit radius. Keep the
  // camera behind the scene so the near plane cannot slice foreground geometry.
  const minDistance = Math.hypot(
    ...defaultFraming.position.map((value, index) => value - defaultFraming.target[index]),
  );
  // Keep the home legible: manual zoom-out stops just beyond its fitted overview.
  const minZoom = defaultFraming.zoom * 0.7;
  // Read once per home/floor mount. Metadata updates never reset a user view.
  const [framing] = useState<SavedOrbitView & { restored?: boolean }>(() => {
    const fallback: SavedOrbitView = {
      ...defaultFraming,
      viewport: [Math.max(1, width), Math.max(1, height)],
    };
    const saved = viewKey ? readOrbitView(viewKey).pose : null;
    if (!saved) return fallback;
    const adapted = fitSavedOrbitView(saved, width, height);
    if (adapted.zoom < minZoom) return fallback;
    // A removed/moved floor should not leave the home outside the camera.
    const span = new Vector3(...defaultFraming.position).distanceTo(
      new Vector3(...defaultFraming.target),
    );
    return new Vector3(...adapted.target).distanceTo(new Vector3(...defaultFraming.target)) <
      span * 4 &&
      new Vector3(...adapted.position).distanceTo(new Vector3(...adapted.target)) < span * 4
      ? { ...adapted, restored: true }
      : fallback;
  });
  const remembered = useRef<SavedOrbitView | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useCallback(() => {
    const controls = orbitRef.current;
    if (!manual.current || !controls) return;
    remembered.current = {
      position: controls.object.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number],
      zoom: (controls.object as ThreeOrthographicCamera).zoom,
      viewport: [Math.max(1, width), Math.max(1, height)],
    };
    if (viewKey) writeOrbitView(viewKey, { pose: remembered.current }, false);
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      if (viewKey && remembered.current) writeOrbitView(viewKey, { pose: remembered.current });
    }, 150);
  }, [viewKey, width, height]);
  useEffect(() => {
    const flush = () => {
      if (pending.current) clearTimeout(pending.current);
      if (viewKey && remembered.current) writeOrbitView(viewKey, { pose: remembered.current });
    };
    if (typeof window !== "undefined") window.addEventListener("pagehide", flush);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [viewKey]);
  const getOverviewPose = () => {
    const source = remembered.current ?? framing;
    const pose = fitSavedOrbitView(source, width, height);
    const target = new Vector3(...pose.target);
    return {
      target,
      offset: new Spherical().setFromVector3(new Vector3(...pose.position).sub(target)),
      zoom: Math.max(minZoom, pose.zoom),
    };
  };
  useEffect(() => {
    if (!viewActions) return;
    const apply = (topDown: boolean) => {
      const controls = orbitRef.current;
      if (!controls) return;
      interruptNavigation();
      controls.enableDamping = false;
      controls.update();
      controls.target.set(...defaultFraming.target);
      controls.object.position.set(...defaultFraming.position);
      if (topDown)
        controls.object.position.set(
          defaultFraming.target[0],
          defaultFraming.position[1],
          defaultFraming.target[2] + 0.00001,
        );
      (controls.object as ThreeOrthographicCamera).zoom = defaultFraming.zoom;
      (controls.object as ThreeOrthographicCamera).updateProjectionMatrix();
      controls.update();
      controls.enableDamping = true;
      save();
    };
    viewActions.current = { topDown: () => apply(true), reset: () => apply(false) };
    return () => {
      viewActions.current = null;
    };
  }, [viewActions, defaultFraming, interruptNavigation, save]);
  const overview = useEffectEvent(getOverviewPose);
  useEffect(() => {
    const controls = orbitRef.current;
    if (!locked || !controls) return;
    interruptRoomFlight.current?.();
    manual.current = false;
    controls.enableDamping = false;
    controls.update();
    const pose = overview();
    controls.target.copy(pose.target);
    controls.object.position.copy(pose.target).add(new Vector3().setFromSpherical(pose.offset));
    (controls.object as ThreeOrthographicCamera).zoom = pose.zoom;
    (controls.object as ThreeOrthographicCamera).updateProjectionMatrix();
    controls.update();
    controls.enableDamping = true;
  }, [locked]);
  const previousViewport = useRef({ width, height });
  useEffect(() => {
    const previous = previousViewport.current;
    previousViewport.current = { width, height };
    const controls = orbitRef.current;
    if (!controls || (previous.width === width && previous.height === height)) return;
    const camera = controls.object as ThreeOrthographicCamera;
    const source = remembered.current ?? framing;
    const scale =
      fitSavedOrbitView(source, width, height).zoom /
      fitSavedOrbitView(source, previous.width, previous.height).zoom;
    camera.zoom = Math.max(minZoom, Math.min(MAX_ORTHOGRAPHIC_ZOOM, camera.zoom * scale));
    camera.updateProjectionMatrix();
    const wasManual = manual.current;
    manual.current = false;
    controls.update();
    manual.current = wasManual;
  }, [width, height, framing, minZoom]);
  const defaultPose = useMemo(() => {
    const target = new Vector3(...defaultFraming.target);
    return {
      target,
      offset: new Spherical().setFromVector3(new Vector3(...defaultFraming.position).sub(target)),
      zoom: defaultFraming.zoom,
    };
  }, [defaultFraming]);
  const aimInitialCamera = useCallback(
    (camera: ThreeOrthographicCamera | null) => {
      camera?.lookAt(...framing.target);
    },
    [framing],
  );
  return (
    <group>
      <OrthographicCamera
        ref={aimInitialCamera}
        makeDefault
        position={framing.position}
        zoom={framing.zoom}
        near={0.1}
        far={Math.max(150, minDistance * 5)}
      />
      <OrbitDoubleTapZoom controls={orbitRef} />
      <MapControls
        ref={attachControls}
        enabled={!locked}
        onChange={save}
        onStart={interruptNavigation}
        makeDefault
        target={framing.target}
        enablePan
        enableRotate
        enableZoom
        enableDamping
        dampingFactor={0.24}
        panSpeed={1.2}
        rotateSpeed={0.95}
        zoomSpeed={1.1}
        minPolarAngle={0}
        maxPolarAngle={1.28}
        minDistance={minDistance}
        minZoom={minZoom}
        maxZoom={MAX_ORTHOGRAPHIC_ZOOM}
        zoomToCursor
      />
      <RoomCameraTransition
        controls={orbitRef}
        interruptRef={interruptRoomFlight}
        defaultPose={defaultPose}
        preserveInitialView={framing.restored ?? false}
        getOverviewPose={getOverviewPose}
        onAutomaticMove={automaticNavigation}
        enabled={!showRoof && !locked}
        floor={floor}
        room={room}
        elevation={elevation}
        frame={roomFrame}
        requestKey={roomRequestKey}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
