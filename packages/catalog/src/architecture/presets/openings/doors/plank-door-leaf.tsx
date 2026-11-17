import { RoundedBox } from "@cabane/engine";
import { Outlines, JoineryMaterial } from "@cabane/engine";
import type { DoorSpec } from "@cabane/engine";
import { OpeningFrameBox } from "../opening-frame-box";

export const PLANK_DOOR_LEAF_DEPTH_METERS = 0.065;

export function PlankDoorLeaf({
  width,
  height,
  handleSide,
  finish,
  color,
  railHangers = true,
  depthScale = 1,
}: {
  width: number;
  height: number;
  handleSide: -1 | 1;
  finish: DoorSpec["finish"];
  color?: string;
  railHangers?: boolean;
  depthScale?: number;
}) {
  const white = finish === "white";
  const wood = color ?? (white ? "#e6e3dc" : "#85583b");
  const woodLight = color ?? (white ? "#f1f0eb" : "#9c6b49");
  const woodDark = white ? "#bdbbb5" : "#68432e";
  const innerWidth = Math.max(0.02, width - Math.min(0.12, width * 0.3));
  const stileWidth = Math.min(0.1, width * 0.22);
  const braceWidth = Math.min(0.075, width * 0.22);
  const innerHeight = Math.max(0.2, height - 0.16);
  const plankCount = Math.max(4, Math.round(width / 0.096));
  const plankWidth = innerWidth / plankCount;
  const braceLength = Math.hypot(innerWidth, innerHeight);
  const braceAngle = Math.atan2(innerHeight, innerWidth);

  return (
    <group scale={[1, 1, depthScale]}>
      <RoundedBox
        args={[width, height, PLANK_DOOR_LEAF_DEPTH_METERS]}
        radius={0.018}
        smoothness={3}
        castShadow
      >
        <JoineryMaterial finish={white ? "paint" : "wood"} color={wood} />
        <Outlines thickness={0.006} color={woodDark} screenspace={false} />
      </RoundedBox>
      {Array.from({ length: plankCount }, (_, index) => {
        const x = -innerWidth / 2 + plankWidth * (index + 0.5);
        return (
          <group key={index}>
            <mesh position={[x, 0, 0.04]} castShadow>
              <boxGeometry args={[Math.max(0.01, plankWidth - 0.008), innerHeight, 0.018]} />
              <JoineryMaterial
                finish={white ? "paint" : "wood"}
                color={index % 3 === 1 ? woodLight : wood}
              />
            </mesh>
            {index < plankCount - 1 && (
              <mesh position={[x + plankWidth / 2, 0, 0.052]}>
                <boxGeometry args={[0.006, innerHeight - 0.01, 0.009]} />
                <JoineryMaterial finish={white ? "paint" : "wood"} color={woodDark} />
              </mesh>
            )}
          </group>
        );
      })}
      {([-1, 1] as const).map((side) => (
        <OpeningFrameBox
          key={`plank-horizontal-${side}`}
          size={[width - Math.min(0.04, width * 0.12), 0.1, 0.045]}
          position={[0, side * (height / 2 - 0.07), 0.068]}
          color={woodDark}
        />
      ))}
      {([-1, 1] as const).map((side) => (
        <OpeningFrameBox
          key={`plank-vertical-${side}`}
          size={[stileWidth, height - 0.1, 0.045]}
          position={[side * (width / 2 - stileWidth / 2), 0, 0.068]}
          color={woodDark}
        />
      ))}
      {([-1, 1] as const).map((direction) => (
        <RoundedBox
          key={direction}
          args={[braceLength, braceWidth, 0.045]}
          radius={Math.min(0.014, braceWidth / 4)}
          smoothness={2}
          rotation={[0, 0, direction * braceAngle]}
          position={[0, 0, 0.096]}
          castShadow
        >
          <JoineryMaterial finish={white ? "paint" : "wood"} color={woodLight} />
          <Outlines thickness={0.004} color={woodDark} screenspace={false} />
        </RoundedBox>
      ))}
      <group
        name="opening-plank-pull"
        position={[handleSide * (width / 2 - Math.min(0.17, width * 0.3)), 0, 0.135]}
      >
        {([-1, 1] as const).map((side) => (
          <OpeningFrameBox
            key={side}
            size={[Math.min(0.07, width * 0.35), 0.08, 0.035]}
            position={[0, side * 0.14, 0.014]}
            color="#747a79"
          />
        ))}
        <OpeningFrameBox
          size={[Math.min(0.045, width * 0.25), 0.34, 0.045]}
          position={[0, 0, -0.045]}
          color="#909695"
        />
      </group>
      {railHangers &&
        ([-0.36, 0.36] as const).map((ratio) => (
          <group
            key={ratio}
            name="opening-plank-rail-hanger"
            position={[ratio * width, height / 2 + 0.06, 0.075]}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.085, 0.085, 0.045, 16]} />
              <JoineryMaterial finish="metal" color="#242525" />
              <Outlines thickness={0.006} color="#111212" screenspace={false} />
            </mesh>
            <OpeningFrameBox
              size={[0.075, 0.34, 0.04]}
              position={[0, -0.15, 0.02]}
              color="#242525"
            />
          </group>
        ))}
    </group>
  );
}
