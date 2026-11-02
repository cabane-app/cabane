import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import type { Object3D } from "three";
import {
  ImportedModelSurface,
  importedLightSources,
  type CustomModelNormalization,
  type CustomModel,
  type EntityStateSnapshot,
} from "@cabane/engine";

const previewState: EntityStateSnapshot = {
  entityId: "light.preview",
  state: "on",
  attributes: {},
  available: true,
  stale: false,
};

export function ModelImportPreview({
  root,
  normalization,
  light,
}: {
  root: Object3D;
  normalization: CustomModelNormalization;
  light: CustomModel["light"];
}) {
  const span = Math.max(...normalization.size);
  const center = useMemo(
    () =>
      normalization.bounds.min.map((n, i) => -(n + normalization.bounds.max[i]) / 2) as [
        number,
        number,
        number,
      ],
    [normalization],
  );
  return (
    <div className="model-import-preview" aria-label="3D model preview">
      <Canvas
        frameloop="demand"
        camera={{
          fov: 40,
          position: [span * 1.8, span * 1.4, span * 2],
          near: Math.max(0.001, span / 1000),
          far: Math.max(100, span * 20),
        }}
      >
        <ambientLight intensity={0.8} />
        <hemisphereLight args={["#f4f5ff", "#7a7166", 2]} />
        <directionalLight position={[4, 6, 5]} intensity={3} />
        <Bounds fit clip observe margin={1.4}>
          <group position={center}>
            <group position={normalization.offset}>
              <group rotation={normalization.rotation} scale={normalization.scale}>
                <ImportedModelSurface root={root} light={light} state={previewState} />
              </group>
            </group>
            {light &&
              importedLightSources(light).map((source, index) => (
                <group key={index} position={source.position}>
                  <mesh>
                    <sphereGeometry args={[Math.max(0.015, span * 0.025), 12, 8]} />
                    <meshBasicMaterial color={source.color} />
                  </mesh>
                  <pointLight
                    color={source.color}
                    intensity={source.maxIntensity}
                    distance={source.distance}
                  />
                </group>
              ))}
          </group>
        </Bounds>
        <OrbitControls makeDefault enablePan={false} />
      </Canvas>
    </div>
  );
}
