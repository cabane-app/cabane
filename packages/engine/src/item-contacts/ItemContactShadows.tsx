import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { BufferGeometry, DataTexture, Mesh, Object3D, ShaderMaterial } from "three";
import { contactFragment, contactVertex } from "./contact-shader";
import type { FloorSpec } from "../types";
import type { SceneItemSpec } from "../home-project/types";
import { observeSceneWalkColliders } from "../navigation/scene-walk-colliders";
import { useTerrainSurface } from "../terrain/TerrainSurface";
import type { packItemContacts } from "./contact-geometry";
import { FloorContactBake } from "./floor-contact-bake";

type ContactUniforms = { outlines: { value: DataTexture | null } };

export function ItemContactShadows({
  floor,
  items,
}: {
  floor: FloorSpec;
  items: readonly SceneItemSpec[];
}) {
  const meshRef =
    useRef<Mesh<BufferGeometry, ShaderMaterial & { uniforms: ContactUniforms }>>(null);
  const uniforms = useMemo<ContactUniforms>(() => ({ outlines: { value: null } }), []);
  const job = useRef<ReturnType<FloorContactBake["update"]> | null>(null);
  const active = useRef<ReturnType<typeof packItemContacts> | null>(null);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const terrain = useTerrainSurface();
  const cache = useRef<{
    root: Object3D;
    floor: FloorSpec;
    terrain: typeof terrain;
    bake: FloorContactBake;
  } | null>(null);
  const layout = useMemo(
    () =>
      new Map(
        items.map(({ id, kind, modelId, size, placement, variant, color }) => [
          id,
          JSON.stringify([kind, modelId, size, placement, variant, color]),
        ]),
      ),
    [items],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const empty = mesh.geometry;
    return () => {
      job.current = null;
      cache.current = null;
      mesh.geometry = empty;
      mesh.material.uniforms.outlines.value = null;
      mesh.visible = false;
      active.current?.geometry.dispose();
      active.current?.texture.dispose();
      active.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const root = meshRef.current?.parent;
    if (!root) return;
    const schedule = (reset: boolean) => {
      if (
        reset ||
        cache.current?.root !== root ||
        cache.current.floor !== floor ||
        cache.current.terrain !== terrain
      )
        cache.current = { root, floor, terrain, bake: new FloorContactBake(root) };
      job.current = cache.current.bake.update(layout);
      invalidate();
    };
    schedule(false);
    // Imported geometry or its saved pose can change after the item is placed.
    return observeSceneWalkColliders(scene, () => schedule(true));
  }, [scene, invalidate, floor, layout, terrain]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!job.current || !mesh) return;
    const deadline = performance.now() + 3;
    do {
      const part = job.current.next();
      if (part.done) {
        job.current = null;
        if (part.value) {
          const previous = active.current;
          active.current = part.value;
          mesh.geometry = part.value.geometry;
          mesh.material.uniforms.outlines.value = part.value.texture;
          mesh.visible = part.value.geometry.getAttribute("position").count > 0;
          previous?.geometry.dispose();
          previous?.texture.dispose();
        }
        return;
      }
    } while (performance.now() < deadline);
    invalidate();
  });
  return (
    <mesh ref={meshRef} name="item-contact-shadows" visible={false} raycast={() => {}}>
      <bufferGeometry userData={{ preservePlanarFaces: true }}>
        <float32BufferAttribute attach="attributes-position" args={[[], 3]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={contactVertex}
        fragmentShader={contactFragment}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
        toneMapped={false}
      />
    </mesh>
  );
}
