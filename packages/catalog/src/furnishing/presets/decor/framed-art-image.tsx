import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { SRGBColorSpace, TextureLoader, type Texture } from "three";
import { ToonMaterial } from "@cabane/engine";
import { subscribeBundledArtTexture } from "./bundled-art-textures";

/** Contained prints share bundled textures; custom prints retain instance ownership. */
export function FramedArtImage({
  src,
  width,
  height,
}: {
  src: string;
  width: number;
  height: number;
}) {
  const { gl, invalidate } = useThree();
  const [loaded, setLoaded] = useState<{ src: string; texture: Texture } | null>(null);
  useEffect(() => {
    const release = subscribeBundledArtTexture(src, (texture) => {
      if (texture) {
        try {
          // Retained floors can load while hidden. Upload their bundled prints
          // now rather than in the first interactive frame that reveals them.
          gl.initTexture(texture);
        } catch {
          // Context recovery can still initialize the texture on a normal draw.
        }
      }
      setLoaded(texture ? { src, texture } : null);
      invalidate();
    });
    if (release) return release;
    let cancelled = false;
    let owned: Texture | undefined;
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    try {
      loader.load(
        src,
        (texture) => {
          if (cancelled) {
            texture.dispose();
            return;
          }
          owned = texture;
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          setLoaded({ src, texture });
          invalidate();
        },
        undefined,
        () => {
          // An unavailable print must never suspend or crash the surrounding home.
          if (!cancelled) {
            setLoaded(null);
            invalidate();
          }
        },
      );
    } catch {
      // Image APIs may be absent in a non-browser renderer; keep the empty mount.
    }
    return () => {
      cancelled = true;
      owned?.dispose();
    };
  }, [src, gl, invalidate]);
  const texture = loaded?.src === src ? loaded.texture : null;
  if (!texture) return null;
  const image = texture.image as { width: number; height: number };
  const ratio = image.width / image.height;
  const printWidth = Math.min(width, height * ratio);
  const printHeight = printWidth / ratio;
  return (
    <mesh name="framed-art-image">
      <planeGeometry args={[printWidth, printHeight]} />
      <ToonMaterial map={texture} color="white" />
    </mesh>
  );
}
