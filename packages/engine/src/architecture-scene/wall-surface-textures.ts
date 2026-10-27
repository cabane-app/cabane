import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { paintFloorPattern } from "../floor-finishes/presets";
import type { WallSurfaceFinish } from "../types";

/** Private image assets are deliberately outside this generated-pattern contract. */
function createWallSurfaceTextures() {
  const textures = new Map<string, CanvasTexture>();
  return {
    get(finish: WallSurfaceFinish) {
      const key = `${finish.pattern}:${finish.color}`;
      if (textures.has(key)) return textures.get(key)!;
      if (typeof document === "undefined") return null;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) return null;
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
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.anisotropy = 8;
        textures.set(key, texture);
        return texture;
      } catch {
        return null;
      }
    },
    dispose() {
      textures.forEach((texture) => texture.dispose());
    },
  };
}

export function useWallSurfaceTextures() {
  const textures = useMemo(() => createWallSurfaceTextures(), []);
  useEffect(() => () => textures.dispose(), [textures]);
  return textures;
}
