import { keys, record, string, finite } from "./schema-json-values";
import { doorDesignErrors } from "../door-design-validation";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

export const openingSchema = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  const base = [
    "id",
    "name",
    "wallId",
    "kind",
    "offsetFromWallStartPlanUnits",
    "widthPlanUnits",
    "openingHeightMeters",
    "sillHeightMeters",
  ];
  const kindKeys =
    candidate.kind === "door"
      ? [
          "operation",
          "variant",
          "finish",
          "color",
          "leafCount",
          "hingeSide",
          "openingSide",
          "slideDirection",
          "frontOverlayMeters",
          "frontSide",
        ]
      : candidate.kind === "window"
        ? [
            "operation",
            "variant",
            "panelCount",
            "glazing",
            "muntins",
            "hingeSide",
            "openingSide",
            "color",
          ]
        : candidate.kind === "passage"
          ? ["variant", "archRiseMeters"]
          : [];
  keys(candidate, [...base, ...kindKeys], path, issues);
  string(candidate.id, `${path}.id`, issues);
  if (candidate.name !== undefined) string(candidate.name, `${path}.name`, issues);
  string(candidate.wallId, `${path}.wallId`, issues);
  for (const key of [
    "offsetFromWallStartPlanUnits",
    "widthPlanUnits",
    "openingHeightMeters",
    "sillHeightMeters",
  ]) {
    finite(candidate[key], `${path}.${key}`, issues);
  }
  if (candidate.kind === "door" || candidate.kind === "window") {
    if (
      candidate.color !== undefined &&
      (typeof candidate.color !== "string" || !/^#[0-9a-f]{6}$/i.test(candidate.color))
    )
      addProjectIssue(
        issues,
        "project.opening-color",
        `${path}.color`,
        "Choose a six-digit hex opening color.",
      );
    for (const [key, allowed] of Object.entries({
      hingeSide: ["start", "end"],
      openingSide: ["left", "right"],
      ...(candidate.kind === "door" ? { slideDirection: ["start", "end"] } : {}),
    })) {
      if (
        candidate[key] !== undefined &&
        !allowed.includes(typeof candidate[key] === "string" ? candidate[key] : "")
      ) {
        addProjectIssue(
          issues,
          "project.opening-orientation",
          `${path}.${key}`,
          `${key} must be ${allowed.join(" or ")}.`,
        );
      }
    }
  }
  if (candidate.kind === "door") {
    for (const error of doorDesignErrors(candidate))
      addProjectIssue(issues, `project.door-${error.code}`, `${path}.${error.key}`, error.message);
  } else if (candidate.kind === "window") {
    if (!["fixed", "casement"].includes(String(candidate.operation)))
      addProjectIssue(
        issues,
        "project.window-operation",
        `${path}.operation`,
        "Window operation is invalid.",
      );
    if (!["plain", "muntined", "steel-arched"].includes(String(candidate.variant)))
      addProjectIssue(
        issues,
        "project.window-variant",
        `${path}.variant`,
        "Window variant is invalid.",
      );
    if (![1, 2].includes(candidate.panelCount as number))
      addProjectIssue(
        issues,
        "project.window-panel-count",
        `${path}.panelCount`,
        "Window panelCount is invalid.",
      );
    if (!["clear", "privacy"].includes(String(candidate.glazing)))
      addProjectIssue(
        issues,
        "project.window-glazing",
        `${path}.glazing`,
        "Window glazing is invalid.",
      );
    if (candidate.muntins !== undefined) {
      const muntins = record(candidate.muntins, `${path}.muntins`, issues);
      if (muntins) {
        keys(muntins, ["columns", "rows"], `${path}.muntins`, issues);
        finite(muntins.columns, `${path}.muntins.columns`, issues);
        finite(muntins.rows, `${path}.muntins.rows`, issues);
      }
    }
  } else if (candidate.kind === "passage") {
    if (!["rectangular", "arched"].includes(String(candidate.variant)))
      addProjectIssue(
        issues,
        "project.passage-variant",
        `${path}.variant`,
        "Passage variant is invalid.",
      );
    if (candidate.variant === "arched") {
      if (
        typeof candidate.archRiseMeters !== "number" ||
        !Number.isFinite(candidate.archRiseMeters)
      ) {
        addProjectIssue(
          issues,
          "project.passage-arch-rise",
          `${path}.archRiseMeters`,
          "Arched passages require a finite archRiseMeters value.",
        );
      }
    } else if (candidate.variant === "rectangular" && candidate.archRiseMeters !== undefined) {
      addProjectIssue(
        issues,
        "project.passage-arch-rise",
        `${path}.archRiseMeters`,
        "Rectangular passages must not declare archRiseMeters.",
      );
    }
  } else {
    addProjectIssue(issues, "project.opening-kind", `${path}.kind`, "Opening kind is invalid.");
  }
};
