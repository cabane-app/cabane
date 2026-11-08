import { memo, useEffect, useMemo } from "react";
import { DoubleSide, FrontSide } from "three";
import { ToonMaterial } from "../../rendering";
import { useTerrainSurface } from "../../terrain/TerrainSurface";
import { countrysideLayout } from "./landscape-layout";
import { createCountrysideGeometry } from "./landscape-geometry";

/** Temporary, always-on Campagne art direction. No persisted project setting. */
export const CountrysideDiorama = memo(function CountrysideDiorama({
  centerX,
  centerZ,
  width,
  depth,
  color,
}: {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  color: string;
}) {
  const terrain = useTerrainSurface();
  const geometry = useMemo(
    () =>
      createCountrysideGeometry(countrysideLayout(width, depth, terrain, centerX, centerZ), color),
    [width, depth, terrain, centerX, centerZ, color],
  );
  useEffect(() => () => Object.values(geometry).forEach((part) => part.dispose()), [geometry]);
  return (
    <group name="campagne-diorama" position={[centerX, 0, centerZ]}>
      <mesh
        name="campagne-contact-shadow"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.94 - Math.max(width, depth) * 0.0025, 0]}
        receiveShadow
        raycast={() => {}}
      >
        <planeGeometry args={[width + 50, depth + 50]} />
        <shadowMaterial transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {Object.entries(geometry).map(([name, part]) => (
        <mesh
          key={name}
          name={`campagne-${name}`}
          geometry={part}
          castShadow={name !== "water" && name !== "meadow"}
          receiveShadow
          raycast={() => {}}
        >
          <ToonMaterial vertexColors side={name === "meadow" ? DoubleSide : FrontSide} />
        </mesh>
      ))}
    </group>
  );
});
