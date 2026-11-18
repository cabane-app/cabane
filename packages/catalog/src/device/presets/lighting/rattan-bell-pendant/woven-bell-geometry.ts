import { CatmullRomCurve3, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Radius/height profile: a generous open skirt flows into a slender bottle neck.
const profile = new CatmullRomCurve3([
  new Vector3(0.246, 0.004, 0),
  new Vector3(0.244, 0.09, 0),
  new Vector3(0.218, 0.19, 0),
  new Vector3(0.155, 0.28, 0),
  new Vector3(0.075, 0.355, 0),
  new Vector3(0.039, 0.405, 0),
  new Vector3(0.037, 0.48, 0),
]);

export function createWovenBellGeometry() {
  const bundles: BufferGeometry[][] = [[], [], [], []];
  for (let strand = 0; strand < 44; strand++) {
    const angle = (strand / 44) * Math.PI * 2;
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      const p = profile.getPoint(t);
      // Subtle over/under motion gives the cane real depth without dark drawn lines.
      const radius = Math.min(
        0.24745,
        p.x + Math.cos(t * Math.PI * 12 + strand * Math.PI) * 0.0025,
      );
      const twist = angle + 0.21 * Math.sin(t * Math.PI);
      return new Vector3(Math.cos(twist) * radius, p.y, Math.sin(twist) * radius);
    });
    bundles[strand % 3].push(new TubeGeometry(new CatmullRomCurve3(points), 26, 0.0024, 5, false));
  }
  for (let ring = 0; ring <= 12; ring++) {
    const p = profile.getPoint(ring / 12);
    const geometry = new TorusGeometry(p.x, ring === 0 ? 0.004 : 0.0026, ring === 0 ? 8 : 6, 52);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, p.y, 0);
    bundles[ring === 0 || ring >= 10 ? 3 : 1].push(geometry);
  }
  return bundles.map((parts) => {
    const merged = mergeGeometries(parts)!;
    parts.forEach((part) => part.dispose());
    return merged;
  });
}
