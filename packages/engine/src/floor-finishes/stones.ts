import { DEFAULT_TERRAIN_GRASS_COLOR } from "../terrain/terrain-settings";
import { patternRandom, periodicMotif } from "./periodic-motifs";

export function paintStones(context: CanvasRenderingContext2D, path: boolean, quiet: boolean) {
  const size = context.canvas.width;
  const random = patternRandom(31991);
  // Matches the default home palette's grass, including in palette previews.
  context.fillStyle = path ? DEFAULT_TERRAIN_GRASS_COLOR : "#827f72";
  context.fillRect(0, 0, size, size);
  const colors = quiet
    ? ["#b9b6a8", "#a7a89b", "#c4c0b2", "#999c91"]
    : ["#b5b3a6", "#9b9f94", "#c7c1b2", "#a8a89a"];
  const columns = path ? 2 : 8;
  const rows = path ? 3 : 9;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = ((column + 0.5 + (random() - 0.5) * 0.3) * size) / columns;
      const y = ((row + 0.5 + (random() - 0.5) * 0.2) * size) / rows;
      const rx = (size / columns) * (0.32 + random() * 0.08);
      const ry = (size / rows) * (0.32 + random() * 0.08);
      const angle = (random() - 0.5) * 0.6;
      const radii = Array.from({ length: 7 }, () => 0.86 + random() * 0.14);
      context.fillStyle = colors[(row * 3 + column) % colors.length];
      context.strokeStyle = path ? "#777e63" : "#76796e";
      context.lineWidth = size * 0.007;
      periodicMotif(context, () => {
        context.translate(x, y);
        context.rotate(angle);
        context.beginPath();
        if (path) {
          radii.forEach((radius, corner) => {
            const theta = (corner * Math.PI * 2) / radii.length;
            const px = Math.cos(theta) * rx * radius;
            const py = Math.sin(theta) * ry * radius;
            if (corner === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
          });
          context.closePath();
        } else {
          context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        }
        context.fill();
        context.stroke();
      });
    }
  }
}
