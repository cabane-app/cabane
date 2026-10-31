import { useState } from "react";
import type { ManifestIssue } from "./types";

export function ConfigurationScreen({
  issues,
  onWorkspaces,
  onDownloadBackup,
}: {
  issues: readonly ManifestIssue[];
  onWorkspaces?: (() => void) | undefined;
  onDownloadBackup?: (() => void | Promise<void>) | undefined;
}) {
  const [downloading, setDownloading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setBackupError(null);
    try {
      await onDownloadBackup?.();
    } catch (cause) {
      setBackupError(
        cause instanceof Error ? cause.message : "Could not download the backup. Try again.",
      );
    } finally {
      setDownloading(false);
    }
  };
  return (
    <main className="configuration-screen">
      <section>
        <h1>This home couldn’t be opened.</h1>
        <p>Cabane found a problem that prevents this home from opening.</p>
        <p>
          Update Cabane in HACS, restart Home Assistant, then reload your browser or Companion app.
        </p>
        <div className="configuration-screen__actions">
          {onWorkspaces && (
            <button type="button" onClick={onWorkspaces}>
              Workspaces
            </button>
          )}
          {onDownloadBackup && (
            <button type="button" disabled={downloading} onClick={() => void download()}>
              {downloading ? "Preparing backup…" : "Download backup"}
            </button>
          )}
        </div>
        {backupError && <p role="alert">{backupError}</p>}
        <details>
          <summary>Technical details</summary>
          <ol>
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.code}`}>
                <code>{issue.path}</code>
                <span>{issue.message}</span>
              </li>
            ))}
          </ol>
        </details>
      </section>
    </main>
  );
}
