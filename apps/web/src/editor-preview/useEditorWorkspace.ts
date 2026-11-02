import { modelAssetReferences } from "@cabane/engine";
import {
  architectureChanged,
  commitWorkspaceSnapshot,
  createWorkspaceHistory,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
  type ReferenceWorkspaceHistory as EditorWorkspaceHistory,
} from "../editor-reference-plan/reference-history";
import { useReferencePersistence } from "../editor-reference-plan/useReferencePersistence";
import type { ReferencePlans } from "../editor-reference-plan/reference-plan";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  WorkspaceConflictError,
  type AutosaveResult,
  type EditorWorkspaceSnapshot,
  type HomeProjectLifecycle,
  type HomeProjectRecord,
  type PublishOptions,
  type PublishResult,
} from "@cabane/engine";

const snapshotFromRecord = (record: HomeProjectRecord): EditorWorkspaceSnapshot => ({
  project: record.draft,
  bindings: record.bindings,
});
const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error("Workspace storage failed.");
export const EDITOR_AUTOSAVE_DELAY_MS = 280;

/** One history and one write queue for geometry and browser-private bindings. */
export function useEditorWorkspace({
  initialRecord,
  lifecycle,
  autosaveDelayMs = EDITOR_AUTOSAVE_DELAY_MS,
}: {
  initialRecord: HomeProjectRecord;
  lifecycle: HomeProjectLifecycle;
  autosaveDelayMs?: number;
}) {
  const [history, setHistory] = useState(() =>
    createWorkspaceHistory(snapshotFromRecord(initialRecord)),
  );
  const historyRef = useRef(history);
  const initializeReferences = useCallback((stored: ReferencePlans) => {
    const previous = historyRef.current;
    const references = Object.fromEntries(
      Object.entries(stored).filter(([id]) =>
        previous.present.project.floors.some((floor) => floor.id === id),
      ),
    );
    const withReferences = (entry: typeof previous.present) => ({ ...entry, references });
    const next = {
      present: withReferences(previous.present),
      past: previous.past.map(withReferences),
      future: previous.future.map(withReferences),
    };
    historyRef.current = next;
    setHistory(next);
    return references;
  }, []);
  const referenceStorage = useReferencePersistence(
    initialRecord.homeId,
    history.present.references,
    initializeReferences,
  );
  const { cleanup: referenceStorageCleanup } = referenceStorage;
  const cleanupState = useRef(history);
  cleanupState.current = history;
  useEffect(
    () => () => {
      const present = cleanupState.current.present;
      if (!present.references) return;
      const floors = new Set(present.project.floors.map((floor) => floor.id));
      referenceStorageCleanup(
        Object.fromEntries(Object.entries(present.references).filter(([id]) => floors.has(id))),
      );
    },
    [referenceStorageCleanup],
  );
  const [record, setRecord] = useState(initialRecord);
  const recordRef = useRef(record);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const pending = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  // Pause automatic retries on failure; an explicit flush may retry transient
  // errors, but a revision conflict requires a clean record/recovery decision.
  const failure = useRef<AutosaveResult | null>(null);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) globalThis.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const acceptRecord = useCallback((next: HomeProjectRecord) => {
    recordRef.current = next;
    if (mounted.current) setRecord(next);
  }, []);
  const showFailure = useCallback((result: AutosaveResult) => {
    failure.current = result.status === "storage-error" ? result : null;
    if (mounted.current) {
      setSaving(false);
      setError(
        result.status === "storage-error"
          ? result.error
          : new Error("The draft could not be saved."),
      );
    }
    return result;
  }, []);
  const enqueue = useCallback(<T>(operation: () => Promise<T>): Promise<T> => {
    pending.current += 1;
    const result = queue.current.then(operation);
    queue.current = result
      .catch(() => undefined)
      .finally(() => {
        pending.current -= 1;
      });
    return result;
  }, []);

  const saveSnapshot = useCallback(
    async (
      snapshot: EditorWorkspaceSnapshot,
      capturedRevision: number,
      retryTransientFailure = false,
    ): Promise<AutosaveResult> => {
      if (
        retryTransientFailure &&
        failure.current?.status === "storage-error" &&
        !(failure.current.error instanceof WorkspaceConflictError)
      )
        failure.current = null;
      if (failure.current) return failure.current;
      if (capturedRevision <= savedRevision.current) {
        if (mounted.current && retryTransientFailure) {
          setError(null);
          setSaving(false);
        }
        return { status: "saved", record: recordRef.current };
      }
      try {
        const result = await lifecycle.autosave(
          recordRef.current,
          snapshot.project,
          undefined,
          snapshot.bindings,
        );
        if (result.status !== "saved") return showFailure(result);
        acceptRecord(result.record);
        savedRevision.current = capturedRevision;
        if (mounted.current) {
          setError(null);
          setSaving(savedRevision.current !== revision.current);
        }
        return result;
      } catch (caught) {
        return showFailure({
          status: "storage-error",
          record: recordRef.current,
          error: asError(caught),
        });
      }
    },
    [acceptRecord, lifecycle, showFailure],
  );

  const queueSnapshot = useCallback(
    (explicitRetry: boolean): Promise<AutosaveResult> => {
      cancelTimer();
      const capturedRevision = revision.current;
      const snapshot = structuredClone(historyRef.current.present);
      // A queued save requested before an error occurred is not an explicit retry.
      const retry = explicitRetry && failure.current !== null;
      return enqueue(() => saveSnapshot(snapshot, capturedRevision, retry));
    },
    [cancelTimer, enqueue, saveSnapshot],
  );
  useEffect(() => {
    mounted.current = true;
    // StrictMode replays mount effects after cancelling the initial timer. Resume
    // an unsaved initialization even when the replayed edit is a history no-op.
    if (revision.current !== savedRevision.current && timer.current === null && !failure.current) {
      timer.current = globalThis.setTimeout(() => {
        timer.current = null;
        void queueSnapshot(false);
      }, autosaveDelayMs);
    }
    return () => {
      mounted.current = false;
      cancelTimer();
    };
  }, [autosaveDelayMs, cancelTimer, queueSnapshot]);
  const flush = useCallback(() => queueSnapshot(true), [queueSnapshot]);

  const changeHistory = useCallback(
    (next: EditorWorkspaceHistory): EditorWorkspaceSnapshot | null => {
      if (locked.current || next === historyRef.current) return null;
      const changed = architectureChanged(historyRef.current.present, next.present);
      historyRef.current = next;
      setHistory(next);
      if (!changed) return next.present;
      revision.current += 1;
      cancelTimer();
      if (!failure.current) {
        setSaving(true);
        timer.current = globalThis.setTimeout(() => {
          timer.current = null;
          void queueSnapshot(false);
        }, autosaveDelayMs);
      }
      return next.present;
    },
    [autosaveDelayMs, cancelTimer, queueSnapshot],
  );
  const commit = useCallback(
    (snapshot: EditorWorkspaceSnapshot): boolean =>
      !locked.current &&
      changeHistory(
        commitWorkspaceSnapshot(historyRef.current, {
          ...snapshot,
          ...(historyRef.current.present.references === undefined
            ? {}
            : { references: historyRef.current.present.references }),
        }),
      ) !== null,
    [changeHistory],
  );
  const commitReferences = useCallback(
    (references: ReferencePlans): boolean =>
      !locked.current &&
      changeHistory(
        commitWorkspaceSnapshot(historyRef.current, { ...historyRef.current.present, references }),
      ) !== null,
    [changeHistory],
  );
  const undo = useCallback(
    () => changeHistory(undoWorkspaceHistory(historyRef.current)),
    [changeHistory],
  );
  const redo = useCallback(
    () => changeHistory(redoWorkspaceHistory(historyRef.current)),
    [changeHistory],
  );

  const publish = useCallback(
    async (
      options: PublishOptions = {},
      isActive: () => boolean = () => true,
    ): Promise<PublishResult> => {
      if (locked.current) return { status: "blocked", errors: [], warnings: [] };
      locked.current = true;
      setBusy(true);
      cancelTimer();
      const snapshot = structuredClone(historyRef.current.present);
      const capturedRevision = revision.current;
      const retryTransientFailure = failure.current !== null;
      try {
        return await enqueue(async () => {
          const saved = await saveSnapshot(snapshot, capturedRevision, retryTransientFailure);
          if (saved.status !== "saved")
            return {
              status: "storage-error" as const,
              errors: [] as const,
              warnings: [],
              error:
                saved.status === "storage-error"
                  ? saved.error
                  : new Error("The draft could not be saved."),
            };
          if (!isActive()) return { status: "blocked" as const, errors: [], warnings: [] };
          const result = await lifecycle.publish(recordRef.current, options);
          if (result.status === "published") acceptRecord(result.record);
          else if (result.status === "storage-error")
            showFailure({ ...result, record: recordRef.current });
          return result;
        });
      } catch (caught) {
        const error = asError(caught);
        showFailure({ status: "storage-error", record: recordRef.current, error });
        return { status: "storage-error", errors: [], warnings: [], error };
      } finally {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [acceptRecord, cancelTimer, enqueue, lifecycle, saveSnapshot, showFailure],
  );

  const establishBaseline = useCallback(
    (next: HomeProjectRecord) => {
      const references = Object.fromEntries(
        Object.entries(historyRef.current.present.references ?? {}).filter(([id]) =>
          next.draft.floors.some((floor) => floor.id === id),
        ),
      );
      const nextHistory = createWorkspaceHistory({
        ...snapshotFromRecord(next),
        ...(historyRef.current.present.references ? { references } : {}),
      });
      historyRef.current = nextHistory;
      if (nextHistory.present.references) referenceStorageCleanup(references);
      savedRevision.current = ++revision.current;
      failure.current = null;
      acceptRecord(next);
      if (mounted.current) {
        setHistory(nextHistory);
        setSaving(false);
        setError(null);
      }
    },
    [acceptRecord, referenceStorageCleanup],
  );
  const reset = useCallback(
    async (kind: "resetDraftToPublished" | "resetToSeed"): Promise<AutosaveResult> => {
      if (locked.current)
        return {
          status: "storage-error",
          record: recordRef.current,
          error: new Error("The workspace is busy."),
        };
      locked.current = true;
      setBusy(true);
      cancelTimer();
      try {
        return await enqueue(async () => {
          const result = await lifecycle[kind](recordRef.current);
          if (result.status === "saved") establishBaseline(result.record);
          else showFailure(result);
          return result;
        });
      } catch (caught) {
        return showFailure({
          status: "storage-error",
          record: recordRef.current,
          error: asError(caught),
        });
      } finally {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [cancelTimer, enqueue, establishBaseline, lifecycle, showFailure],
  );
  const resetDraftToPublished = useCallback(() => reset("resetDraftToPublished"), [reset]);
  const resetToSeed = useCallback(() => reset("resetToSeed"), [reset]);
  const getRecord = useCallback(() => recordRef.current, []);
  const adoptRecord = useCallback(
    (next: HomeProjectRecord): boolean => {
      if (
        locked.current ||
        pending.current > 0 ||
        timer.current !== null ||
        revision.current !== savedRevision.current ||
        next.homeId !== recordRef.current.homeId ||
        next.revision < recordRef.current.revision
      )
        return false;
      establishBaseline(next);
      return true;
    },
    [establishBaseline],
  );

  return {
    record,
    modelAssetReferences: modelAssetReferences([
      record.published,
      ...history.past.map((s) => s.project),
      history.present.project,
      ...history.future.map((s) => s.project),
    ]),
    snapshot: history.present,
    commit,
    undo,
    redo,
    commitReferences,
    referenceStorage,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    flush,
    publish,
    saving,
    error,
    busy,
    resetDraftToPublished,
    resetToSeed,
    getRecord,
    getEditRevision: () => initialRecord.revision + revision.current,
    adoptRecord,
  };
}
