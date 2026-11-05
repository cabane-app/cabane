/** Bundled, generated gouache prints; no household data or external image service. */
const WALL_ART_IMAGES = {
  "atlantic-village": new URL("../../../../assets/wall-art/atlantic-village.png", import.meta.url)
    .href,
  "riviera-cliffs": new URL("../../../../assets/wall-art/riviera-cliffs.png", import.meta.url).href,
  "breton-harbor": new URL("../../../../assets/wall-art/breton-harbor.png", import.meta.url).href,
  "provence-village": new URL("../../../../assets/wall-art/provence-village.png", import.meta.url)
    .href,
} as const;

export function wallArtImage(variant: string): string | undefined {
  return Object.hasOwn(WALL_ART_IMAGES, variant)
    ? WALL_ART_IMAGES[variant as keyof typeof WALL_ART_IMAGES]
    : undefined;
}

export function isBundledWallArtImage(src: string): boolean {
  return Object.values(WALL_ART_IMAGES).some((url) => url === src);
}
