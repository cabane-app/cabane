import { entitySlot } from "./schema-entity-slot";
import { keys, record, array, string, finite, point } from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

const placement = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  if (candidate.kind === "absolute") {
    keys(candidate, ["kind", "at", "elevationMeters", "rotationYRadians"], path, issues);
    point(candidate.at, `${path}.at`, issues);
    finite(candidate.elevationMeters, `${path}.elevationMeters`, issues);
    finite(candidate.rotationYRadians, `${path}.rotationYRadians`, issues);
  } else if (candidate.kind === "wall") {
    keys(
      candidate,
      [
        "kind",
        "wallId",
        "face",
        "offsetFromWallStartPlanUnits",
        "elevationMeters",
        "depthOffsetMeters",
        "rotationOffsetRadians",
      ],
      path,
      issues,
    );
    string(candidate.wallId, `${path}.wallId`, issues);
    if (!["left", "right"].includes(String(candidate.face)))
      addProjectIssue(
        issues,
        "project.wall-face",
        `${path}.face`,
        "Wall placement face is invalid.",
      );
    for (const key of [
      "offsetFromWallStartPlanUnits",
      "elevationMeters",
      "depthOffsetMeters",
      "rotationOffsetRadians",
    ])
      finite(candidate[key], `${path}.${key}`, issues);
  } else if (candidate.kind === "ceiling") {
    keys(candidate, ["kind", "roomId", "at", "dropMeters", "rotationYRadians"], path, issues);
    string(candidate.roomId, `${path}.roomId`, issues);
    point(candidate.at, `${path}.at`, issues);
    finite(candidate.dropMeters, `${path}.dropMeters`, issues);
    finite(candidate.rotationYRadians, `${path}.rotationYRadians`, issues);
  } else {
    keys(candidate, ["kind"], path, issues);
    addProjectIssue(
      issues,
      "project.placement-kind",
      `${path}.kind`,
      "Item placement kind is invalid.",
    );
  }
};

export const sceneItem = (
  value: unknown,
  path: string,
  issues: HomeProjectIssue[],
  legacy: boolean,
) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  const device = candidate.kind === "device";
  keys(
    candidate,
    device
      ? [
          "id",
          "floorId",
          "kind",
          "modelId",
          "variant",
          "placement",
          "size",
          "entitySlots",
          "lightState",
          "color",
          "lightSlotId",
          "group",
        ]
      : [
          "id",
          "floorId",
          "kind",
          "modelId",
          "variant",
          "placement",
          "size",
          "color",
          "entitySlots",
          "lightSlotId",
          "lightState",
          "group",
        ],
    path,
    issues,
  );
  if (candidate.group !== undefined) {
    const group = record(candidate.group, `${path}.group`, issues);
    if (group) {
      keys(group, ["id", "name"], `${path}.group`, issues);
      for (const key of ["id", "name"]) {
        string(group[key], `${path}.group.${key}`, issues);
        if (typeof group[key] === "string" && !group[key].trim())
          addProjectIssue(
            issues,
            "project.item-group",
            `${path}.group.${key}`,
            "Groups need an ID and a name.",
          );
      }
    }
  }
  if (candidate.lightSlotId !== undefined)
    string(candidate.lightSlotId, `${path}.lightSlotId`, issues);
  string(candidate.id, `${path}.id`, issues);
  string(candidate.modelId, `${path}.modelId`, issues);
  if (candidate.variant !== undefined) string(candidate.variant, `${path}.variant`, issues);
  if (
    candidate.color !== undefined &&
    (typeof candidate.color !== "string" || !/^#[0-9a-f]{6}$/i.test(candidate.color))
  )
    addProjectIssue(
      issues,
      "project.item-color",
      `${path}.color`,
      "Choose a six-digit hex fabric color.",
    );
  if (!legacy) string(candidate.floorId, `${path}.floorId`, issues);
  if (!["furnishing", "device"].includes(String(candidate.kind)))
    addProjectIssue(issues, "project.item-kind", `${path}.kind`, "Scene item kind is invalid.");
  placement(candidate.placement, `${path}.placement`, issues);
  const size = array(candidate.size, `${path}.size`, issues);
  if (size && size.length !== 3)
    addProjectIssue(
      issues,
      "project.item-size-shape",
      `${path}.size`,
      "Item size requires exactly three dimensions.",
    );
  size?.forEach((entry, index) => finite(entry, `${path}.size[${index}]`, issues));
  if (
    candidate.lightState !== undefined &&
    (typeof candidate.lightState !== "string" ||
      !["always-off", "always-on", "night-only", "connected"].includes(candidate.lightState))
  ) {
    addProjectIssue(
      issues,
      "project.light-state",
      `${path}.lightState`,
      "Choose always-off, always-on, night-only, or connected.",
    );
  }
  if (device || candidate.entitySlots !== undefined)
    array(candidate.entitySlots, `${path}.entitySlots`, issues)?.forEach((entry, index) =>
      entitySlot(entry, `${path}.entitySlots[${index}]`, issues),
    );
};
