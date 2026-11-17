import { isGardenGate, omitUndefinedProperties, useDetailedJoinery } from "@cabane/engine";
import { PanelDoorSurface } from "./panel-door-surface";
import { gardenGateColor } from "../../../door-presets";
import { GardenGateLeaf } from "./garden-gate-leaf";
import { WhiteLeverDoorHandles } from "./white-lever-door-handles";
import { ConcealedDoorLeaf } from "./concealed-door-leaf";
import { FlushDoorLeaf } from "./flush-door-leaf";
import { ArchedSteelGlassPanel } from "../steel-glazing";
import { RoundedBox } from "@cabane/engine";
import { Outlines, ToonMaterial } from "@cabane/engine";
import type { DoorSpec } from "@cabane/engine";
import { FramedGlassPanel } from "../windows/framed-glass-panel";
import { GlassDoorHandle } from "./glass-door-handle";
import { PanelDoorHandles } from "./panel-door-handles";
import { PlankDoorLeaf } from "./plank-door-leaf";

export function DoorLeaf({
  opening,
  width,
  height,
  handleSide,
  plankDepthScale = 1,
}: {
  opening: DoorSpec;
  width: number;
  height: number;
  handleSide: -1 | 1;
  plankDepthScale?: number;
}) {
  const detailed = useDetailedJoinery();
  const white = opening.finish === "white";
  const frameColor = opening.color ?? (white ? "#d8d2c6" : "#9c6b49");

  if (isGardenGate(opening.variant))
    return (
      <GardenGateLeaf
        detailed={detailed}
        finish={opening.finish}
        variant={opening.variant}
        width={width}
        height={height}
        color={opening.color ?? gardenGateColor(opening.variant, opening.finish)}
        handleSide={handleSide}
      />
    );

  if (opening.variant === "concealed")
    return (
      <ConcealedDoorLeaf
        width={width}
        height={height}
        finish={opening.finish}
        {...omitUndefinedProperties({ color: opening.color })}
        handleSide={handleSide}
      />
    );
  if (opening.variant === "flush" || opening.variant === "flush-knob")
    return (
      <FlushDoorLeaf
        width={width}
        height={height}
        finish={opening.finish}
        {...omitUndefinedProperties({ color: opening.color })}
        handleSide={handleSide}
        knob={opening.variant === "flush-knob"}
      />
    );
  if (opening.variant === "steel-arched")
    return (
      <group>
        <ArchedSteelGlassPanel
          door
          width={width}
          height={height}
          {...omitUndefinedProperties({ frameColor: opening.color })}
        />
        <GlassDoorHandle width={width} side={handleSide} />
      </group>
    );
  if (opening.variant === "french" || opening.variant === "full-glass") {
    return (
      <group>
        <FramedGlassPanel
          width={width}
          height={height}
          columns={opening.variant === "french" ? 2 : 1}
          rows={opening.variant === "french" ? 5 : 1}
          frameColor={frameColor}
          slidingSash={
            detailed && opening.variant === "full-glass" && opening.operation === "sliding"
          }
          {...(detailed && {
            doorFinish: opening.variant === "full-glass" ? "metal" : white ? "paint" : "wood",
          })}
          {...(detailed && opening.variant === "french" && { latchSide: handleSide })}
        />
        {opening.variant === "french" ? (
          <PanelDoorHandles width={width} side={handleSide} sash={detailed} />
        ) : (
          <GlassDoorHandle width={width} side={handleSide} />
        )}
      </group>
    );
  }

  if (opening.variant === "plank") {
    return (
      <PlankDoorLeaf
        width={width}
        height={height}
        handleSide={handleSide}
        finish={opening.finish}
        {...omitUndefinedProperties({ color: opening.color })}
        depthScale={plankDepthScale}
        railHangers={opening.operation === "sliding"}
      />
    );
  }

  return (
    <group>
      {detailed ? (
        <PanelDoorSurface
          width={width}
          height={height}
          finish={opening.finish}
          color={opening.color ?? (white ? "#f1f0eb" : "#b89a73")}
        />
      ) : (
        <RoundedBox args={[width, height, 0.05]} radius={0.018} smoothness={3} castShadow>
          <ToonMaterial color={opening.color ?? (white ? "#f1f0eb" : "#b89a73")} />
          <Outlines
            color={white ? "#676965" : "#493c31"}
            thickness={white ? 0.008 : 0.01}
            screenspace={false}
          />
        </RoundedBox>
      )}
      {opening.variant === "panel-white-lever" ? (
        <WhiteLeverDoorHandles width={width} side={handleSide} />
      ) : (
        <PanelDoorHandles width={width} side={handleSide} />
      )}
    </group>
  );
}
