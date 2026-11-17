import { useEffect, useMemo } from "react";
import {
  ArchitecturalGlass,
  JoineryMaterial,
  ToonMaterial,
  useGraphicsFeature,
} from "@cabane/engine";
import { OpeningFrameBox } from "../opening-frame-box";
import { sashGeometry } from "./sash-geometry";

export function FramedGlassPanel({
  width,
  height,
  columns,
  rows,
  privacy = false,
  frameDepth = 0.065,
  frameColor = "#e7e2d8",
  slidingSash = false,
  doorFinish,
  latchSide,
}: {
  width: number;
  height: number;
  columns: number;
  rows: number;
  privacy?: boolean;
  frameDepth?: number;
  frameColor?: string;
  slidingSash?: boolean;
  doorFinish?: "wood" | "paint" | "metal";
  latchSide?: -1 | 1;
}) {
  const frame = Math.min(0.055, width * 0.14, height * 0.14);
  const detailed = useGraphicsFeature("joinery");
  const bottomRail = slidingSash ? Math.min(0.098, frame * 1.8) : frame;
  const lockStile = Math.min(0.135, width * 0.32);
  const leftRail = latchSide === -1 ? lockStile : frame;
  const rightRail = latchSide === 1 ? lockStile : frame;
  const sash = useMemo(
    () =>
      detailed
        ? sashGeometry(width, height, frame, frameDepth, bottomRail, leftRail, rightRail)
        : null,
    [width, height, frame, frameDepth, bottomRail, leftRail, rightRail, detailed],
  );
  useEffect(() => () => sash?.dispose(), [sash]);
  const innerWidth = Math.max(0.02, width - leftRail - rightRail);
  const innerHeight = Math.max(0.02, height - bottomRail - frame);
  const centerX = (leftRail - rightRail) / 2;
  const centerY = (bottomRail - frame) / 2;
  const rowPositions =
    privacy && rows === 2
      ? [-innerHeight * 0.18]
      : Array.from(
          { length: Math.max(0, rows - 1) },
          (_, index) => -innerHeight / 2 + innerHeight * ((index + 1) / rows),
        );

  return (
    <group>
      <mesh position={[centerX, centerY, 0]} receiveShadow>
        <boxGeometry args={[innerWidth, innerHeight, 0.024]} />
        <ArchitecturalGlass privacy={privacy} />
      </mesh>
      {sash ? (
        <mesh geometry={sash} castShadow receiveShadow>
          {doorFinish ? (
            <JoineryMaterial color={frameColor} finish={doorFinish} vertexColors />
          ) : (
            <ToonMaterial color={frameColor} vertexColors />
          )}
        </mesh>
      ) : (
        ([-1, 1] as const).map((side) => (
          <group key={side}>
            <OpeningFrameBox
              size={[frame, height, frameDepth]}
              position={[side * (width / 2 - frame / 2), 0, 0]}
              color={frameColor}
            />
            <OpeningFrameBox
              size={[width, frame, frameDepth]}
              position={[0, side * (height / 2 - frame / 2), 0]}
              color={frameColor}
            />
          </group>
        ))
      )}
      {Array.from({ length: Math.max(0, columns - 1) }, (_, index) => (
        <OpeningFrameBox
          key={`column-${index}`}
          size={[0.026, innerHeight, frameDepth * 0.7]}
          position={[
            centerX - innerWidth / 2 + innerWidth * ((index + 1) / columns),
            centerY,
            0.014,
          ]}
          color={frameColor}
        />
      ))}
      {rowPositions.map((position, index) => (
        <OpeningFrameBox
          key={`row-${index}`}
          size={[innerWidth, privacy ? 0.022 : 0.026, frameDepth * 0.7]}
          position={[centerX, centerY + position, 0.014]}
          color={frameColor}
        />
      ))}
    </group>
  );
}
