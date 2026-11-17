import { GARDEN_GATE_VARIANTS } from "./garden-gate";

/** Shared schema/manifest checks for the discriminated door design. */
export function doorDesignErrors(
  door: Record<string, unknown>,
): readonly { key: string; code: string; message: string }[] {
  const errors: { key: string; code: string; message: string }[] = [];
  const require = (valid: boolean, key: string, message: string) => {
    if (!valid)
      errors.push({
        key,
        code: key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        message,
      });
  };
  if (door.frontOverlayMeters !== undefined) {
    require((door.variant === "flush" ||
      (door.variant === "flush-knob" && door.frontOverlayMeters === 0)) &&
      typeof door.frontOverlayMeters === "number" &&
      Number.isFinite(door.frontOverlayMeters) &&
      door.frontOverlayMeters >= 0 &&
      door.frontOverlayMeters <=
        0.03, "frontOverlayMeters", "Flush-front overlay must be between 0 and 3 cm.");
  }
  if (door.frontSide !== undefined)
    require(door.variant === "concealed" &&
      (door.frontSide === "left" ||
        door.frontSide ===
          "right"), "frontSide", "Only concealed doors have a separate flush face.");
  const rollUp = door.operation === "roll-up";
  require(["hinged", "sliding", "roll-up"].includes(
    String(door.operation),
  ), "operation", "Door motion must be hinged, sliding, or roll-up.");
  require((rollUp
    ? ["slatted"]
    : [
        "panel",
        "panel-white-lever",
        "french",
        "full-glass",
        "steel-arched",
        "concealed",
        "flush-knob",
        "flush",
        "plank",
        ...(door.operation === "hinged" ? GARDEN_GATE_VARIANTS : []),
      ]
  ).includes(String(door.variant)), "variant", "Door style must match its motion.");
  require(["wood", "white"].includes(
    String(door.finish),
  ), "finish", "Door finish must be wood or white.");
  require(rollUp
    ? door.leafCount === undefined
    : [1, 2].includes(door.leafCount as number), "leafCount", rollUp
    ? "Roll-up doors do not have leaves."
    : "Door leaf count must be 1 or 2.");
  require(door.operation === "hinged" ||
    door.hingeSide === undefined, "hingeSide", "Only hinged doors have a hinge side.");
  require(door.operation === "sliding" ||
    door.slideDirection ===
      undefined, "slideDirection", "Only sliding doors have a slide direction.");
  require(rollUp ||
    door.coverSlot === undefined, "coverSlot", "Only roll-up doors have a cover slot.");
  return errors;
}
