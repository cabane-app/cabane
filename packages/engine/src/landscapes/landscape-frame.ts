import { useMemo } from "react";
import type { OrthographicCamera, Scene, Sphere } from "three";
import { homeGroundFrame } from "../architecture-scene/diorama-frame";
import type { DeviceModelRegistry, HomeManifest } from "../types";

export function planetDimensions(lot: { width: number; depth: number }) {
  const flat = 1 + Math.hypot(lot.width, lot.depth) / 2;
  const radius = Math.max(32, 2.85 * flat);
  // Set sea level tangent to the middle of the shorter garden edge.
  const edge = Math.min(lot.width, lot.depth) / 2;
  const centerDepth = Math.sqrt(radius * radius - edge * edge);
  return { flat, radius, centerDepth };
}

export function useCountryPlanetRadius(
  enabled: boolean,
  manifest: HomeManifest,
  devices: DeviceModelRegistry,
) {
  return useMemo(() => {
    const lot = enabled && homeGroundFrame(manifest, devices, "walk");
    return lot ? planetDimensions(lot).radius : 0;
  }, [enabled, manifest, devices]);
}

// The terrain may load after the controls. Each canvas owns its measured world bounds.
export const countryOrbitBounds = new WeakMap<Scene, Sphere>();
export const completePlanetScenes = new WeakSet<Scene>();

export function fitOrbitDepth(
  camera: OrthographicCamera,
  bounds: Sphere | undefined,
  homeFar: number,
) {
  let near = 0.1;
  let far = homeFar;
  if (bounds) {
    camera.updateWorldMatrix(true, false);
    const view = camera.matrixWorldInverse.elements;
    const { x, y, z } = bounds.center;
    const depth = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
    // Orthographic rays are parallel. Their clipping interval can extend behind the
    // control position without moving the house pivot or changing screen coordinates.
    near = Math.min(near, depth - bounds.radius);
    far = Math.max(far, depth + bounds.radius);
  }
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}
