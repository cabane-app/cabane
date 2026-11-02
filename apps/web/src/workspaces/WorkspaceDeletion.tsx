import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HomeAssistantRuntimeProvider,
  useHomeAssistantRuntime,
  useHomeAssistantHostSession,
  type WorkspaceEntry,
  type WorkspaceRepository,
} from "@cabane/engine";
import { createHaWorkspaceClient, type HaWorkspaceSummary } from "./ha-workspace-client";
import { useWorkspaceSyncCoordinator } from "./useWorkspaceSyncCoordinator";
import { deleteSyncCursor } from "./workspace-sync-state";
import { WorkspaceDeleteDialog, type WorkspaceDeleteScope } from "./WorkspaceDeleteDialog";
import { downloadWorkspaceArchive } from "./download-workspace-archive";
import { exportWorkspaceBackup } from "./workspace-transfer";
import { downloadConnectData } from "../editor-connect/profile-transfer";

type DeletionProps = {
  repository: WorkspaceRepository;
  target:
    | { entry: WorkspaceEntry; saved?: never; origin?: never }
    | { entry?: never; saved: HaWorkspaceSummary; origin: string };
  onDeleteLocal?: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
};

/** Storage management does not require restoring or reconnecting the saved home. */
export function WorkspaceDeletion(props: DeletionProps) {
  const host = useHomeAssistantHostSession();
  const origin =
    host?.origin ?? props.target.entry?.metadata.homeAssistantUrl ?? props.target.origin ?? null;
  return (
    <HomeAssistantRuntimeProvider homeAssistantUrl={origin}>
      <WorkspaceDeletionContent {...props} />
    </HomeAssistantRuntimeProvider>
  );
}

export function WorkspaceDeletionContent({
  repository,
  target,
  onDeleteLocal,
  onDeleted,
  onCancel,
  onBusyChange,
}: DeletionProps) {
  const runtime = useHomeAssistantRuntime();
  const host = useHomeAssistantHostSession();
  const { client } = useWorkspaceSyncCoordinator(repository);
  const rawClient = useMemo(
    () => createHaWorkspaceClient(runtime.sendStorageMessage),
    [runtime.sendStorageMessage],
  );
  const entry = target.entry;
  const id = entry?.metadata.id ?? target.saved!.home_id;
  const name = entry?.metadata.name ?? target.saved!.name;
  const origin =
    host?.origin ?? runtime.origin ?? entry?.metadata.homeAssistantUrl ?? target.origin ?? null;
  const [remote, setRemote] = useState<"checking" | "present" | "absent" | "error">(
    target.saved ? "present" : origin ? "checking" : "absent",
  );
  const [version, setVersion] = useState<number | null>(target.saved?.version ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!origin || (target.saved && refresh === 0)) return;
    if (runtime.status !== "connected") {
      setRemote("error");
      return;
    }
    let active = true;
    setRemote("checking");
    void rawClient
      .get(id)
      .then((copy) => {
        if (!active) return;
        setVersion(copy?.document ? copy.version : null);
        setRemote(copy?.document ? "present" : "absent");
        setError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setRemote("error");
        setError(
          cause instanceof Error ? cause.message : "Could not check the Home Assistant copy.",
        );
      });
    return () => {
      active = false;
    };
  }, [origin, id, rawClient, runtime.status, target.saved, refresh]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not complete this action. Try again.",
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };
  const backup = async () => {
    if (entry) {
      const current = await repository.read(id);
      if (!current?.record) {
        const raw = await repository.readRaw(id);
        if (raw === null) throw new Error("No saved record exists.");
        downloadConnectData(raw, `${id}-recovery.json`);
      } else
        await downloadWorkspaceArchive(
          exportWorkspaceBackup(current.metadata, current.record),
          `${id}-backup.cabane`,
        );
    } else {
      const copy = await rawClient.get(id);
      if (!copy?.document) throw new Error("No Home Assistant copy exists.");
      if (copy.corrupt) downloadConnectData(copy.document, `${id}-ha-recovery.json`);
      else {
        const complete = await client.get(id);
        if (!complete?.document) throw new Error("No Home Assistant copy exists.");
        await downloadWorkspaceArchive(complete.document, `${id}-backup.cabane`);
      }
    }
  };
  const remove = async (scope: WorkspaceDeleteScope) => {
    if (entry) {
      const current = await repository.read(id);
      if (!current || current.record?.revision !== entry.record?.revision)
        throw new Error("This workspace changed. Cancel and reopen Delete to review it.");
    }
    if (scope === "permanent" && origin && remote !== "absent") {
      if (remote !== "present" || version === null)
        throw new Error("Check the Home Assistant copy before deleting it.");
      try {
        await rawClient.delete(id, version);
      } catch (cause) {
        setRemote("error");
        throw cause;
      }
      setRemote("absent");
      setVersion(null);
    }
    const origins = new Set([origin, entry?.metadata.homeAssistantUrl]);
    for (const savedOrigin of origins)
      if (savedOrigin) await deleteSyncCursor(window.indexedDB, savedOrigin, id);
    if (entry) await onDeleteLocal!();
    await onDeleted();
  };
  const retry = useCallback(() => {
    setError(null);
    setRefresh((value) => value + 1);
    if (runtime.status !== "connected") {
      if (runtime.status === "disconnected" || runtime.status === "unconfigured") runtime.connect();
      else runtime.retry();
    }
  }, [runtime]);
  return (
    <WorkspaceDeleteDialog
      name={name}
      local={Boolean(entry)}
      remote={remote}
      server={origin}
      busy={busy}
      error={
        error ??
        (remote === "error"
          ? (runtime.error ??
            "Connect to Home Assistant to check or delete its saved copy. Local removal is still available.")
          : null)
      }
      onCancel={onCancel}
      onRetry={retry}
      onBackup={() => void run(backup)}
      onDelete={(scope) => void run(() => remove(scope))}
    />
  );
}
