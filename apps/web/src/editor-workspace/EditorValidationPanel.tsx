import { MeasurementText, formatMeasurementText, useMeasurementUnits } from "@cabane/engine";
import { useId, useState } from "react";
import type { ConstructValidationDiagnostic } from "../editor-preview/construct/contextual-validation";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { EditorButton } from "../editor-chrome/EditorButton";

/** Draft diagnostics live outside the tools and properties surfaces. */
export function EditorValidationPanel<Issue extends ConstructValidationDiagnostic>({
  issues,
  onSelect,
  expanded: controlledExpanded,
  onToggle,
  disabled = false,
  onRepair,
  itemLabel,
}: {
  issues: readonly Issue[];
  onSelect: (issue: Issue) => void;
  expanded?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  onRepair?: (issue: Issue, action: "reset-placement" | "remove") => void;
  itemLabel?: (issue: Issue) => string | undefined;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const units = useMeasurementUnits();
  const expanded = controlledExpanded ?? localExpanded;
  const contentId = useId();
  if (!issues.length) return null;
  const errorCount = issues.filter((issue) => issue.severity !== "warning").length;
  const warningCount = issues.length - errorCount;
  return (
    <section
      className="editor-issues construction-inspector__validation"
      data-expanded={expanded}
      aria-label="Editor validation"
    >
      <button
        type="button"
        className="editor-issues__disclosure"
        aria-label={`Issues: ${[errorCount ? `${errorCount} ${errorCount === 1 ? "error" : "errors"}` : "", warningCount ? `${warningCount} ${warningCount === 1 ? "warning" : "warnings"}` : ""].filter(Boolean).join(", ")}`}
        aria-expanded={expanded}
        aria-controls={contentId}
        disabled={disabled}
        onClick={onToggle ?? (() => setLocalExpanded((current) => !current))}
      >
        <strong>Issues</strong>
        <span className="editor-issues__counts" aria-live="polite" aria-atomic="true">
          {errorCount > 0 && (
            <span data-severity="error">
              <EditorIcon name="warning" />
              {errorCount}
              <span className="editor-issues__count-label">
                {" "}
                {errorCount === 1 ? "error" : "errors"}
              </span>
            </span>
          )}
          {warningCount > 0 && (
            <span data-severity="warning">
              <EditorIcon name="warning" />
              {warningCount}
              <span className="editor-issues__count-label">
                {" "}
                {warningCount === 1 ? "warning" : "warnings"}
              </span>
            </span>
          )}
        </span>
        <EditorIcon name="chevron" />
      </button>
      <ul id={contentId} hidden={!expanded}>
        {issues.map((issue, index) => (
          <li key={`${issue.code}:${issue.path}:${index}`} data-severity={issue.severity}>
            <div className="editor-issues__message">
              <span className="construction-inspector__validation-marker">
                <EditorIcon name="warning" />
              </span>
              <div>
                {itemLabel?.(issue) && <strong>{itemLabel(issue)}</strong>}
                <strong>
                  <MeasurementText>{issue.message}</MeasurementText>
                </strong>
                {issue.suggestion && (
                  <small>
                    <MeasurementText>{issue.suggestion}</MeasurementText>
                  </small>
                )}
              </div>
            </div>
            {issue.target && (
              <footer className="editor-issues__actions">
                <EditorButton
                  disabled={disabled}
                  aria-label={`${issue.target.kind === "scene-item" ? "Select" : "Locate"} ${issue.target.kind} ${issue.target.id}: ${formatMeasurementText(issue.message, units)}`}
                  onClick={() => onSelect(issue)}
                >
                  {issue.target.kind === "scene-item" ? "Select" : "Locate"}
                </EditorButton>
                {issue.target.kind === "scene-item" && onRepair && (
                  <>
                    {issue.path.includes(".placement") && (
                      <EditorButton
                        disabled={disabled}
                        onClick={() => onRepair(issue, "reset-placement")}
                      >
                        Reset placement
                      </EditorButton>
                    )}
                    <EditorButton disabled={disabled} onClick={() => onRepair(issue, "remove")}>
                      Remove item
                    </EditorButton>
                  </>
                )}
              </footer>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
