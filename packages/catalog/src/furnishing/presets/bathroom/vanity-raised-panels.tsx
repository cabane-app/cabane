import { ToonMaterial } from "@cabane/engine";
import { ExtrudeGeometry, Shape } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// The fields rise from the recessed backing to just behind the two door
// frames. A broad chamfer catches light across the dark oak.
const field = new Shape();
field.moveTo(-0.129, -0.268);
field.lineTo(0.129, -0.268);
field.lineTo(0.129, 0.268);
field.lineTo(-0.129, 0.268);
field.closePath();
const fields = [-0.189, 0.189].map((x) =>
  new ExtrudeGeometry(field, {
    depth: 0.001,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.008,
  }).translate(x, 0.466, 0.225),
);
const panels = mergeGeometries(fields);
fields.forEach((part) => part.dispose());

export function VanityRaisedPanels() {
  return (
    <mesh
      name="vanity-fielded-door-panels"
      geometry={panels}
      dispose={null}
      castShadow
      receiveShadow
    >
      <ToonMaterial color="#503a30" />
    </mesh>
  );
}
