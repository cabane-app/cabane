import { useEffect, useMemo } from "react";
import { JoineryMaterial } from "@cabane/engine";
import { BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** A low threshold and overhead guide straddle the moving sash. */
export function SlidingGlassTrack({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const parts = [new BoxGeometry(width, 0.006, 0.116).translate(0, 0.003, 0)];
    for (const side of [-1, 1]) {
      parts.push(new BoxGeometry(width, 0.005, 0.008).translate(0, 0.0085, side * 0.044));
      parts.push(new BoxGeometry(width, 0.026, 0.012).translate(0, height - 0.011, side * 0.044));
    }
    const result = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    result.userData.preservePlanarFaces = true;
    return result;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      name="opening-sliding-glass-track"
      position-x={width / 2}
      geometry={geometry}
      receiveShadow
    >
      <JoineryMaterial color={color} finish="metal" />
    </mesh>
  );
}
