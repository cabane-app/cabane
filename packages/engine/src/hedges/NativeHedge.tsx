import type { BoundaryDimensions } from "../boundaries/BoundaryBeam";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Box3, Color, DoubleSide, InstancedMesh, Matrix4, Vector3 } from "three";
import { ToonMaterial } from "../rendering";
import { useNativeHedgeMap } from "../scanned-finishes";
import { hedgeSprigGeometry, type Shoot } from "./hedge-sprig";
import {
  buildNativeHedgeCanopy,
  canopyPoint,
  nativeHedges,
  oleanderAt,
  type NativeHedgeStyle,
} from "./native-hedge-canopy";

const shoots: Record<NativeHedgeStyle, readonly Shoot[]> = {
  rounded: ["privet"],
  bushy: ["hazel"],
  mixed: ["laurel", "oleander", "blossom"],
};
interface Planting {
  root: Vector3;
  angle: number;
  roll: number;
  pitch: number;
  size: number;
  tone: number;
}

function planShoots(style: NativeHedgeStyle, size: BoundaryDimensions) {
  const plant = nativeHedges[style];
  const count = Math.max(
    5,
    Math.min(680, Math.round(size.length * (size.height + size.width) * plant.shoots)),
  );
  const placements: Record<Shoot, Planting[]> = {
    privet: [],
    hazel: [],
    laurel: [],
    oleander: [],
    blossom: [],
  };
  // Local random state makes resizing/reopening repeatable without touching
  // the editor or game RNG. The golden angle spreads tips over both faces.
  let seed = 91723513;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let branchX = 0,
    branchAngle = 0;
  const spread = Math.min(0.16, size.length * 0.12);
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      branchX = size.length * ((i + 0.3 + 0.7 * random()) / count - 0.5);
      branchAngle = ((((i / 2) * 0.618034 + random() * 0.12) % 1) - 0.5) * 5.25;
    }
    const x = Math.max(
      -size.length * 0.498,
      Math.min(size.length * 0.498, branchX + (random() - 0.5) * spread),
    );
    const angle = branchAngle + (random() - 0.5) * 0.39;
    const root = canopyPoint(style, size, x, angle, new Vector3());
    const inset = Math.min(plant.shootLength * 0.19, size.width * 0.055, size.height * 0.042);
    root.y -= Math.cos(angle) * inset;
    root.z -= Math.sin(angle) * inset;
    const species =
      style === "mixed"
        ? oleanderAt(x)
          ? "oleander"
          : "laurel"
        : style === "rounded"
          ? "privet"
          : "hazel";
    const growth = {
      root,
      angle,
      roll: Math.sin(x * 5.2 + angle) * 0.69 + (random() - 0.5) * 2.65,
      pitch: (style === "rounded" ? 0.19 : 0.3) + random() * 0.46,
      size:
        Math.min(plant.shootLength, size.height * 0.24, size.width * 0.39) *
        (0.71 + 0.54 * random()),
      tone: 0.72 + random() * 0.4,
    };
    placements[species].push(growth);
    if (species === "oleander" && Math.abs(angle) < 1.42 && random() < 0.56) {
      placements.blossom.push({ ...growth, pitch: growth.pitch + 0.08, size: growth.size * 1.04 });
    }
  }
  return placements;
}

function LeafShoots({
  species,
  placements,
  dimensions,
}: {
  species: Shoot;
  placements: Planting[];
  dimensions: BoundaryDimensions;
}) {
  const geometry = useMemo(() => hedgeSprigGeometry(species), [species]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const orientation = new Matrix4(),
      turn = new Matrix4();
    const along = new Vector3(),
      up = new Vector3(),
      normal = new Vector3(),
      rgb = new Color();
    const transformed = new Box3();
    const { length, height, width } = dimensions;
    for (let i = 0; i < placements.length; i++) {
      const { root, angle, roll, pitch, size, tone } = placements[i];
      const side = Math.sin(angle) >= 0 ? 1 : -1;
      along.set(side, 0, 0);
      normal.set(0, Math.cos(angle), Math.sin(angle));
      up.crossVectors(normal, along);
      orientation
        .makeBasis(along, up, normal)
        .multiply(turn.makeRotationZ(roll))
        .multiply(turn.makeRotationX(pitch));
      // Keep every growing tip inside the authored Walk/selection envelope,
      // including a very short segment or a hedge restyled to fence width.
      transformed.copy(geometry.boundingBox!).applyMatrix4(orientation);
      const { min, max } = transformed;
      const scale = Math.min(
        size,
        (length / 2 - root.x) / Math.max(1e-8, max.x),
        (length / 2 + root.x) / Math.max(1e-8, -min.x),
        (height - root.y) / Math.max(1e-8, max.y),
        root.y / Math.max(1e-8, -min.y),
        (width / 2 - root.z) / Math.max(1e-8, max.z),
        (width / 2 + root.z) / Math.max(1e-8, -min.z),
      );
      orientation.multiply(turn.makeScale(scale, scale, scale)).setPosition(root);
      mesh.current.setMatrixAt(i, orientation);
      mesh.current.setColorAt(i, rgb.setRGB(tone, tone, tone));
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingBox();
    mesh.current.computeBoundingSphere();
  }, [dimensions, geometry, placements]);
  return (
    <instancedMesh
      name={`${species}-sprays`}
      ref={mesh}
      geometry={geometry}
      args={[undefined, undefined, placements.length]}
      castShadow
      receiveShadow
    >
      <ToonMaterial vertexColors side={DoubleSide} />
    </instancedMesh>
  );
}

export function NativeHedge({
  style,
  length,
  height,
  width,
}: BoundaryDimensions & { style: NativeHedgeStyle }) {
  const size = useMemo(() => ({ length, height, width }), [length, height, width]);
  const geometry = useMemo(() => buildNativeHedgeCanopy(style, size), [style, size]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const planting = useMemo(() => planShoots(style, size), [style, size]);
  const leaves = useNativeHedgeMap();
  return (
    <group name={`${style}-hedge`}>
      <mesh
        name="continuous-foliage"
        userData={{ thumbnailPending: leaves === null }}
        geometry={geometry}
        castShadow
        receiveShadow
      >
        <ToonMaterial
          key={leaves ? "mapped" : "solid"}
          color={leaves ? "#ffffff" : "#b9c1b1"}
          map={leaves ?? null}
          vertexColors
        />
      </mesh>
      {shoots[style].map(
        (species) =>
          planting[species].length > 0 && (
            <LeafShoots
              key={species}
              species={species}
              placements={planting[species]}
              dimensions={size}
            />
          ),
      )}
    </group>
  );
}
