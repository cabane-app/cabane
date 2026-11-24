import { useSyncExternalStore } from "react";
import { ClampToEdgeWrapping, NoColorSpace, SRGBColorSpace, type Texture } from "three";
import { scan } from "../scanned-finishes";
import daySkyUrl from "./assets/day-sky.webp?url";
import grassUrl from "./assets/lawn-detail.webp?url";
import stoneNormalUrl from "./assets/mossy-stone-normal.webp?url";
import stoneUrl from "./assets/mossy-stone.webp?url";
import nightSkyUrl from "./assets/night-sky.webp?url";
import heightsUrl from "./assets/pasture-heights.png?url";
import duffNormalUrl from "./assets/understory-ground-normal.webp?url";
import duffUrl from "./assets/understory-ground.webp?url";

const clampSky = (texture: Texture) => {
  texture.wrapT = ClampToEdgeWrapping;
};

export const planetScans = {
  daySky: scan(daySkyUrl, 1, SRGBColorSpace, clampSky),
  nightSky: scan(nightSkyUrl, 1, SRGBColorSpace, clampSky),
  heights: scan(heightsUrl, 1, NoColorSpace, (texture) => {
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  }),
  grass: scan(grassUrl, 1, NoColorSpace),
  stone: scan(stoneUrl),
  stoneNormal: scan(stoneNormalUrl, 1, NoColorSpace),
  duff: scan(duffUrl),
  duffNormal: scan(duffNormalUrl, 1, NoColorSpace),
};

const scans = Object.values(planetScans);
const subscribe = (notify: () => void) => {
  const releases = scans.map((source) => source.subscribe(notify));
  return () => releases.forEach((release) => release());
};
// A failed scan settles to undefined and the landscape uses its fallback.
const settled = () => scans.every((source) => source.snapshot() !== null);

export function usePlanetScansReady() {
  return useSyncExternalStore(subscribe, settled, () => false);
}
