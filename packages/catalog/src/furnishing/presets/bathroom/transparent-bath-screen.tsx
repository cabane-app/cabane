import { ToonMaterial } from "@cabane/engine";
import { BoxGeometry, ExtrudeGeometry, Shape, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Cross-section of a folded clamp, looking down on the wall-side stile.
const jaw = new Shape();
jaw.moveTo(0.422, -0.023);
jaw.lineTo(0.429, -0.028);
jaw.lineTo(0.473, -0.028);
jaw.lineTo(0.473, 0.012);
jaw.lineTo(0.428, 0.012);
jaw.lineTo(0.422, 0.008);
jaw.lineTo(0.422, 0.003);
jaw.lineTo(0.458, 0.003);
jaw.lineTo(0.458, -0.006);
jaw.lineTo(0.422, -0.006);
jaw.closePath();
const mounts: BufferGeometry[] = [0.68, 1.72].map((y) =>
  new ExtrudeGeometry(jaw, { depth: 0.073, bevelEnabled: false })
    .rotateX(Math.PI / 2)
    .translate(0, y + 0.0365, 0),
);
mounts.push(new BoxGeometry(0.012, 1.41, 0.017).toNonIndexed().translate(0.459, 1.25, -0.001));
const hardware = mergeGeometries(mounts);
mounts.forEach((part) => part.dispose());

const edge = new Shape();
edge.moveTo(-0.46, 0.54);
edge.lineTo(0.456, 0.54);
edge.lineTo(0.456, 0.544);
edge.lineTo(-0.456, 0.544);
edge.lineTo(-0.456, 1.96);
edge.lineTo(-0.46, 1.96);
edge.closePath();

export function TransparentBathScreen() {
  return (
    <group name="family-bathroom-transparent-bath-screen">
      <mesh position={[0, 1.252, -0.0015]} receiveShadow>
        <boxGeometry args={[0.912, 1.416, 0.011]} />
        <ToonMaterial color="#9bcbd2" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh name="polished-glass-edge" position-z={-0.0075}>
        <extrudeGeometry args={[edge, { depth: 0.012, bevelEnabled: false }]} />
        <ToonMaterial color="#85b8bc" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh geometry={hardware} name="wall-clamps-and-stile" castShadow>
        <ToonMaterial color="#929b99" />
      </mesh>
    </group>
  );
}
