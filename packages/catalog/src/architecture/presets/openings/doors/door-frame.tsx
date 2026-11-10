import { DOOR_FRAME_JAMB_WIDTH_METERS } from "./door-frame-dimensions";
import { Outlines, ToonMaterial } from "@cabane/engine";

export function DoorFrame({
  width,
  height,
  depth,
  color = "#d8d2c6",
  openTop = false,
}: {
  width: number;
  height: number;
  depth: number;
  color?: string;
  openTop?: boolean;
}) {
  const jambHeight = openTop ? height : height + 0.08;
  return (
    <>
      {[
        [0, height / 2, DOOR_FRAME_JAMB_WIDTH_METERS, jambHeight],
        [width, height / 2, DOOR_FRAME_JAMB_WIDTH_METERS, jambHeight],
        // Cover the lintel underside without sharing its plane or touching the leaf.
        [width / 2, height + 0.031, width + DOOR_FRAME_JAMB_WIDTH_METERS, 0.078],
      ]
        .slice(0, openTop ? 2 : 3)
        .map(([x, y, itemWidth, itemHeight], index) => (
          <mesh name={`opening-door-frame-${index}`} key={index} position={[x, y, 0]} castShadow>
            <boxGeometry args={[itemWidth, itemHeight, depth]} />
            <ToonMaterial color={color} />
            <Outlines color="#676965" thickness={0.006} screenspace={false} />
          </mesh>
        ))}
    </>
  );
}
