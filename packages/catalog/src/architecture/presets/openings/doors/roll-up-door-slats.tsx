import { JoineryMaterial, useDetailedJoinery } from "@cabane/engine";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { rollUpSlatGeometry } from "./roll-up-profiles";

function applyTravel(group: Group, clearHeight: number, travel: number) {
  const pitch = clearHeight / (group.children.length - 1);
  group.children.forEach((part, index) => {
    if (part.name === "roll-up-door-handle") {
      part.position.y = 0.85 + travel;
      part.visible = part.position.y + 0.025 < clearHeight;
      return;
    }
    const bottom = index * pitch + travel;
    const height = Math.max(0, Math.min(pitch, clearHeight - bottom));
    part.position.y = bottom + height / 2;
    part.scale.y = height / pitch;
    part.visible = height > 0.000001;
  });
}

export function RollUpDoorSlats({
  width,
  clearHeight,
  travel,
  finish,
  color,
  side,
  reducedMotion,
}: {
  width: number;
  clearHeight: number;
  travel: number;
  finish: "wood" | "white";
  color?: string;
  side: number;
  reducedMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const currentTravel = useRef(travel);
  const invalidate = useThree((state) => state.invalidate);
  const count = Math.max(1, Math.ceil(clearHeight / 0.16));
  const pitch = clearHeight / count;
  const detailed = useDetailedJoinery();
  const profiles = useMemo(() => {
    if (!detailed) return [];
    const phases = finish === "wood" ? [0, 0.31, 0.52, 0.77] : [0];
    return phases.map((offset) => rollUpSlatGeometry(width, pitch, offset));
  }, [detailed, finish, width, pitch]);
  useEffect(() => () => profiles.forEach((part) => part.dispose()), [profiles]);

  useLayoutEffect(() => {
    if (reducedMotion) currentTravel.current = travel;
    currentTravel.current = Math.min(clearHeight, currentTravel.current);
    if (group.current) applyTravel(group.current, clearHeight, currentTravel.current);
    invalidate();
  }, [clearHeight, travel, reducedMotion, side, detailed, invalidate]);

  useFrame((_, delta) => {
    if (!group.current || currentTravel.current === travel) return;
    const remaining = travel - currentTravel.current;
    currentTravel.current =
      reducedMotion || Math.abs(remaining) < 0.0001
        ? travel
        : currentTravel.current + remaining * (1 - Math.exp(-5 * Math.min(delta, 0.1)));
    applyTravel(group.current, clearHeight, currentTravel.current);
    if (currentTravel.current !== travel) invalidate();
  });

  return (
    <group ref={group} name="roll-up-door-slats">
      {Array.from({ length: count }, (_, index) => {
        return (
          <mesh key={index + (detailed ? "-folded" : "-plain")} castShadow receiveShadow>
            {detailed ? (
              <primitive attach="geometry" object={profiles[index % profiles.length]} />
            ) : (
              <boxGeometry args={[width, pitch, 0.045]} />
            )}
            <JoineryMaterial
              finish={finish === "wood" ? "wood" : "paint"}
              color={
                color ??
                (finish === "wood"
                  ? index % 2
                    ? "#ba9365"
                    : "#ad8559"
                  : index % 2
                    ? "#e8e6df"
                    : "#dddcd6")
              }
            />
          </mesh>
        );
      })}
      <group
        key={detailed ? "bow-pull" : "pull"}
        name="roll-up-door-handle"
        position-z={side * 0.03}
      >
        {detailed ? (
          <>
            <mesh rotation-z={Math.PI / 2} position-z={side * 0.026} castShadow>
              <cylinderGeometry args={[0.011, 0.011, Math.min(0.29, width / 2), 12]} />
              <JoineryMaterial color="#929893" finish="metal" />
            </mesh>
            {[-1, 1].map((end) => (
              <mesh
                key={end}
                position={[end * Math.min(0.13, width * 0.22), 0, side * 0.005]}
                rotation-x={Math.PI / 2}
                castShadow
              >
                <cylinderGeometry args={[0.014, 0.014, 0.044, 12]} />
                <JoineryMaterial color="#676f6a" finish="metal" />
              </mesh>
            ))}
          </>
        ) : (
          <mesh castShadow>
            <boxGeometry args={[Math.min(0.32, width / 2), 0.04, 0.015]} />
            <JoineryMaterial color="#646b68" finish="metal" />
          </mesh>
        )}
      </group>
    </group>
  );
}
