import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { FloorPatternPresetId } from "../types";
import { paintFloorPattern, type FloorPatternVariant } from "./presets";

export interface FloorFinishTextureSet {
  get: (id: FloorPatternPresetId, color?: string) => CanvasTexture | null;
  dispose: () => void;
}

const textureSize = (id: FloorPatternPresetId, variant: FloorPatternVariant) =>
  id === "dark-walnut" || id === "light-oak" || id === "light-oak-horizontal"
    ? 512
    : variant === "plan"
      ? 96
      : 128;

type CanvasDocument = Pick<Document, "createElement">;

export const createFloorFinishTextureSet = (
  variant: FloorPatternVariant,
  canvasDocument: CanvasDocument | null = typeof document === "undefined" ? null : document,
): FloorFinishTextureSet => {
  const textures = new Map<string, CanvasTexture | null>();
  return {
    get: (id, color) => {
      if (!canvasDocument) return null;
      const key = color ? `${id}:${color}` : id;
      if (!textures.has(key)) {
        textures.set(key, null);
        try {
          const canvas = canvasDocument.createElement("canvas");
          canvas.width = canvas.height = textureSize(id, variant);
          const context = canvas.getContext("2d");
          if (!context) return null;
          paintFloorPattern(context, id, variant, color);
          const texture = new CanvasTexture(canvas);
          texture.colorSpace = SRGBColorSpace;
          texture.wrapS = texture.wrapT = RepeatWrapping;
          texture.minFilter = LinearMipmapLinearFilter;
          texture.anisotropy = 8;
          textures.set(key, texture);
        } catch {
          // A non-browser renderer may lack a 2D context; use the finish color.
        }
      }
      return textures.get(key) ?? null;
    },
    dispose: () => {
      textures.forEach((texture) => texture?.dispose());
      textures.clear();
    },
  };
};
