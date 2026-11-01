import { useEffect, useMemo } from "react";
import { LayeredSurface, Outlines, ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { countertopFinish } from "./countertop-finish";
import { countertopGeometry, countertopPattern, COUNTERTOP_THICKNESS } from "./countertop-geometry";

export function CountertopSlab({
  size,
  nominalSize,
  variant,
  corner = false,
}: {
  size: SceneItemSize;
  nominalSize: SceneItemSize;
  variant: string;
  corner?: boolean;
}) {
  const [width, , depth] = nominalSize;
  const finish = countertopFinish(variant);
  const { body, top } = useMemo(
    () => countertopGeometry(width, depth, corner),
    [width, depth, corner],
  );
  const pattern = useMemo(
    () => countertopPattern(width, depth, corner, finish.pattern),
    [width, depth, corner, finish.pattern],
  );
  useEffect(
    () => () => {
      body.dispose();
      top.dispose();
    },
    [body, top],
  );
  useEffect(() => () => pattern.dispose(), [pattern]);
  return (
    <group
      name={corner ? "corner-countertop" : "countertop"}
      scale={[size[0] / width, size[1] / COUNTERTOP_THICKNESS, size[2] / depth]}
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh name="countertop-beveled-slab" geometry={body} castShadow receiveShadow>
          <ToonMaterial color={finish.color} />
          <Outlines color={finish.outline} thickness={0.0015} screenspace={false} />
        </mesh>
        <group position-z={COUNTERTOP_THICKNESS}>
          <LayeredSurface
            name="countertop-surface"
            layer={0}
            color={finish.color}
            castShadow
            receiveShadow
          >
            <primitive object={top} attach="geometry" />
          </LayeredSurface>
          <LayeredSurface
            name="countertop-material-detail"
            layer={1}
            color={finish.detail}
            receiveShadow
          >
            <primitive object={pattern} attach="geometry" />
          </LayeredSurface>
        </group>
      </group>
    </group>
  );
}
