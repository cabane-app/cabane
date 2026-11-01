import { junctionOccupiedIntervalsForWall } from "../opening-junction-clearance";
import { doorDesignErrors } from "../door-design-validation";
import { wallLengthPlanUnits } from "../geometry";

import type { ManifestIssue, OpeningSpec } from "../types";

import {
  extensionHas,
  isFiniteNumber,
  isNonEmptyString,
  isObject,
  isPlanPoint,
  issue,
  registerId,
  type RawObject,
  type ValidationContext,
} from "./core";

import { ValidJunction, ValidWall } from "./architecture-validation-contract";
import { JUNCTION_EPSILON } from "./geometry";

export const validateOpenings = (
  rawFloor: RawObject,
  floorPath: string,
  walls: readonly unknown[],
  wallIds: Set<string>,
  validWalls: readonly ValidWall[],
  validJunctions: readonly ValidJunction[],
  context: ValidationContext,
) => {
  const issues: ManifestIssue[] = [];
  const openingsByWall = new Map<string, Array<{ opening: OpeningSpec; path: string }>>();
  const openings = Array.isArray(rawFloor.openings) ? rawFloor.openings : [];
  if (!Array.isArray(rawFloor.openings)) {
    issues.push(issue("openings.type", `${floorPath}.openings`, "Openings must be an array."));
  }
  openings.forEach((rawOpening, openingIndex) => {
    const openingPath = `${floorPath}.openings[${openingIndex}]`;
    if (!isObject(rawOpening)) {
      issues.push(issue("opening.type", openingPath, "Each opening must be an object."));
      return;
    }
    issues.push(...registerId(context, rawOpening.id, `${openingPath}.id`));
    if (!isNonEmptyString(rawOpening.wallId) || !wallIds.has(rawOpening.wallId)) {
      issues.push(
        issue("opening.wall", `${openingPath}.wallId`, "Opening must reference an existing wall."),
      );
    }
    if (!["door", "window", "passage"].includes(String(rawOpening.kind))) {
      issues.push(
        issue(
          "opening.kind",
          `${openingPath}.kind`,
          "Opening kind must be door, window, or passage.",
        ),
      );
    }
    for (const key of [
      "offsetFromWallStartPlanUnits",
      "widthPlanUnits",
      "openingHeightMeters",
      "sillHeightMeters",
    ] as const) {
      if (
        !isFiniteNumber(rawOpening[key]) ||
        (key === "sillHeightMeters" ? rawOpening[key] < 0 : rawOpening[key] <= 0)
      ) {
        issues.push(
          issue("opening.dimension", `${openingPath}.${key}`, `${key} has an invalid dimension.`),
        );
      }
    }
    const wall = walls.find(
      (candidate): candidate is RawObject =>
        isObject(candidate) && candidate.id === rawOpening.wallId,
    );
    if (wall?.virtual === true) {
      issues.push(
        issue(
          "opening.virtual-wall",
          `${openingPath}.wallId`,
          "A virtual wall cannot host an opening.",
        ),
      );
    }
    if (
      wall &&
      isPlanPoint(wall.from) &&
      isPlanPoint(wall.to) &&
      isFiniteNumber(rawOpening.offsetFromWallStartPlanUnits) &&
      isFiniteNumber(rawOpening.widthPlanUnits) &&
      rawOpening.offsetFromWallStartPlanUnits + rawOpening.widthPlanUnits >
        wallLengthPlanUnits(wall as never) + 1e-8
    ) {
      issues.push(
        issue("opening.containment", openingPath, "Opening must fit completely inside its wall."),
      );
    }
    if (
      isNonEmptyString(rawOpening.visualModel) &&
      !extensionHas(context.input, "openingModels", rawOpening.visualModel)
    ) {
      issues.push(
        issue(
          "opening.model-extension",
          `${openingPath}.visualModel`,
          `Opening extension "${rawOpening.visualModel}" is not registered.`,
        ),
      );
    }
    if (rawOpening.kind === "door" || rawOpening.kind === "window") {
      for (const [key, allowed] of Object.entries({
        hingeSide: ["start", "end"],
        openingSide: ["left", "right"],
        ...(rawOpening.kind === "door" ? { slideDirection: ["start", "end"] } : {}),
      })) {
        if (
          rawOpening[key] !== undefined &&
          !allowed.includes(typeof rawOpening[key] === "string" ? rawOpening[key] : "")
        ) {
          issues.push(
            issue(
              "opening.orientation",
              `${openingPath}.${key}`,
              `${key} must be ${allowed.join(" or ")}.`,
            ),
          );
        }
      }
    }
    if (rawOpening.kind === "door") {
      for (const error of doorDesignErrors(rawOpening))
        issues.push(
          issue(`opening.door-${error.code}`, `${openingPath}.${error.key}`, error.message),
        );
      if (rawOpening.walkThrough !== undefined) {
        issues.push(
          issue(
            "opening.door-walk-through",
            `${openingPath}.walkThrough`,
            "Doors are walk-through openings by definition and must not declare walkThrough.",
          ),
        );
      }
      if (rawOpening.sillHeightMeters !== 0) {
        issues.push(
          issue(
            "opening.door-sill",
            `${openingPath}.sillHeightMeters`,
            "Doors must start at floor level.",
          ),
        );
      }
    } else if (rawOpening.kind === "window") {
      if (!["fixed", "casement"].includes(String(rawOpening.operation))) {
        issues.push(
          issue(
            "opening.window-operation",
            `${openingPath}.operation`,
            "Window operation must be fixed or casement.",
          ),
        );
      }
      if (!["plain", "muntined", "steel-arched"].includes(String(rawOpening.variant))) {
        issues.push(
          issue(
            "opening.window-variant",
            `${openingPath}.variant`,
            "Window variant must be plain, muntined or steel-arched.",
          ),
        );
      }
      if (![1, 2].includes(Number(rawOpening.panelCount))) {
        issues.push(
          issue(
            "opening.window-panel-count",
            `${openingPath}.panelCount`,
            "Window panelCount must be 1 or 2.",
          ),
        );
      }
      if (!["clear", "privacy"].includes(String(rawOpening.glazing))) {
        issues.push(
          issue(
            "opening.window-glazing",
            `${openingPath}.glazing`,
            "Window glazing must be clear or privacy.",
          ),
        );
      }
      if (rawOpening.variant === "muntined") {
        const muntins = rawOpening.muntins;
        if (
          !isObject(muntins) ||
          typeof muntins.columns !== "number" ||
          !Number.isInteger(muntins.columns) ||
          muntins.columns < 1 ||
          muntins.columns > 6 ||
          typeof muntins.rows !== "number" ||
          !Number.isInteger(muntins.rows) ||
          muntins.rows < 1 ||
          muntins.rows > 6
        ) {
          issues.push(
            issue(
              "opening.window-muntins",
              `${openingPath}.muntins`,
              "Muntined windows require integer columns and rows between 1 and 6.",
            ),
          );
        }
      } else if (rawOpening.muntins !== undefined) {
        issues.push(
          issue(
            "opening.window-muntins",
            `${openingPath}.muntins`,
            "Plain windows must not declare muntins.",
          ),
        );
      }
      if (rawOpening.walkThrough !== undefined) {
        issues.push(
          issue(
            "opening.window-walk-through",
            `${openingPath}.walkThrough`,
            "Windows cannot be walk-through openings.",
          ),
        );
      }
    } else if (rawOpening.kind === "passage") {
      if (!["rectangular", "arched"].includes(String(rawOpening.variant))) {
        issues.push(
          issue(
            "opening.passage-variant",
            `${openingPath}.variant`,
            "Passage variant must be rectangular or arched.",
          ),
        );
      }
      if (rawOpening.sillHeightMeters !== 0) {
        issues.push(
          issue(
            "opening.passage-sill",
            `${openingPath}.sillHeightMeters`,
            "Passages must start at floor level.",
          ),
        );
      }
      if (
        rawOpening.variant === "arched" &&
        (!isFiniteNumber(rawOpening.archRiseMeters) ||
          rawOpening.archRiseMeters <= 0 ||
          !isFiniteNumber(rawOpening.openingHeightMeters) ||
          rawOpening.archRiseMeters >= rawOpening.openingHeightMeters)
      ) {
        issues.push(
          issue(
            "opening.passage-arch-rise",
            `${openingPath}.archRiseMeters`,
            "Arched passages require a positive archRiseMeters below the opening height.",
          ),
        );
      } else if (rawOpening.variant === "rectangular" && rawOpening.archRiseMeters !== undefined) {
        issues.push(
          issue(
            "opening.passage-arch-rise",
            `${openingPath}.archRiseMeters`,
            "Rectangular passages must not declare archRiseMeters.",
          ),
        );
      }
      if (rawOpening.contactSlot !== undefined) {
        issues.push(
          issue(
            "opening.passage-contact",
            `${openingPath}.contactSlot`,
            "Passages cannot declare contact slots.",
          ),
        );
      }
    }
    if (rawOpening.coverSlot !== undefined) {
      if (
        rawOpening.kind !== "door" ||
        rawOpening.operation !== "roll-up" ||
        !isObject(rawOpening.coverSlot)
      ) {
        issues.push(
          issue(
            "opening.cover-slot",
            `${openingPath}.coverSlot`,
            "Only roll-up doors support a cover slot object.",
          ),
        );
      } else {
        issues.push(...registerId(context, rawOpening.coverSlot.id, `${openingPath}.coverSlot.id`));
        if (!["manual", "unique-compatible"].includes(String(rawOpening.coverSlot.autoMap)))
          issues.push(
            issue(
              "opening.cover-auto-map",
              `${openingPath}.coverSlot.autoMap`,
              "Invalid cover mapping policy.",
            ),
          );
      }
    }
    if (rawOpening.contactSlot !== undefined) {
      if (!isObject(rawOpening.contactSlot)) {
        issues.push(
          issue(
            "opening.contact-slot",
            `${openingPath}.contactSlot`,
            "Opening contact slot must be an object.",
          ),
        );
      } else {
        issues.push(
          ...registerId(context, rawOpening.contactSlot.id, `${openingPath}.contactSlot.id`),
        );
        if (
          !Array.isArray(rawOpening.contactSlot.compatibleDeviceClasses) ||
          rawOpening.contactSlot.compatibleDeviceClasses.length === 0 ||
          rawOpening.contactSlot.compatibleDeviceClasses.some(
            (deviceClass) => !["door", "window", "opening"].includes(String(deviceClass)),
          )
        ) {
          issues.push(
            issue(
              "opening.contact-device-class",
              `${openingPath}.contactSlot.compatibleDeviceClasses`,
              "Opening contacts require door, window, or opening device classes.",
            ),
          );
        }
        if (!["on", "off"].includes(String(rawOpening.contactSlot.openState))) {
          issues.push(
            issue(
              "opening.contact-open-state",
              `${openingPath}.contactSlot.openState`,
              "Opening contact openState must be on or off.",
            ),
          );
        }
        if (!["unique-compatible", "manual"].includes(String(rawOpening.contactSlot.autoMap))) {
          issues.push(
            issue(
              "opening.contact-auto-map",
              `${openingPath}.contactSlot.autoMap`,
              "Opening contact autoMap must be unique-compatible or manual.",
            ),
          );
        }
      }
    }
    if (isNonEmptyString(rawOpening.wallId)) {
      const list = openingsByWall.get(rawOpening.wallId) ?? [];
      list.push({ opening: rawOpening as unknown as OpeningSpec, path: openingPath });
      openingsByWall.set(rawOpening.wallId, list);
    }
  });

  for (const list of openingsByWall.values()) {
    list.sort(
      (left, right) =>
        left.opening.offsetFromWallStartPlanUnits - right.opening.offsetFromWallStartPlanUnits,
    );
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1].opening;
      const current = list[index].opening;
      if (
        current.offsetFromWallStartPlanUnits <
        previous.offsetFromWallStartPlanUnits + previous.widthPlanUnits - 1e-8
      ) {
        issues.push(
          issue(
            "opening.overlap",
            list[index].path,
            `Opening overlaps "${previous.id}" on the same wall.`,
          ),
        );
      }
    }
  }

  const metersPerPlanUnit =
    isObject(rawFloor.coordinates) &&
    isFiniteNumber(rawFloor.coordinates.metersPerPlanUnit) &&
    rawFloor.coordinates.metersPerPlanUnit > 0
      ? rawFloor.coordinates.metersPerPlanUnit
      : null;
  if (metersPerPlanUnit) {
    for (const junction of validJunctions) {
      const incidentWalls = validWalls.filter((wall) => junction.wallIds.includes(wall.id));
      for (const wall of incidentWalls) {
        const wallLength = wallLengthPlanUnits(wall as never);
        const dx = (wall.to[0] - wall.from[0]) / wallLength;
        const dy = (wall.to[1] - wall.from[1]) / wallLength;
        const distance =
          (junction.at[0] - wall.from[0]) * dx + (junction.at[1] - wall.from[1]) * dy;
        const occupiedIntervals = junctionOccupiedIntervalsForWall(
          wall,
          junction,
          incidentWalls,
          metersPerPlanUnit,
          typeof rawFloor.defaultWallHeightMeters === "number"
            ? rawFloor.defaultWallHeightMeters
            : 2.5,
        );
        for (const candidate of openingsByWall.get(wall.id) ?? []) {
          const openingStart = candidate.opening.offsetFromWallStartPlanUnits;
          const openingEnd = openingStart + candidate.opening.widthPlanUnits;
          if (
            occupiedIntervals.some(
              ({ start, end, topMeters }) =>
                topMeters > candidate.opening.sillHeightMeters + JUNCTION_EPSILON &&
                distance + end > openingStart + JUNCTION_EPSILON &&
                distance + start < openingEnd - JUNCTION_EPSILON,
            )
          ) {
            issues.push(
              issue(
                "wall-junction.opening-overlap",
                junction.path,
                `Junction overlaps opening "${candidate.opening.id}" on wall "${wall.id}".`,
              ),
            );
          }
        }
      }
    }
  }
  return issues;
};
