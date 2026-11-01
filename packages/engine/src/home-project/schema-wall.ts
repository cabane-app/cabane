import { record, keys, string, finite, point } from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";
import { wallNichesSchema } from "./schema-wall-niches";

export const wallSchema = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  keys(
    candidate,
    [
      "id",
      "name",
      "from",
      "to",
      "classification",
      "thicknessMeters",
      "virtual",
      "heightMeters",
      "exteriorColor",
      "edgeColor",
      "faceColors",
      "niches",
    ],
    path,
    issues,
  );
  string(candidate.id, `${path}.id`, issues);
  if (candidate.name !== undefined) string(candidate.name, `${path}.name`, issues);
  point(candidate.from, `${path}.from`, issues);
  point(candidate.to, `${path}.to`, issues);
  if (!["interior", "exterior"].includes(String(candidate.classification))) {
    addProjectIssue(
      issues,
      "project.wall-classification",
      `${path}.classification`,
      "Wall classification is invalid.",
    );
  }
  finite(candidate.thicknessMeters, `${path}.thicknessMeters`, issues);
  if (candidate.virtual !== undefined && typeof candidate.virtual !== "boolean") {
    addProjectIssue(
      issues,
      "project.wall-virtual",
      `${path}.virtual`,
      "Wall virtual flag must be a boolean.",
    );
  }
  wallNichesSchema(candidate.niches, `${path}.niches`, issues);
  if (candidate.heightMeters !== undefined)
    finite(candidate.heightMeters, `${path}.heightMeters`, issues);
  if (candidate.exteriorColor !== undefined)
    string(candidate.exteriorColor, `${path}.exteriorColor`, issues);
  if (candidate.edgeColor !== undefined) string(candidate.edgeColor, `${path}.edgeColor`, issues);
  if (candidate.faceColors !== undefined) {
    const colors = record(candidate.faceColors, `${path}.faceColors`, issues);
    if (colors) {
      keys(colors, ["left", "right"], `${path}.faceColors`, issues);
      if (colors.left !== undefined) string(colors.left, `${path}.faceColors.left`, issues);
      if (colors.right !== undefined) string(colors.right, `${path}.faceColors.right`, issues);
    }
  }
};
