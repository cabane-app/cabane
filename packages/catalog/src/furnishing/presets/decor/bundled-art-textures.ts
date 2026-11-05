import { SRGBColorSpace, TextureLoader, type Texture } from "three";
import { isBundledWallArtImage } from "./wall-art-images";

type Listener = (texture: Texture | null) => void;
type Entry = { texture: Texture | null; listeners: Set<Listener> };

// Only the four shipped prints live for the application lifetime. Keeping their
// Texture identity avoids repeat GPU uploads after a floor unmounts. User images
// never enter this finite cache and keep their normal instance-owned lifetime.
const prints = new Map<string, Entry>();

export function subscribeBundledArtTexture(src: string, listener: Listener) {
  if (!isBundledWallArtImage(src)) return undefined;
  let entry = prints.get(src);
  if (!entry) {
    entry = { texture: null, listeners: new Set() };
    prints.set(src, entry);
    const loading = entry;
    const failed = () => {
      prints.delete(src);
      for (const notify of loading.listeners) notify(null);
      loading.listeners.clear();
    };
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    // Register before loading: adapters and cached image loaders may complete
    // synchronously, and the first consumer must receive that result too.
    loading.listeners.add(listener);
    try {
      loader.load(
        src,
        (texture) => {
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          loading.texture = texture;
          for (const notify of loading.listeners) notify(texture);
        },
        undefined,
        failed,
      );
    } catch {
      failed();
    }
  } else {
    entry.listeners.add(listener);
    if (entry.texture) listener(entry.texture);
  }
  const subscribed = entry;
  return () => {
    subscribed.listeners.delete(listener);
  };
}
