import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";
import { Outlines, ToonMaterial } from "@cabane/engine";

function turnedProfile(points: [number, number][], sides: number) {
  return new LatheGeometry(
    points.map(([radius, y]) => new Vector2(radius, y)),
    sides,
  );
}

// The underside sweeps into a broad thumb moulding, below a lighter oak face.
const edge = turnedProfile(
  [
    [0, 0.319],
    [0.271, 0.319],
    [0.295, 0.324],
    [0.326, 0.342],
    [0.337, 0.351],
    [0.34, 0.359],
    [0.34, 0.368],
    [0.336, 0.374],
    [0, 0.374],
  ],
  40,
);
const face = turnedProfile(
  [
    [0.331, 0.372],
    [0.336, 0.374],
    [0.335, 0.38],
    [0.33, 0.385],
    [0, 0.385],
  ],
  40,
);
const spindle = turnedProfile(
  [
    [0, -0.001],
    [0.014, -0.001],
    [0.018, 0.004],
    [0.02, 0.03],
    [0.031, 0.216],
    [0.035, 0.276],
    [0.031, 0.31],
    [0.029, 0.326],
    [0, 0.326],
  ],
  12,
);
// Splay the lathed stock while keeping the foot and top cuts horizontal.
const positions = spindle.attributes.position;
for (let i = 0; i < positions.count; i++) {
  positions.setX(i, positions.getX(i) + 0.198 - 0.205 * positions.getY(i));
}
spindle.computeVertexNormals();

// One joined apron with three arms seated into the spindle shoulders.
const apronOutline = new Shape();
for (let i = 0; i < 3; i++) {
  const angle = (i * Math.PI * 2) / 3;
  for (const [along, across] of [
    [0.14, -0.016],
    [0.14, 0.016],
    [0.00924, 0.016],
  ]) {
    const x = Math.cos(angle) * along - Math.sin(angle) * across;
    const y = Math.sin(angle) * along + Math.cos(angle) * across;
    if (i === 0 && across < 0) apronOutline.moveTo(x, y);
    else apronOutline.lineTo(x, y);
  }
}
apronOutline.closePath();
const apron = new ExtrudeGeometry(apronOutline, {
  depth: 0.03,
  bevelSize: 0.002,
  bevelThickness: 0.002,
  bevelSegments: 1,
});
apron.rotateX(-Math.PI / 2);
apron.translate(0, 0.291, 0);

export function RoundCoffeeTable() {
  return (
    <group name="petite-table-basse-salon-custom" userData={{ walkCollider: true }}>
      <group scale={[1, 1, 0.9]}>
        <mesh geometry={edge} castShadow receiveShadow>
          <ToonMaterial color="#d0a16a" />
          <Outlines color="#876342" thickness={0.0015} screenspace={false} />
        </mesh>
        <mesh geometry={face} castShadow receiveShadow>
          <ToonMaterial color="#ddb27f" />
        </mesh>
        <mesh geometry={apron} castShadow>
          <ToonMaterial color="#9b7045" />
        </mesh>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh geometry={spindle} castShadow>
              <ToonMaterial color="#b9854f" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
