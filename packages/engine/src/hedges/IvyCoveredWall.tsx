import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ToonMaterial } from "../rendering";
import { useNativeHedgeMap } from "../scanned-finishes";
import { ivyGrowth, type IvyBlade } from "./ivy-growth";
import { ivyLeaf } from "./ivy-leaf";

function ivyBacking(length: number, height: number, halfDepth: number) {
  const cap = Math.min(0.055, height * 0.12);
  const bodyHeight = height - cap;
  const wall = new BoxGeometry(
    length,
    bodyHeight,
    halfDepth * 2,
    Math.min(72, Math.ceil(length / 0.35)),
    4,
    1,
  );
  wall.translate(0, bodyHeight / 2, 0);
  const plaster = new Color("#b9b19a");
  const color: number[] = [];
  const position = wall.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i);
    const tone =
      0.84 +
      (0.14 * y) / bodyHeight +
      0.022 * Math.sin(x * 2.4 + y * 2.8) +
      0.016 * Math.sin(x * 5.6 - y * 1.3);
    color.push(plaster.r * tone, plaster.g * tone, plaster.b * tone);
  }
  wall.setAttribute("color", new Float32BufferAttribute(color, 3));
  const parts = [wall];
  const count = Math.max(1, Math.min(80, Math.round(length / 0.61)));
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const stone = new BoxGeometry(step - Math.min(0.006, step * 0.02), cap, halfDepth * 2.2);
    stone.translate(-length / 2 + (i + 0.5) * step, height - cap / 2, 0);
    const shade = new Color("#aea38b").multiplyScalar(0.97 + 0.04 * Math.sin(i * 2.1));
    const tint: number[] = [];
    for (let j = 0; j < stone.attributes.position.count; j++) tint.push(shade.r, shade.g, shade.b);
    stone.setAttribute("color", new Float32BufferAttribute(tint, 3));
    parts.push(stone);
  }
  const backing = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return backing;
}

function IvyLeaves({ blades, young }: { blades: IvyBlade[]; young: boolean }) {
  const map = useNativeHedgeMap("ivy");
  const mapped = Boolean(map);
  const leaf = useMemo(() => ivyLeaf(young, mapped), [young, mapped]);
  const instances = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = instances.current;
    if (!mesh) return;
    for (const [i, blade] of blades.entries()) {
      mesh.setMatrixAt(i, blade.matrix);
      mesh.setColorAt(i, blade.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blades]);
  // Keep terrain-adjusted matrices when the atlas replaces the solid foliage.
  useLayoutEffect(() => {
    instances.current?.computeBoundingBox();
    instances.current?.computeBoundingSphere();
  }, [blades, leaf]);
  useEffect(() => () => leaf.dispose(), [leaf]);
  return (
    <instancedMesh
      name={young ? "young-ivy-leaves" : "climbing-ivy-leaves"}
      userData={{ thumbnailPending: map === null }}
      ref={instances}
      args={[undefined, undefined, blades.length]}
      geometry={leaf}
      castShadow
      receiveShadow
    >
      <ToonMaterial
        key={mapped ? "atlas" : "solid"}
        side={DoubleSide}
        map={map ?? null}
        alphaTest={mapped ? 0.43 : 0}
      />
    </instancedMesh>
  );
}

export function IvyCoveredWall({
  length,
  height,
  width,
}: {
  length: number;
  height: number;
  width: number;
}) {
  const growth = useMemo(() => ivyGrowth(length, height, width), [length, height, width]);
  const backing = useMemo(
    () => ivyBacking(length, growth.wallHeight, growth.wallSide),
    [length, growth.wallHeight, growth.wallSide],
  );
  useEffect(() => () => backing.dispose(), [backing]);
  useEffect(() => () => growth.stems.dispose(), [growth]);
  return (
    <group name="dense-ivy-covered-wall">
      <mesh name="ivy-wall-plaster" geometry={backing} castShadow receiveShadow>
        <ToonMaterial vertexColors />
      </mesh>
      <mesh name="climbing-ivy-stems" geometry={growth.stems} castShadow receiveShadow>
        <ToonMaterial vertexColors />
      </mesh>
      <IvyLeaves blades={growth.leaves} young={false} />
      <IvyLeaves blades={growth.tips} young />
    </group>
  );
}
