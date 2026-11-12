import { isActionBarBuiltIn } from "../action-bar/action-bar-config";
import { keys, record, array, string } from "./schema-json-values";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

export function validateActionBarSchema(
  project: Record<string, unknown>,
  issues: HomeProjectIssue[],
) {
  if (project.actionBar !== undefined) {
    const actionBar = record(project.actionBar, "actionBar", issues);
    if (actionBar) {
      keys(actionBar, ["items"], "actionBar", issues);
      array(actionBar.items, "actionBar.items", issues)?.forEach((entry, index) => {
        const path = `actionBar.items[${index}]`;
        const item = record(entry, path, issues);
        if (!item) return;
        keys(item, ["id", "target"], path, issues);
        string(item.id, `${path}.id`, issues);
        const target = record(item.target, `${path}.target`, issues);
        if (!target) return;
        const targetPath = `${path}.target`;
        if (target.kind === "built-in") {
          keys(target, ["kind", "action"], targetPath, issues);
          if (!isActionBarBuiltIn(target.action)) {
            addProjectIssue(
              issues,
              "project.action-bar-built-in",
              `${targetPath}.action`,
              "Action bar built-in action is invalid.",
            );
          }
        } else if (target.kind === "scene" || target.kind === "script") {
          keys(target, ["kind"], targetPath, issues);
        } else if (target.kind === "walk-tool") {
          keys(target, ["kind", "toolId"], targetPath, issues);
          string(target.toolId, `${targetPath}.toolId`, issues);
        } else if (target.kind === "scene-feature") {
          keys(target, ["kind", "featureId"], targetPath, issues);
          string(target.featureId, `${targetPath}.featureId`, issues);
        } else if (target.kind === "room") {
          keys(target, ["kind", "roomId"], targetPath, issues);
          string(target.roomId, `${targetPath}.roomId`, issues);
        } else if (target.kind === "device") {
          keys(target, ["kind", "deviceId"], targetPath, issues);
          string(target.deviceId, `${targetPath}.deviceId`, issues);
        } else {
          keys(target, ["kind"], targetPath, issues);
          addProjectIssue(
            issues,
            "project.action-bar-target-kind",
            `${targetPath}.kind`,
            "Action bar target kind is invalid.",
          );
        }
      });
    }
  }
}
