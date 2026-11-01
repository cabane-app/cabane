import { type ThreeEvent, useThree } from "@react-three/fiber";
import { Line, TransformControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Group, Quaternion, Vector3, type Mesh, type Material, type BufferGeometry } from "three";
import {
  controlModelLightMaterials,
  ModelLightingStateContext,
  importedLightSources,
  modelLightSources,
  modelLightingSurfaceAt,
  modelLightingSurfaces,
  type CustomModelLight,
  type DeviceModelBounds,
  type EntityStateSnapshot,
  type ModelLightingSurfaceOption,
  type ModelVector,
} from "@cabane/engine";
import { LightingCamera, type LightingView } from "./LightingCamera";
import { lightingModelHit } from "./lighting-picking";
import { lightingError, sourcePosition, type LightingSelection } from "./lighting-layout";

export type LightingSceneProps = {
  children: ReactNode;
  bounds: DeviceModelBounds;
  light: CustomModelLight | null;
  state: EntityStateSnapshot;
  selected: LightingSelection;
  picking: "position" | "surface" | null;
  onPosition: (position: ModelVector) => void;
  onRotateStrip: (start: ModelVector, end: ModelVector) => void;
  onSurface: (id: string, materialName: string) => void;
  onSurfaces: (surfaces: ModelLightingSurfaceOption[]) => void;
  onSelect: (selection: LightingSelection) => void;
  disabled: boolean;
};
export function LightingStageScene({
  children,
  bounds,
  light,
  state,
  selected,
  picking,
  onPosition,
  onRotateStrip,
  onSurface,
  onSurfaces,
  onSelect,
  disabled,
  throughGlass,
  markers,
  night,
  request,
  rotate,
}: LightingSceneProps & {
  rotate: boolean;
  throughGlass: boolean;
  markers: boolean;
  night: boolean;
  request: { view: LightingView; key: number };
}) {
  const geometry = useRef<Group>(null);
  const origin = useRef<Group>(null);
  const handle = useMemo(() => new Group(), []);
  const [hoveredSurface, setHoveredSurface] = useState<string>();
  const highlighted = picking === "surface" ? hoveredSurface : undefined;
  const invalidate = useThree((scene) => scene.invalidate);
  const span = Math.max(...bounds.max.map((n, i) => n - bounds.min[i]));
  useLayoutEffect(() => {
    if (!geometry.current) return;
    onSurfaces(modelLightingSurfaces(geometry.current));
    const materials = controlModelLightMaterials(geometry.current, light ?? {}, highlighted);
    materials.update(state, light?.color ?? "#ffe3b4");
    invalidate();
    return () => materials.dispose();
  }, [children, light, state, highlighted, invalidate, onSurfaces]);
  const hitFor = (event: ThreeEvent<MouseEvent>) =>
    geometry.current
      ? lightingModelHit(geometry.current, event.intersections, throughGlass)
      : undefined;
  const pick = (event: ThreeEvent<MouseEvent>) => {
    if (
      disabled ||
      !picking ||
      !geometry.current ||
      !origin.current ||
      event.delta > 4 ||
      event.button !== 0
    )
      return;
    const hit = hitFor(event);
    if (!hit) return;
    event.stopPropagation();
    if (picking === "surface") {
      const id = modelLightingSurfaceAt(geometry.current, hit.object, hit.face?.materialIndex ?? 0);
      if (!id) return;
      const mesh = hit.object as Mesh<BufferGeometry, Material | Material[]>;
      const material = Array.isArray(mesh.material)
        ? mesh.material[hit.face?.materialIndex ?? 0]
        : mesh.material;
      onSurface(id, material.name);
    } else {
      onPosition(
        origin.current
          .worldToLocal(hit.point.clone())
          .toArray()
          .map((n) => Number(n.toFixed(6))) as [number, number, number],
      );
    }
  };
  const center = bounds.min.map((n, i) => -(n + bounds.max[i]) / 2) as [number, number, number];
  const sources = light ? modelLightSources(light) : [];
  const active = sources[selected.index];
  const position = active ? sourcePosition(active, selected.end) : ([0, 0, 0] as const);
  const rotating = rotate && active?.kind === "strip";
  const pivot = rotating
    ? (active.start.map((n, i) => (n + active.end[i]) / 2) as [number, number, number])
    : position;
  const orientation = rotating
    ? new Quaternion().setFromUnitVectors(
        new Vector3(1, 0, 0),
        new Vector3(...active.end).sub(new Vector3(...active.start)).normalize(),
      )
    : new Quaternion();
  const emitters = light && !lightingError(light) ? importedLightSources(light) : [];
  const radius = Math.max(0.006, span * 0.012);
  return (
    <>
      <ambientLight intensity={night ? 0.04 : 0.45} />
      <hemisphereLight args={["#f4f5ff", "#7a7166", night ? 0.12 : 1.3]} />
      <directionalLight position={[4, 6, 5]} intensity={night ? 0.12 : 2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, center[1] + bounds.min[1] - 0.005, 0]}>
        <planeGeometry args={[span * 3, span * 3]} />
        <meshStandardMaterial color={night ? "#706a5e" : "#dcd7ca"} roughness={1} />
      </mesh>
      <group position={center} ref={origin}>
        <group
          ref={geometry}
          onClick={pick}
          onPointerMove={(event) => {
            if (picking !== "surface" || !geometry.current || disabled) return;
            const hit = hitFor(event);
            setHoveredSurface(
              hit
                ? modelLightingSurfaceAt(geometry.current, hit.object, hit.face?.materialIndex ?? 0)
                : undefined,
            );
          }}
          onPointerLeave={() => setHoveredSurface(undefined)}
        >
          <ModelLightingStateContext.Provider value={{ state }}>
            {children}
          </ModelLightingStateContext.Provider>
        </group>
        {emitters.map((source, index) => (
          <pointLight
            key={index}
            position={source.position}
            color={source.color}
            intensity={
              state.state === "on"
                ? (source.maxIntensity * Number(state.attributes.brightness ?? 255)) / 255
                : 0
            }
            distance={source.distance}
          />
        ))}
        {markers &&
          sources.map((source, index) => (
            <group key={index}>
              {source.kind === "strip" && (
                <Line
                  points={[source.start, source.end]}
                  color={selected.index === index ? "#28744f" : "#94613b"}
                  lineWidth={3}
                  depthTest={false}
                />
              )}
              {(source.kind === "point" ? [source.position] : [source.start, source.end]).map(
                (point, endpoint) => (
                  <mesh
                    key={endpoint}
                    position={point}
                    renderOrder={10000}
                    onClick={(event) => {
                      if (disabled || picking === "surface" || event.delta > 4) return;
                      event.stopPropagation();
                      onSelect({ index, ...(endpoint ? { end: true } : {}) });
                    }}
                  >
                    <sphereGeometry
                      args={[
                        radius *
                          (selected.index === index && !!selected.end === !!endpoint ? 1.35 : 1),
                        16,
                        10,
                      ]}
                    />
                    <meshBasicMaterial
                      color={selected.index === index ? "#28744f" : "#94613b"}
                      depthTest={false}
                      depthWrite={false}
                    />
                  </mesh>
                ),
              )}
            </group>
          ))}
        {active && markers && picking !== "surface" && !disabled && (
          <primitive object={handle} position={pivot} quaternion={orientation} />
        )}
      </group>
      {active && markers && picking !== "surface" && !disabled && (
        <TransformControls
          object={handle}
          mode={rotating ? "rotate" : "translate"}
          size={0.8}
          onObjectChange={() => {
            if (rotating) {
              const half = new Vector3(1, 0, 0)
                .applyQuaternion(handle.quaternion)
                .multiplyScalar(
                  new Vector3(...active.end).distanceTo(new Vector3(...active.start)) / 2,
                );
              onRotateStrip(
                handle.position.clone().sub(half).toArray(),
                handle.position.clone().add(half).toArray(),
              );
            } else
              onPosition(
                handle.position.toArray().map((n) => Number(n.toFixed(6))) as [
                  number,
                  number,
                  number,
                ],
              );
          }}
        />
      )}
      <LightingCamera
        span={span}
        request={request}
        focus={position.map((n, i) => n + center[i]) as [number, number, number]}
      />
    </>
  );
}
