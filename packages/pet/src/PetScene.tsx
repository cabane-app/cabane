import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  AnimationMixer,
  Group,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type AnimationAction,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SceneFeatureProps } from "@cabane/engine";
import type { PetModel } from "./model";
import { createLookAhead } from "./look-ahead";
import { walkPlaybackRate } from "./gait";
import { usePetNavigation } from "./usePetNavigation";

function disposeModel(scene: Group) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material))
        if (value && typeof value === "object" && "isTexture" in value && "dispose" in value)
          (value as { dispose: () => void }).dispose();
      material.dispose();
    }
  });
}

export default function PetScene(props: SceneFeatureProps & { model: PetModel }) {
  const { model, floor, elevation, enabled, reducedMotion } = props;
  const roaming = usePetNavigation(props, model);
  const group = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const [asset, setAsset] = useState<{
    scene: Group;
    mixer: AnimationMixer;
    look: ReturnType<typeof createLookAhead>;
    walk?: AnimationAction;
    idle?: AnimationAction;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const moving = useRef(false);
  const direction = useRef(new Vector3());
  useEffect(() => {
    let disposed = false;
    let release = () => {};
    setAsset(null);
    setFailed(false);
    new GLTFLoader().load(
      model.url,
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }
        gltf.scene.traverse((object) => {
          if (object instanceof Mesh) {
            object.castShadow = true;
            object.frustumCulled = false;
            object.raycast = () => {};
          }
        });
        const mixer = new AnimationMixer(gltf.scene);
        const walkClip = gltf.animations.find((clip) => clip.name === model.walkClip);
        const idleClip = gltf.animations.find((clip) => clip.name === model.idleClip);
        const walk = walkClip ? mixer.clipAction(walkClip) : undefined;
        const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
        idle?.play();
        moving.current = false;
        setAsset({
          scene: gltf.scene,
          mixer,
          look: createLookAhead(gltf.scene, model.head),
          ...(walk ? { walk } : {}),
          ...(idle ? { idle } : {}),
        });
        release = () => {
          mixer.stopAllAction();
          mixer.uncacheRoot(gltf.scene);
          disposeModel(gltf.scene);
        };
        invalidate();
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      },
    );
    return () => {
      disposed = true;
      release();
    };
  }, [model, invalidate]);
  useEffect(() => {
    invalidate();
  }, [enabled, reducedMotion, roaming, invalidate]);
  useFrame(({ camera }, delta) => {
    if (!group.current || !roaming || !asset) return;
    if (enabled && !reducedMotion) {
      camera.getWorldDirection(direction.current);
      direction.current.y = 0;
      direction.current.normalize();
      roaming.step(
        Math.min(delta, 0.05),
        props.view === "walk"
          ? {
              x: camera.position.x + direction.current.x * 2.4,
              z: camera.position.z + direction.current.z * 2.4,
            }
          : undefined,
      );
    }
    const point = roaming.position;
    group.current.visible = !!point;
    if (!point) return;
    group.current.position.set(point.x, elevation, point.z);
    group.current.rotation.y = roaming.yaw;
    const nextMoving = enabled && !reducedMotion && roaming.moving;
    if (nextMoving !== moving.current) {
      const next = nextMoving ? asset.walk : asset.idle;
      const previous = moving.current ? asset.walk : asset.idle;
      previous?.fadeOut(0.2);
      next?.reset().fadeIn(0.2).play();
      moving.current = nextMoving;
    }
    asset.look?.restore();
    if (enabled && !reducedMotion) {
      asset.walk?.setEffectiveTimeScale(
        walkPlaybackRate(
          roaming.actualSpeed,
          asset.walk.getClip().duration,
          model.strideLength,
          model.scale ?? 1,
        ),
      );
      asset.mixer.update(Math.min(delta, 0.05));
      invalidate();
    }
    asset.look?.update(group.current);
  });
  if (failed)
    return (
      <Html center>
        <span role="status">Pet model unavailable</span>
      </Html>
    );
  return (
    <group
      ref={group}
      key={floor.id}
      visible={false}
      scale={model.scale ?? 1}
      userData={{ walkToolVisual: true }}
      raycast={() => null}
    >
      {asset && <primitive object={asset.scene} />}
    </group>
  );
}
