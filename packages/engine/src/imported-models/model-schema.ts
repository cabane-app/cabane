import { validateModelLighting, validateModelLightOverrides } from "../model-lighting/schema";
import { keys, record, array, string, finite } from "../home-project/schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "../home-project/validation-types";
import { CUSTOM_MODEL_LIMITS, CUSTOM_MODEL_PROFILES } from "./contracts";

const vector = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const values = array(value, path, issues);
  if (values?.length !== 3)
    addProjectIssue(issues, "project.model-vector", path, "Expected three finite coordinates.");
  values?.forEach((n, i) => finite(n, `${path}[${i}]`, issues));
};

export function validateCustomModels(
  value: unknown,
  issues: HomeProjectIssue[],
  pathRoot = "customModels",
) {
  const ids = new Set<string>();
  const assets = new Map<string, number>();
  array(value, pathRoot, issues)?.forEach((input, i) => {
    const path = `${pathRoot}[${i}]`;
    const model = record(input, path, issues);
    if (!model) return;
    keys(
      model,
      ["id", "name", "placement", "profile", "asset", "normalization", "complexity", "light"],
      path,
      issues,
    );
    const error = (key: string, message: string) =>
      addProjectIssue(issues, "project.custom-model", `${path}.${key}`, message);
    if (
      typeof model.id !== "string" ||
      !/^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model.id) ||
      ids.has(model.id)
    )
      error("id", "Custom model IDs must be unique custom:UUID values.");
    else ids.add(model.id);
    string(model.name, `${path}.name`, issues);
    if (!["floor", "wall", "ceiling"].includes(String(model.placement)))
      error("placement", "Choose Floor, Wall or Ceiling.");
    if (!CUSTOM_MODEL_PROFILES.some(([id]) => id === model.profile))
      error("profile", "Choose an existing device profile or Furniture.");
    const asset = record(model.asset, `${path}.asset`, issues);
    if (asset) {
      keys(asset, ["sha256", "byteLength"], `${path}.asset`, issues);
      if (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(asset.sha256))
        error("asset.sha256", "The asset reference must be a SHA-256 hash.");
      if (
        !Number.isSafeInteger(asset.byteLength) ||
        (asset.byteLength as number) <= 0 ||
        (asset.byteLength as number) > CUSTOM_MODEL_LIMITS.fileBytes
      )
        error("asset.byteLength", "GLB files must be at most 10 MiB.");
      if (assets.has(String(asset.sha256)) && assets.get(String(asset.sha256)) !== asset.byteLength)
        error("asset.byteLength", "References to the same file must have the same size.");
      assets.set(String(asset.sha256), Number(asset.byteLength));
    }
    const normalization = record(model.normalization, `${path}.normalization`, issues);
    if (normalization) {
      keys(
        normalization,
        ["rotation", "scale", "offset", "size", "bounds"],
        `${path}.normalization`,
        issues,
      );
      for (const key of ["rotation", "offset", "size"])
        vector(normalization[key], `${path}.normalization.${key}`, issues);
      finite(normalization.scale, `${path}.normalization.scale`, issues);
      if (Number(normalization.scale) <= 0) error("normalization.scale", "Scale must be positive.");
      if (Array.isArray(normalization.size) && normalization.size.some((n) => n <= 0))
        error("normalization.size", "Dimensions must be positive metres.");
      const bounds = record(normalization.bounds, `${path}.normalization.bounds`, issues);
      if (bounds) {
        keys(bounds, ["min", "max"], `${path}.normalization.bounds`, issues);
        vector(bounds.min, `${path}.normalization.bounds.min`, issues);
        vector(bounds.max, `${path}.normalization.bounds.max`, issues);
        if (
          Array.isArray(bounds.min) &&
          Array.isArray(bounds.max) &&
          Array.isArray(normalization.size) &&
          bounds.min.some(
            (n, axis) =>
              (bounds.max && (bounds.max as number[])[axis] <= n) ||
              Math.abs(
                (bounds.max as number[])[axis] - n - (normalization.size as number[])[axis],
              ) > 0.00001,
          )
        )
          error("normalization.bounds", "Bounds must match the normalized dimensions.");
      }
    }
    const complexity = record(model.complexity, `${path}.complexity`, issues);
    if (complexity) {
      keys(complexity, ["triangles", "visibleMeshes"], `${path}.complexity`, issues);
      for (const [key, limit] of [
        ["triangles", CUSTOM_MODEL_LIMITS.triangles],
        ["visibleMeshes", CUSTOM_MODEL_LIMITS.meshes],
      ] as const)
        if (
          !Number.isSafeInteger(complexity[key]) ||
          Number(complexity[key]) <= 0 ||
          Number(complexity[key]) > limit
        )
          error(`complexity.${key}`, `Model exceeds the ${limit} ${key} limit.`);
    }
    if (model.light !== undefined) validateModelLighting(model.light, `${path}.light`, issues);
  });
  if ([...assets.values()].reduce((sum, size) => sum + size, 0) > CUSTOM_MODEL_LIMITS.homeBytes)
    addProjectIssue(
      issues,
      "project.model-budget",
      pathRoot,
      "A house may contain at most 100 MiB of distinct GLB assets.",
    );
}

export function validateProjectModelCatalogs(
  project: Record<string, unknown>,
  issues: HomeProjectIssue[],
) {
  if (project.customModels !== undefined) validateCustomModels(project.customModels, issues);
  validateModelLightOverrides(project.modelLights, issues);
}
