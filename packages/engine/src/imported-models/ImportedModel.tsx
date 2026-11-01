import { useModelLightingState } from "../model-lighting/ModelLightingSurface";
import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Object3D } from "three";
import { ToonMaterial } from "../rendering";
import { acquireGlb, disposeGlbSkeletons } from "./glb-resources";
import type { CustomModel, ModelVector } from "./contracts";
import type { EntityStateSnapshot } from "../types";
import { ImportedModelSurface } from "./ImportedModelSurface";

export function ImportedModelGeometry({
  model,
  size = model.normalization.size,
  state,
}: {
  model: CustomModel;
  size?: ModelVector;
  state?: EntityStateSnapshot | undefined;
}) {
  const lightingContext = useModelLightingState();
  const lightState = lightingContext ? lightingContext.state : state;
  const invalidate = useThree((state) => state.invalidate);
  const [loaded, setLoaded] = useState<{ root?: Object3D; error?: string }>({});
  const hash = model.asset.sha256,
    byteLength = model.asset.byteLength;
  useEffect(() => {
    let active = true;
    let instance: Object3D | undefined;
    setLoaded({});
    const lease = acquireGlb({ sha256: hash, byteLength });
    void lease.pending.then(
      ({ root }) => {
        if (active) {
          instance = clone(root);
          setLoaded({ root: instance });
          invalidate();
        }
      },
      (error: unknown) => {
        if (active) {
          setLoaded({ error: error instanceof Error ? error.message : "Unable to load GLB." });
          invalidate();
        }
      },
    );
    return () => {
      active = false;
      if (instance) disposeGlbSkeletons(instance);
      lease.release();
    };
  }, [hash, byteLength, invalidate]);
  const { normalization } = model;
  const uniformScale = size[0] / normalization.size[0];
  const center = useMemo(
    () =>
      normalization.bounds.min.map((n, axis) => (n + normalization.bounds.max[axis]) / 2) as [
        number,
        number,
        number,
      ],
    [normalization],
  );
  return (
    <group
      scale={uniformScale}
      userData={{
        importedModelId: model.id,
        ...(loaded.error ? { modelAssetError: loaded.error } : {}),
      }}
    >
      {loaded.root ? (
        <group position={normalization.offset}>
          <group rotation={normalization.rotation} scale={normalization.scale}>
            <ImportedModelSurface root={loaded.root} light={model.light} state={lightState} />
          </group>
        </group>
      ) : (
        <mesh
          name={loaded.error ? "missing-imported-model" : "loading-imported-model"}
          position={center}
        >
          <boxGeometry args={normalization.size} />
          <ToonMaterial color={loaded.error ? "#da8d59" : "#94a5ae"} wireframe />
        </mesh>
      )}
      {model.placement === "floor" && (
        <mesh visible={false} position={center}>
          <boxGeometry args={normalization.size} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
