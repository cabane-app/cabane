import { useMemo } from "react";
import type { ConstructContextualIssue } from "../editor-preview/construct";
import type { HomeEditorExitReason } from "./editor-workspace-contract";

import { useCabaneDom, type HomeProjectRecord } from "@cabane/engine";

import { useCallback, useEffect, useRef, useState } from "react";

import { type EditorMode } from "../editor-chrome/EditorModeNav";

import { useEditorWorkspace } from "../editor-preview/useEditorWorkspace";

import type { HomeProjectIssue } from "@cabane/engine";
export function useEditorSession(
  workspace: ReturnType<typeof useEditorWorkspace>,
  mode: EditorMode,
  onClose: (record: HomeProjectRecord, reason: HomeEditorExitReason) => void,
) {
  const dom = useCabaneDom();
  const { flush, publish } = workspace;
  const [closing, setClosing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    setPreviewOpen(false);
  }, [mode]);
  const walkButton = useRef<HTMLButtonElement>(null);
  const closeWalk = useCallback(() => {
    if (dom.root.pointerLockElement) document.exitPointerLock();
    setPreviewOpen(false);
    requestAnimationFrame(() => walkButton.current?.focus());
  }, [dom]);
  const [publishOpen, setPublishOpen] = useState(false);
  const publishing = workspace.busy;
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const closeEditor = useCallback(async () => {
    setClosing(true);
    const result = await flush();
    if (result.status === "saved") {
      onClose(result.record, "draft-saved");
      return true;
    }
    setClosing(false);
    return false;
  }, [flush, onClose]);

  const publishProject = useCallback(
    async (
      bindingIssues: readonly HomeProjectIssue[],
      closeAfter = true,
      isActive?: () => boolean,
    ) => {
      setPublishMessage(null);
      const result = await publish({ confirmWarnings: true, bindingIssues }, isActive);
      if (result.status === "published") {
        setPublishOpen(false);
        if (closeAfter) onClose(result.record, "applied");
        return result;
      }
      setPublishOpen(true);
      if (result.status === "storage-error") {
        setPublishMessage(
          "Could not save changes in browser storage. The previous home is unchanged.",
        );
        return result;
      }
      setPublishMessage("The draft changed while saving. Review the issues and try again.");
      return result;
    },
    [onClose, publish],
  );
  return {
    closing,
    previewOpen,
    setPreviewOpen,
    walkButton,
    closeWalk,
    publishOpen,
    setPublishOpen,
    publishing,
    publishMessage,
    setPublishMessage,
    saveDraft: closeEditor,
    applyDraft: publishProject,
  };
}

export function useEditorPublicationIssues(
  contextualIssues: readonly ConstructContextualIssue[],
  bindingIssues: readonly HomeProjectIssue[],
) {
  const publishIssues = useMemo(
    () =>
      [
        ...bindingIssues,
        // Includes all project diagnostics, already normalized and deduplicated.
        // Never use the tool-filtered display list to decide whether Save is safe.
        ...contextualIssues.map((issue) => ({
          code: issue.code,
          path: issue.path,
          message: issue.message,
          severity: issue.severity,
        })),
      ].filter(
        (issue, index, issues) =>
          issues.findIndex(
            (candidate) =>
              candidate.code === issue.code &&
              candidate.path === issue.path &&
              candidate.message === issue.message,
          ) === index,
      ),
    [contextualIssues, bindingIssues],
  );
  const publishErrors = publishIssues.filter((issue) => issue.severity !== "warning");
  const publishWarnings = publishIssues.filter((issue) => issue.severity === "warning");

  return { publishIssues, publishErrors, publishWarnings };
}

export function useEditorExitRequest(
  exitRequested: boolean | undefined,
  blocked: boolean,
  closeEditor: () => Promise<boolean | void>,
  onExitFailed?: () => void,
) {
  const exitHandled = useRef(false);
  useEffect(() => {
    if (!exitRequested) {
      exitHandled.current = false;
      return;
    }
    if (!blocked && !exitHandled.current) {
      exitHandled.current = true;
      void closeEditor().then((saved) => {
        if (saved === false) onExitFailed?.();
      });
    }
  }, [exitRequested, blocked, closeEditor, onExitFailed]);
}
