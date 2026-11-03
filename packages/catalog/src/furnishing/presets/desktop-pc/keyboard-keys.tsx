import { useEffect, useMemo } from "react";
import { BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ToonMaterial } from "@cabane/engine";

/** Quiet unlettered keycaps, combined into one surface mesh. */
export function KeyboardKeys() {
  const geometry = useMemo(() => {
    const keys: BoxGeometry[] = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 15; column++) {
        const key = new BoxGeometry(0.022, 0.009, 0.02);
        key.translate((column - 7) * 0.027, 0.0255, (row - 2) * 0.026);
        keys.push(key);
      }
    }
    for (const [x, width] of [
      [-0.18, 0.04],
      [-0.13, 0.04],
      [0, 0.2],
      [0.13, 0.04],
      [0.18, 0.04],
    ]) {
      const key = new BoxGeometry(width, 0.009, 0.02);
      key.translate(x, 0.0255, 0.052);
      keys.push(key);
    }
    const merged = mergeGeometries(keys);
    keys.forEach((key) => key.dispose());
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <ToonMaterial color="#697277" />
    </mesh>
  );
}
