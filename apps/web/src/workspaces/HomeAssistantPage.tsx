import { readCabaneFile } from "@cabane/engine";
import { downloadWorkspaceArchive } from "./download-workspace-archive";
import { workspaceDestination } from "./workspace-open-link";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  useHomeAssistantHostSession,
  useCabaneAssetUrl,
  useHomeAssistantRuntime,
  validateHomeAssistantUrlInput,
  type HomeProjectRecord,
  type HomeProjectLifecycle,
} from "@cabane/engine";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { useConnectSignIn } from "../editor-connect/useConnectSignIn";
import { CONNECT_RETURN_KEY } from "../editor-connect/connect-navigation";
import { stageImportedWorkspace } from "../editor-connect/profile-transfer";
import { ownerProjectRegistries } from "../project-runtime";
import { workspaceHomePath } from "../editor-routes";
import { WorkspaceHaStorageInConnect, useWorkspaceStorage } from "./WorkspaceHaStorage";
import { exportWorkspaceBackup } from "./workspace-transfer";
import "./home-assistant-page.css";

export function HomeAssistantPage({
  record,
  lifecycle,
  origin,
  onChangeOrigin,
  onRecordChange,
  isDemo,
  onCreatePersonal,
  section,
  getCurrentRecord,
  onImportDraft,
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
  section?: "home-assistant" | "backups";
  getCurrentRecord?: () => HomeProjectRecord;
  onImportDraft?: (json: string) => void;
  record: HomeProjectRecord;
  lifecycle: HomeProjectLifecycle;
  origin: string | null;
  onChangeOrigin: (origin: string | null) => Promise<void>;
  onRecordChange: (record: HomeProjectRecord) => void;
  isDemo: boolean;
  onCreatePersonal: () => void;
}) {
  const location = useLocation();
  const setup = workspaceDestination(location.search) === "dashboard";
  const hostSession = useHomeAssistantHostSession();
  const iconUrl = useCabaneAssetUrl("cabane-icon.png");

  const runtime = useHomeAssistantRuntime();
  const storage = useWorkspaceStorage();
  const [address, setAddress] = useState(origin ?? "");
  const [editing, setEditing] = useState(!origin);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const connecting = ["authenticating", "connecting", "reconnecting"].includes(runtime.status);
  const connected = runtime.status === "connected";
  useEffect(() => {
    if (connected && !hostSession) {
      try {
        const parsed: unknown = JSON.parse(
          window.sessionStorage.getItem(CONNECT_RETURN_KEY) ?? "null",
        );
        const request =
          parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        if (request?.workspaceId === record.homeId && request?.panel === "home-assistant")
          window.sessionStorage.removeItem(CONNECT_RETURN_KEY);
      } catch {
        /* A malformed return request cannot affect this page. */
      }
    }
  }, [connected, record.homeId, hostSession]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  const signIn = useConnectSignIn(runtime, async (next) => {
    await onChangeOrigin(next);
    if (!hostSession)
      window.sessionStorage.setItem(
        CONNECT_RETURN_KEY,
        JSON.stringify({
          workspaceId: record.homeId,
          mode: "connect",
          panel: "home-assistant",
          destination: workspaceDestination(location.search),
        }),
      );
    setEditing(false);
  });
  const ConnectionContainer = setup && connected ? "details" : "div";
  const BackupContainer = setup ? "details" : "div";
  const connect = async (next: string) => {
    if (busy || connecting) return;
    setBusy(true);
    setConnectionError(null);
    try {
      await signIn(next);
    } catch (cause) {
      setConnectionError(
        cause instanceof Error ? cause.message : "Could not start sign-in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const latest = async () =>
    getCurrentRecord?.() ?? (await storage?.repository.read(record.homeId))?.record ?? record;
  const exportBackup = async () => {
    const current = await latest();
    const json = exportWorkspaceBackup(
      {
        name: current.draft.home.name,
        homeAssistantUrl: origin,
        hasPublished: current.publishedAt !== 0,
      },
      current,
    );
    await downloadWorkspaceArchive(json, `${record.homeId}-backup.cabane`);
    setNotice("Backup downloaded.");
  };
  const importBackup = async (file: File) => {
    const current = await latest();
    const json = (await readCabaneFile(file)).json;
    const imported = stageImportedWorkspace(current, json, ownerProjectRegistries);
    if (
      !window.confirm(
        "Replace this home's draft with the backup? Your current draft will be downloaded first. The published home stays unchanged until you save in the editor.",
      )
    )
      return;
    await exportBackup();
    if (onImportDraft) {
      onImportDraft(json);
      setNotice("Backup imported into the draft. Review it here before saving.");
      return;
    }
    const result = await lifecycle.autosave(
      current,
      imported.project,
      undefined,
      imported.bindings,
    );
    if (result.status === "storage-error") throw result.error;
    if (result.status !== "saved")
      throw new Error("This backup could not be saved. Your draft is unchanged.");
    onRecordChange(result.record);
    setNotice("Backup imported into the draft. Open the editor to review and save it.");
  };
  return (
    <div
      className={`ha-page${setup ? " ha-page--setup" : ""}${section ? " ha-page--embedded" : ""}`}
    >
      <div className="ha-page__content">
        {!section && (
          <>
            <nav className="ha-page__nav" aria-label="Workspace navigation">
              <Link to="/workspaces">
                <EditorIcon name="back" />
                Workspaces
              </Link>
              <Link to={workspaceHomePath(record.homeId)}>
                Open home
                <EditorIcon name="chevron" />
              </Link>
            </nav>
            <header className="ha-page__header">
              <h1>{setup ? "Cabane in Home Assistant" : "Home Assistant"}</h1>
              <p>{record.draft.home.name}</p>
            </header>
          </>
        )}
        {section !== "backups" &&
          (isDemo ? (
            <section className="ha-section">
              <h2>Make this home yours</h2>
              <p>
                The demo uses simulated devices. Create your own workspace to connect Home Assistant
                and save across devices.
              </p>
              <button className="ha-primary" onClick={onCreatePersonal}>
                Create my workspace
                <EditorIcon name="chevron" />
              </button>
            </section>
          ) : (
            <>
              <ConnectionContainer
                className={setup && connected ? "ha-connection-details" : undefined}
              >
                {setup && connected && (
                  <summary>
                    <EditorIcon name="check" />
                    Connected to {origin ? new URL(origin).host : "Home Assistant"}
                  </summary>
                )}
                <section className="ha-section" aria-labelledby="ha-connection-title">
                  <div className="ha-section__heading">
                    <h2 id="ha-connection-title">Connection</h2>
                    <span role="status" className={`ha-status${connected ? " is-connected" : ""}`}>
                      <i />
                      {connected
                        ? "Connected"
                        : connecting
                          ? "Connecting…"
                          : origin
                            ? "Disconnected"
                            : "Not connected"}
                    </span>
                  </div>
                  {hostSession ? (
                    <div className="ha-connection-row">
                      <p>Sign-in is managed by Home Assistant.</p>
                      <p className="ha-address">{hostSession.origin}</p>
                      {origin && origin !== hostSession.origin && (
                        <p role="alert">
                          This workspace uses a different Home Assistant: {origin}. Select this
                          instance explicitly; its mappings remain separate.
                        </p>
                      )}
                      <div className="ha-actions">
                        {origin !== hostSession.origin && (
                          <button
                            className="ha-primary"
                            disabled={busy}
                            onClick={() => void run(() => onChangeOrigin(hostSession.origin))}
                          >
                            Use this Home Assistant
                          </button>
                        )}
                        {origin === hostSession.origin &&
                          ["error", "disconnected"].includes(runtime.status) && (
                            <button disabled={busy} onClick={runtime.retry}>
                              Retry connection
                            </button>
                          )}
                        {origin && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await onChangeOrigin(null);
                                await runtime.disconnect();
                              })
                            }
                          >
                            Disconnect workspace
                          </button>
                        )}
                      </div>
                      <p className="ha-help">
                        Disconnecting this workspace keeps you signed in to Home Assistant.
                      </p>
                    </div>
                  ) : editing ? (
                    <form
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (busy || connecting) return;
                        const result = validateHomeAssistantUrlInput(address);
                        setConnectionError(result.error);
                        if (result.normalized) void connect(result.normalized);
                      }}
                    >
                      <label htmlFor="ha-address">Home Assistant URL</label>
                      <div className="ha-address-form">
                        <input
                          id="ha-address"
                          type="url"
                          inputMode="url"
                          required
                          aria-invalid={Boolean(connectionError)}
                          aria-describedby={`ha-address-help${connectionError ? " ha-connection-error" : ""}`}
                          placeholder="https://home.example.com"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={address}
                          disabled={busy || connecting}
                          onChange={(event) => {
                            setAddress(event.target.value);
                            setConnectionError(null);
                          }}
                        />
                        <button className="ha-primary" disabled={busy || connecting}>
                          {busy ? "Preparing sign-in…" : connecting ? "Connecting…" : "Connect"}
                          <EditorIcon name="external" />
                        </button>
                        {origin && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditing(false);
                              setAddress(origin);
                              setConnectionError(null);
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <p id="ha-address-help" className="ha-help">
                        Enter the full HTTPS address, including https:// and a port if needed, with
                        no path. Use an address with a certificate trusted by this browser. Home
                        Assistant handles sign-in, then returns you here.
                      </p>
                    </form>
                  ) : (
                    <div className="ha-connection-row">
                      <p className="ha-address">{origin}</p>
                      <div className="ha-actions">
                        <button
                          disabled={busy || connecting}
                          onClick={() => {
                            setEditing(true);
                            setConnectionError(null);
                          }}
                        >
                          Change URL
                        </button>
                        {connected ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await runtime.disconnect();
                                await onChangeOrigin(null);
                                setAddress("");
                                setEditing(true);
                              })
                            }
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            className="ha-primary"
                            disabled={busy || connecting}
                            onClick={() => void connect(origin!)}
                          >
                            {busy ? "Preparing sign-in…" : connecting ? "Connecting…" : "Reconnect"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {connectionError && (
                    <p id="ha-connection-error" role="alert" className="ha-error">
                      {connectionError}
                    </p>
                  )}
                  {runtime.error && (
                    <p role="alert" className="ha-error">
                      {runtime.error}
                    </p>
                  )}
                </section>
              </ConnectionContainer>
              <WorkspaceHaStorageInConnect />
            </>
          ))}
        {section !== "home-assistant" && (
          <BackupContainer className={setup ? "ha-setup-disclosure" : undefined}>
            {setup && <summary>File backups</summary>}
            <section className="ha-section" aria-labelledby="ha-backups-title">
              <h2 id="ha-backups-title">Backups</h2>
              <p>
                Keep a file with your full workspace: design, drafts, and device mappings. Sign-in
                credentials are never included.
              </p>
              <div className="ha-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const current = await latest();
                      await downloadWorkspaceArchive(
                        JSON.stringify(current.draft),
                        `${record.homeId}-design.cabane`,
                      );
                      setNotice("Design downloaded without device mappings.");
                    })
                  }
                >
                  <EditorIcon name="export" />
                  Export design
                </button>
                <button disabled={busy} onClick={() => void run(exportBackup)}>
                  <EditorIcon name="export" />
                  Export backup
                </button>
                <label className={`ha-file-button${busy ? " is-disabled" : ""}`}>
                  <EditorIcon name="import" />
                  Import backup
                  <input
                    type="file"
                    accept=".cabane,.json,application/zip,application/json"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void run(() => importBackup(file));
                    }}
                  />
                </label>
              </div>
              <p className="ha-help">
                Import replaces this home’s draft. Review it in the editor before saving.
              </p>
            </section>
          </BackupContainer>
        )}
        {error && (
          <p role="alert" className="ha-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="ha-notice">
            {notice}
          </p>
        )}
        {!section && (
          <footer className="ha-page__footer">
            <img src={iconUrl} alt="" width="18" height="22" />
            Cabane<span>Your home, on your terms.</span>
          </footer>
        )}
      </div>
    </div>
  );
}
