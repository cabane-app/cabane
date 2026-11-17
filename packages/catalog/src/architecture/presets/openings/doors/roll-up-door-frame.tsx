import { JoineryMaterial, useDetailedJoinery } from "@cabane/engine";
import { useEffect, useMemo } from "react";
import { rollUpHoodGeometry } from "./roll-up-profiles";
export function RollUpDoorFrame({
  width,
  color,
  height,
  depth,
  jambWidth,
  headerHeight,
}: {
  width: number;
  color?: string;
  height: number;
  depth: number;
  jambWidth: number;
  headerHeight: number;
}) {
  const detailed = useDetailedJoinery();
  const hood = useMemo(
    () => (detailed ? rollUpHoodGeometry(width - jambWidth * 2, headerHeight, depth) : null),
    [detailed, width, jambWidth, headerHeight, depth],
  );
  useEffect(() => () => hood?.dispose(), [hood]);
  return (
    <group name="roll-up-door-frame">
      {[jambWidth / 2, width - jambWidth / 2].map((x) => (
        <mesh key={x} position={[x, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[jambWidth, height, depth]} />
          <JoineryMaterial color={color ?? "#7d8581"} finish="metal" />
        </mesh>
      ))}
      <mesh
        key={detailed ? "cassette" : "header"}
        position={[width / 2, height - headerHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        {hood ? (
          <primitive object={hood} attach="geometry" />
        ) : (
          <boxGeometry args={[width - jambWidth * 2, headerHeight, depth]} />
        )}
        <JoineryMaterial color={color ?? "#dddcd6"} finish="paint" />
      </mesh>
    </group>
  );
}
