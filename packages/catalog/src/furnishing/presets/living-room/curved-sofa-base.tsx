import { useMemo } from "react";
import { Shape } from "three";
import { ToonMaterial } from "@cabane/engine";

const extrusion = {
  depth: 0.23,
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelSegments: 2,
  curveSegments: 20,
};

/** One continuous shallow crescent plinth, with softened connected edges. */
export function CurvedSofaBase() {
  const shape = useMemo(() => {
    const result = new Shape();
    result.moveTo(-1.28, -0.3);
    result.bezierCurveTo(-1.28, -0.53, -0.5, -0.53, 0, -0.53);
    result.bezierCurveTo(0.5, -0.53, 1.28, -0.53, 1.28, -0.3);
    result.lineTo(1.28, 0.28);
    result.bezierCurveTo(1.28, 0.53, 0.4, 0.53, 0, 0.53);
    result.bezierCurveTo(-0.4, 0.53, -1.28, 0.53, -1.28, 0.28);
    result.closePath();
    return result;
  }, []);
  return (
    <group>
      {[-1, 1].flatMap((x) =>
        [-0.35, 0.35].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.05, z]}>
            <boxGeometry args={[0.055, 0.1, 0.055]} />
            <ToonMaterial color="#545851" />
          </mesh>
        )),
      )}
      <mesh
        name="curved-sofa-continuous-base"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[shape, extrusion]} />
        <ToonMaterial color="#a9aca5" />
      </mesh>
    </group>
  );
}
