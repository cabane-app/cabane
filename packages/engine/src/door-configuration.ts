import type { DoorConfiguration, DoorSpec } from "./types";
export const DEFAULT_DOOR_CONFIGURATION: DoorConfiguration = {
  kind: "door",
  operation: "hinged",
  variant: "panel",
  finish: "wood",
  leafCount: 1,
  widthMeters: 0.9,
  heightMeters: 2.04,
};

export function doorFromConfiguration(
  configuration: DoorConfiguration,
  metersPerPlanUnit: number,
  placement: Pick<DoorSpec, "id" | "wallId" | "offsetFromWallStartPlanUnits">,
): DoorSpec {
  const { widthMeters, heightMeters, ...design } = configuration;
  return {
    ...design,
    id: placement.id,
    wallId: placement.wallId,
    offsetFromWallStartPlanUnits: placement.offsetFromWallStartPlanUnits,
    widthPlanUnits: widthMeters / metersPerPlanUnit,
    openingHeightMeters: heightMeters,
    sillHeightMeters: 0,
  };
}
export function doorConfiguration(door: DoorSpec, metersPerPlanUnit: number): DoorConfiguration {
  const {
    id: _id,
    name: _name,
    wallId: _wall,
    offsetFromWallStartPlanUnits: _offset,
    widthPlanUnits,
    openingHeightMeters,
    sillHeightMeters: _sill,
    visualModel: _model,
    contactSlot: _contact,
    coverSlot: _cover,
    ...design
  } = door;
  return {
    ...design,
    widthMeters: widthPlanUnits * metersPerPlanUnit,
    heightMeters: openingHeightMeters,
  };
}
