/** Copy immediately after rendering, while the default drawing buffer is valid. */
export function copyWebGLPreview(source: HTMLCanvasElement, target: HTMLCanvasElement) {
  const gl = source.getContext("webgl2");
  if (!gl || gl.isContextLost()) throw new Error("Preview WebGL context unavailable");
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const pixels = new Uint8Array(width * height * 4);
  // https://github.com/cabane-app/cabane/issues/75 reports orange turning blue
  // in Firefox desktop previews while the live 3D scene keeps its colors. This
  // is consistent with a red/blue swap during drawImage(WebGL canvas) into 2D.
  // The affected GPU behavior was not reproduced locally. Explicit RGBA
  // readback is a workaround that bypasses that transfer for both catalog and
  // workspace previews, preserving correct colors on unaffected browsers too.
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const snapshot = document.createElement("canvas");
  snapshot.width = width;
  snapshot.height = height;
  const context = snapshot.getContext("2d");
  const destination = target.getContext("2d");
  if (!context || !destination) throw new Error("Preview canvas unavailable");
  const image = context.createImageData(width, height);
  const premultiplied = gl.getContextAttributes()?.premultipliedAlpha;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((height - 1 - y) * width + x) * 4;
      const to = (y * width + x) * 4;
      const alpha = pixels[from + 3];
      // WebGL rows start at the bottom and its drawing buffer may premultiply
      // RGB by alpha. ImageData expects top-down, unpremultiplied RGBA bytes.
      const scale = premultiplied && alpha > 0 ? 255 / alpha : 1;
      image.data[to] = pixels[from] * scale;
      image.data[to + 1] = pixels[from + 1] * scale;
      image.data[to + 2] = pixels[from + 2] * scale;
      image.data[to + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  destination.drawImage(snapshot, 0, 0, target.width, target.height);
}
