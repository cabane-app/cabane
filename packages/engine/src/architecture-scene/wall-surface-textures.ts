import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { paintFloorPattern } from "../floor-finishes/presets";
import type { WallSurfaceFinish } from "../types";

type Surface = { finish?: WallSurfaceFinish | undefined };
type Entry = { texture: CanvasTexture | null; image?: HTMLImageElement; active: boolean };
const keyFor = (finish: WallSurfaceFinish) =>
  finish.pattern === "custom-image" ? finish.image.dataUrl : `${finish.pattern}:${finish.color}`;

function createWallSurfaceTextures(notify: () => void) {
  const entries = new Map<string, Entry>();
  const release = (entry: Entry) => {
    entry.active = false;
    if (entry.image) {
      entry.image.onload = null;
      entry.image.onerror = null;
      entry.image.src = "";
    }
    entry.texture?.dispose();
  };
  const configure = (canvas: HTMLCanvasElement) => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  return {
    get: (finish: WallSurfaceFinish) => entries.get(keyFor(finish))?.texture ?? null,
    retain(surfaces: readonly Surface[]) {
      const finishes = surfaces.flatMap((surface) => (surface.finish ? [surface.finish] : []));
      const retained = new Set(finishes.map(keyFor));
      for (const [key, entry] of entries)
        if (!retained.has(key)) {
          release(entry);
          entries.delete(key);
        }
      if (typeof document === "undefined") return;
      let added = false;
      for (const finish of finishes) {
        const key = keyFor(finish);
        if (entries.has(key)) continue;
        const entry: Entry = { texture: null, active: true };
        entries.set(key, entry);
        added = true;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        if (finish.pattern === "custom-image") {
          const image = new Image();
          entry.image = image;
          image.onload = () => {
            if (!entry.active) return;
            canvas.width = finish.image.width;
            canvas.height = finish.image.height;
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            entry.texture = configure(canvas);
            notify();
          };
          image.src = finish.image.dataUrl;
          continue;
        }
        canvas.width = canvas.height = 256;
        if (finish.pattern === "square-tile" || finish.pattern === "subway-tile") {
          paintFloorPattern(context, finish.pattern, "scene", finish.color);
        } else {
          context.fillStyle = "#f5f1e8";
          context.fillRect(0, 0, 256, 256);
          context.fillStyle = finish.color;
          if (finish.pattern === "striped-wallpaper") {
            context.fillRect(0, 0, 64, 256);
            context.fillRect(128, 0, 64, 256);
          } else {
            for (const [x, y] of [
              [64, 64],
              [192, 192],
            ]) {
              context.beginPath();
              context.arc(x, y, 24, 0, Math.PI * 2);
              context.fill();
            }
          }
        }
        entry.texture = configure(canvas);
      }
      if (added) notify();
    },
    dispose() {
      entries.forEach(release);
      entries.clear();
    },
  };
}

export function useWallSurfaceTextures(surfaces: readonly Surface[]) {
  const [, setRevision] = useState(0);
  const textures = useMemo(
    () => createWallSurfaceTextures(() => setRevision((value) => value + 1)),
    [],
  );
  useEffect(() => () => textures.dispose(), [textures]);
  useEffect(() => textures.retain(surfaces), [surfaces, textures]);
  return textures;
}
