import { WALL_IMAGE_LIMITS, wallImageDimensions, type WallSurfaceImage } from "@cabane/engine";

/** Decode locally, remove metadata and bound the image before it enters undo or persistence. */
export async function prepareWallImage(file: File): Promise<WallSurfaceImage> {
  const mime =
    file.type ||
    { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }[
      file.name.split(".").at(-1)?.toLowerCase() ?? ""
    ];
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime ?? ""))
    throw new Error("Choose a PNG, JPG or WebP image.");
  if (file.size > WALL_IMAGE_LIMITS.inputBytes)
    throw new Error("Choose an image smaller than 10 MB.");
  const dimensions = wallImageDimensions(new Uint8Array(await file.arrayBuffer()));
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1)
    throw new Error("This image could not be read. Choose another PNG, JPG or WebP.");
  if (dimensions.width * dimensions.height > WALL_IMAGE_LIMITS.inputPixels)
    throw new Error("Choose an image no larger than 32 megapixels.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("This image could not be read. Try exporting it again.");
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preparation is unavailable in this browser.");
    for (const [maxEdge, quality] of [
      [WALL_IMAGE_LIMITS.maxEdge, 0.88],
      [768, 0.8],
      [512, 0.76],
    ] as const) {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes =
        (encoded.length * 3) / 4 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
      if (bytes <= WALL_IMAGE_LIMITS.storedBytes)
        return {
          name:
            Array.from(file.name)
              .filter(
                (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
              )
              .join("")
              .trim()
              .slice(0, 120) || "Wall image",
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        };
    }
    throw new Error("This image is too detailed to save. Try a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
