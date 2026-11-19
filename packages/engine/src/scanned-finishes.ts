import { useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ClampToEdgeWrapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type ColorSpace,
  type Texture,
} from "three";
import grassUrl from "./assets/finishes/ground-cover.webp?url";
import boxwoodUrl from "./assets/finishes/boxwood.webp?url";
import nativeFoliageUrl from "./assets/finishes/native-foliage.webp?url";
import ivyLeavesUrl from "./hedges/ivy-leaves.webp?url";
import herringboneUrl from "./assets/finishes/herringbone.webp?url";
import gravelUrl from "./assets/finishes/gravel.webp?url";
import gravelNormalUrl from "./assets/finishes/gravel-normal.webp?url";
import limestoneUrl from "./assets/finishes/limestone.webp?url";
import joineryOakUrl from "./assets/finishes/joinery-oak.webp?url";
import oakUrl from "./assets/finishes/oak.webp?url";
import pineBarkUrl from "./assets/finishes/pine-bark.webp?url";
import pineBarkNormalUrl from "./assets/finishes/pine-bark-normal.webp?url";
import plasterUrl from "./assets/finishes/painted-plaster.webp?url";
import wallPaintUrl from "./assets/finishes/wall-paint.webp?url";
import travertineUrl from "./assets/finishes/travertine.webp?url";
import turfFringeMaskUrl from "./assets/finishes/turf-fringe-mask.webp?url";
import walnutUrl from "./assets/finishes/walnut.webp?url";
import { floorFinishPreset } from "./floor-finishes/presets";
import { useGraphicsFeature } from "./graphics-features";
import { SceneStyleContext } from "./scene-style";
import type { FloorPatternPresetId } from "./types";

const noTexture = () => undefined;
const emptyScan = { snapshot: noTexture, subscribe: () => () => {} };

// Each source is shared by all its rooms and floors. The final subscriber releases
// its GPU texture, including when the user closes a home during an image load.
function scan(
  url: string,
  repeat = 1,
  colorSpace: ColorSpace = SRGBColorSpace,
  configure?: (texture: Texture) => void,
) {
  const listeners = new Set<() => void>();
  let pending: Texture | null = null;
  // null draws the authored color while loading; undefined enables the procedural fallback.
  let ready: Texture | null | undefined = null;
  return {
    snapshot: () => ready,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!pending) {
        const request = new TextureLoader().load(
          url,
          (texture) => {
            if (texture !== pending) return;
            texture.colorSpace = colorSpace;
            texture.wrapS = texture.wrapT = RepeatWrapping;
            texture.repeat.setScalar(repeat);
            texture.anisotropy = 8;
            configure?.(texture);
            ready = texture;
            listeners.forEach((notify) => notify());
          },
          undefined,
          () => {
            if (request !== pending) return;
            ready = undefined;
            listeners.forEach((notify) => notify());
          },
        );
        pending = request;
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        pending?.dispose();
        pending = ready = null;
      };
    },
  };
}

const oak = scan(oakUrl);
const nativeFoliage = scan(nativeFoliageUrl);
const ivyLeaves = scan(ivyLeavesUrl);

/** Original greyscale leaf artwork is part of the hedge model in every scene style. */
export function useNativeHedgeMap(kind: "foliage" | "ivy" = "foliage") {
  const source =
    typeof Image !== "undefined" && typeof document !== "undefined"
      ? kind === "ivy"
        ? ivyLeaves
        : nativeFoliage
      : emptyScan;
  return useSyncExternalStore(source.subscribe, source.snapshot, noTexture);
}
const gravelRepeat = floorFinishPreset("gravel").repeatMeters / 2;
const barkRepeat = floorFinishPreset("pine-bark").repeatMeters / 2;
type ScanId =
  | FloorPatternPresetId
  | "painted-plaster"
  | "wall-paint"
  | "joinery-oak"
  | "ground-cover"
  | "boxwood"
  | "gravel-normal"
  | "pine-bark-normal";
const sources: Partial<Record<ScanId, ReturnType<typeof scan>>> = {
  "light-oak": oak,
  "light-oak-horizontal": oak,
  "dark-walnut": scan(walnutUrl),
  // Floor UVs use the plan preset's repeat; the photographs have a measured span.
  "oak-herringbone": scan(herringboneUrl, floorFinishPreset("oak-herringbone").repeatMeters / 3.4),
  limestone: scan(limestoneUrl, floorFinishPreset("limestone").repeatMeters / 1.5),
  gravel: scan(gravelUrl, gravelRepeat),
  "gravel-normal": scan(gravelNormalUrl, gravelRepeat, NoColorSpace),
  "pine-bark": scan(pineBarkUrl, barkRepeat),
  "pine-bark-normal": scan(pineBarkNormalUrl, barkRepeat, NoColorSpace),
  travertine: scan(travertineUrl),
  "painted-plaster": scan(plasterUrl),
  "wall-paint": scan(wallPaintUrl),
  "joinery-oak": scan(joineryOakUrl),
  "ground-cover": scan(grassUrl, 1 / 2.5),
  boxwood: scan(boxwoodUrl, 1 / 0.92),
};

export function useScannedFinish(
  id?: ScanId,
  group: "finishes" | "grounds" | "joinery" = "finishes",
) {
  const enabled = useGraphicsFeature(group);
  const style = useContext(SceneStyleContext);
  const source =
    (enabled &&
      style === "default" &&
      id &&
      typeof Image !== "undefined" &&
      typeof document !== "undefined" &&
      sources[id]) ||
    emptyScan;
  const texture = useSyncExternalStore(source.subscribe, source.snapshot, noTexture);
  // Rotated oak uses the same decoded image and WebGL texture source.
  const rotated = useMemo(() => {
    if (id !== "light-oak-horizontal" || !texture) return null;
    const copy = texture.clone();
    copy.rotation = Math.PI / 2;
    return copy;
  }, [id, texture]);
  useEffect(() => () => rotated?.dispose(), [rotated]);
  return rotated ?? texture;
}

// The image is a linear coverage mask. Albedo, contact and coverage each use their own UV set.
const turfFringeMask = scan(turfFringeMaskUrl, 1, NoColorSpace, (texture) => {
  texture.channel = 2;
  texture.wrapT = ClampToEdgeWrapping;
});

export function useTurfFringeMask(enabled: boolean) {
  const source = enabled && typeof Image !== "undefined" ? turfFringeMask : emptyScan;
  return useSyncExternalStore(source.subscribe, source.snapshot, noTexture);
}
