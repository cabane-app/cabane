import { ToonMaterial } from "@cabane/engine";
import { LatheGeometry, Vector2 } from "three";

// Each section spans the rear and nose of the casting. Extending only the rear
// of the outer wall forms the trap shroud in the same continuous ceramic skin.
type BowlSection = [back: number, nose: number, halfWidth: number, height: number];
function casting(section: BowlSection[]) {
  const geometry = new LatheGeometry(
    section.map(([, , w, y]) => new Vector2(w, y)),
    32,
  );
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const [back, nose] = section[i % section.length];
    const angle = 2 * Math.PI * uv.getX(i);
    positions.setX(i, (back + nose + Math.sin(angle) * (nose - back)) / 2);
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let j = 0; j < section.length; j++) {
    const end = normals.count - section.length + j;
    const nx = normals.getX(j) + normals.getX(end);
    const ny = normals.getY(j) + normals.getY(end);
    const nz = normals.getZ(j) + normals.getZ(end);
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.setXYZ(j, nx / length, ny / length, nz / length);
    normals.setXYZ(end, nx / length, ny / length, nz / length);
  }
  return geometry;
}
const shell = casting([
  [0.275, 0.275, 0, 0.182],
  [0.165, 0.421, 0.087, 0.182],
  [0.16, 0.528, 0.128, 0.202],
  [0.154, 0.652, 0.17, 0.263],
  [0.146, 0.704, 0.192, 0.336],
  [0.144, 0.718, 0.2, 0.39],
  [0.144, 0.716, 0.2, 0.409],
  [0.15, 0.707, 0.193, 0.422],
  [0.274, 0.661, 0.153, 0.422],
  [0.288, 0.651, 0.147, 0.409],
  [0.308, 0.621, 0.133, 0.358],
  [0.336, 0.542, 0.092, 0.291],
  [0.358, 0.457, 0.045, 0.262],
  [0.407, 0.407, 0, 0.258],
]);
const seat = casting([
  [0.246, 0.684, 0.171, 0.42],
  [0.222, 0.703, 0.192, 0.423],
  [0.217, 0.71, 0.197, 0.432],
  [0.224, 0.704, 0.193, 0.446],
  [0.238, 0.689, 0.183, 0.45],
  [0.274, 0.657, 0.15, 0.448],
  [0.286, 0.646, 0.144, 0.437],
  [0.28, 0.652, 0.151, 0.423],
  [0.246, 0.684, 0.171, 0.42],
]);

export function WallBackedCeramic() {
  return (
    <>
      <mesh name="hollow-ceramic-bowl" geometry={shell} castShadow receiveShadow>
        <ToonMaterial color="#e9e7e0" />
      </mesh>
      <mesh name="open-toilet-seat" geometry={seat} castShadow receiveShadow>
        <ToonMaterial color="#faf9f4" />
      </mesh>
    </>
  );
}
