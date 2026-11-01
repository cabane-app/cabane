import { MeasurementText } from "@cabane/engine";
import type { ManifestIssue } from "@cabane/engine";
import "./stair-diagnostics.css";

export function StairWarnings({
  issues,
  compact = false,
}: {
  issues: readonly ManifestIssue[];
  compact?: boolean;
}) {
  const warnings = [
    ...new Set(
      issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    ),
  ];
  if (!warnings.length) return null;
  const messages = (
    <ul>
      {warnings.map((message) => (
        <li key={message}>
          <MeasurementText>{message}</MeasurementText>
        </li>
      ))}
    </ul>
  );
  return compact ? (
    <details className="stair-warnings" aria-label="Stair warnings">
      <summary>
        {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
      </summary>
      {messages}
    </details>
  ) : (
    <section className="stair-warnings" aria-label="Stair warnings">
      <h4>{warnings.length === 1 ? "Warning" : "Warnings"}</h4>
      {messages}
    </section>
  );
}
