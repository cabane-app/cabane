import { ToonMaterial } from "@cabane/engine";

// Staggered lozenges follow the curved grille. One surface carries the whole perforation pattern.
function grillePerforations() {
  const points: number[] = [];
  const sectors = 40;
  for (let row = 0; row < 12; row++) {
    const y = 0.064 + row * 0.022;
    for (let column = 0; column < sectors; column++) {
      const angle = ((column + (row % 2) / 2) * 2 * Math.PI) / sectors;
      if (Math.abs(Math.sin(angle)) < 0.305 && Math.cos(angle) > 0 && y > 0.093 && y < 0.287)
        continue;
      const vertex = (da: number, dy: number) =>
        points.push(0.1298 * Math.sin(angle + da), y + dy, 0.1298 * Math.cos(angle + da));
      vertex(-0.035, 0);
      vertex(0, -0.004);
      vertex(0.035, 0);
      vertex(-0.035, 0);
      vertex(0.035, 0);
      vertex(0, 0.004);
    }
  }
  return new Float32Array(points);
}
const holes = grillePerforations();
const normals = Float32Array.from(holes, (v, i) => (i % 3 === 1 ? 0 : v / 0.1298));
export function SpeakerGrille() {
  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[holes, 3]} />
        <bufferAttribute attach="attributes-normal" args={[normals, 3]} />
      </bufferGeometry>
      <ToonMaterial color="#303c38" />
    </mesh>
  );
}
