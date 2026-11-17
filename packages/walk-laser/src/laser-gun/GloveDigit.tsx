import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { BlasterFinish } from "./BlasterFinish";
type Point = [number, number, number];
export function GloveDigit({ path, radius }: { path: Point[]; radius: number }) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(path.map(([x, y, z]) => new Vector3(x, y, z)));
    const tube = new TubeGeometry(curve, 24, radius, 10, false);
    // Close and round the fingertip by tapering the last rings into the tip.
    const vertices = tube.attributes.position!;
    for (let ring = 20; ring <= 24; ring++) {
      const center = curve.getPointAt(ring / 24);
      const scale = Math.sqrt(1 - ((ring - 20) / 4) ** 2);
      for (let side = 0; side <= 10; side++) {
        const index = ring * 11 + side;
        const point = new Vector3()
          .fromBufferAttribute(vertices, index)
          .sub(center)
          .multiplyScalar(scale)
          .add(center);
        vertices.setXYZ(index, point.x, point.y, point.z);
      }
    }
    tube.computeVertexNormals();
    return tube;
  }, [path, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <BlasterFinish kind="grip" />
    </mesh>
  );
}
