import { useMemo } from "react";
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
