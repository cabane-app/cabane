import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import type { HomeManifest } from "../types";
import { ToonMaterial } from "../rendering";
import { buildRoofGeometries } from "./roof-geometry";
import { DEFAULT_ROOF_SETTINGS } from "./roof-settings";

export function BuildingRoof({ manifest }: { manifest: HomeManifest }) {
  const settings = manifest.home.roof ?? DEFAULT_ROOF_SETTINGS;
  const geometry = useMemo(
    () =>
      buildRoofGeometries(
        manifest.floors.filter((floor) => !floor.belowGround),
        settings,
        manifest.home.palette.exterior,
        manifest.home.palette.interior,
      ),
    // Roof color is applied to materials separately; only direction affects its geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      manifest.floors,
      settings.direction,
      manifest.home.palette.exterior,
      manifest.home.palette.interior,
    ],
  );
  useEffect(
    () => () => {
      geometry.top.dispose();
      geometry.edges.dispose();
      geometry.infill.dispose();
    },
    [geometry],
  );
  return (
    <group name="building-roof">
      <mesh name="roof-slopes" geometry={geometry.top} castShadow receiveShadow>
        <ToonMaterial color={settings.color} side={DoubleSide} />
      </mesh>
      <mesh name="roof-edges" geometry={geometry.edges} castShadow receiveShadow>
        <ToonMaterial color={settings.edgeColor} side={DoubleSide} />
      </mesh>
      <mesh name="roof-wall-infill" geometry={geometry.infill} castShadow>
        <ToonMaterial color="white" vertexColors side={DoubleSide} />
      </mesh>
    </group>
  );
}
