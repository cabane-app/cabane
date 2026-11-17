import { omitUndefinedProperties } from "../../defined-properties";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import type { ThreeElements } from "@react-three/fiber";
import { ArchitecturalMaterial } from "../../architecture-scene/ArchitecturalMaterial";
import { useScannedFinish } from "../../scanned-finishes";
import { treadUV, type TreadFinish } from "./tread-uv";
import { setTreadContactUVs, type TreadContact } from "./tread-contact";
import { ToonMaterial } from "../../rendering";
import type { PlanPoint } from "../../types";

export const OPEN_TREAD_THICKNESS = 0.12;

export function treadSlabGeometry(
  points: readonly PlanPoint[],
  baseY: number,
  thickness: number,
  finish: TreadFinish | false,
  contact?: TreadContact,
) {
  const shape = new Shape();
  points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    ...(finish ? { UVGenerator: treadUV(points, finish, baseY) } : {}),
  });
  if (contact) setTreadContactUVs(geometry, baseY, contact);
  return geometry;
}

type SurfaceMaterialProps = {
  color?: string;
  emissive?: string | undefined;
  finish?: TreadFinish | false;
  contact?: TreadContact | undefined;
};
export function StairSurfaceMaterial({
  color = "#cbb99a",
  finish = "light-oak",
  emissive,
  contact,
}: SurfaceMaterialProps) {
  const scan = useScannedFinish(finish && !emissive ? finish : undefined);
  return finish && !emissive ? (
    <ArchitecturalMaterial
      key={`${scan ? "scanned" : "solid"}-${contact ? "contact" : "flat"}`}
      aoMap={contact?.map ?? null}
      {...(scan ? { map: scan } : {})}
      color={scan && finish !== "painted-plaster" ? "#ffffff" : color}
      roughness={finish === "light-oak" ? 0.45 : finish === "limestone" ? 0.73 : 0.93}
    />
  ) : (
    <ToonMaterial
      color={emissive ? "#000000" : color}
      {...omitUndefinedProperties({ emissive })}
      emissiveIntensity={emissive ? 1 : 0}
      toneMapped={!emissive}
    />
  );
}

/** Horizontal polygon slab; points are world X/Z metres. */
export function StairPolygonSurface({
  polygon,
  elevation,
  thickness = OPEN_TREAD_THICKNESS,
  color = "#cbb99a",
  emissive,
  finish = "light-oak",
  contact,
  ...props
}: SurfaceMaterialProps & {
  polygon: readonly PlanPoint[];
  elevation: number;
  thickness?: number;
} & Omit<ThreeElements["mesh"], "position" | "rotation">) {
  const polygonKey = JSON.stringify(polygon);
  const baseY = elevation - thickness;
  const geometry = useMemo(
    () =>
      treadSlabGeometry(
        JSON.parse(polygonKey) as typeof polygon,
        baseY,
        thickness,
        emissive ? false : finish,
        contact,
      ),
    [polygonKey, baseY, thickness, finish, emissive, contact],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      {...props}
      geometry={geometry}
      position={[0, baseY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <StairSurfaceMaterial color={color} emissive={emissive} finish={finish} contact={contact} />
    </mesh>
  );
}
