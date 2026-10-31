import { useState } from "react";
import { WorkspaceOpenContent } from "../../apps/web/src/workspaces/WorkspaceOpenPage";
import { MemoryRouter } from "react-router";
import { HomeEditor } from "../../apps/web/src/HomeEditor";
import { createBrowserHomeProjectLifecycle } from "../../apps/web/src/project-runtime";
import { createRoot } from "react-dom/client";
import { HomeAssistantRuntimeValueProvider, createWorkspaceRepository } from "@cabane/engine";
import { ownerProjectRegistries } from "../../apps/web/src/project-runtime";
import {
  WorkspaceHaStorage,
  WorkspaceHaStorageProvider,
} from "../../apps/web/src/workspaces/WorkspaceHaStorage";
import { exportWorkspaceBackup } from "../../apps/web/src/workspaces/workspace-transfer";
import {
  fingerprintWorkspace,
  writeSyncCursor,
} from "../../apps/web/src/workspaces/workspace-sync-state";

export async function mountHaStorageHarness(
  options: {
    missing?: boolean;
    panelMissing?: boolean;
    panelError?: boolean;
    fullPage?: boolean;
  } = {},
) {
  const repository = createWorkspaceRepository(indexedDB, ownerProjectRegistries);
  const blank = await repository.createBlank("Lake house");
  const entry = await repository.setConnection(
    blank.metadata.id,
    blank.record!.revision,
    "https://ha.test",
  );
  let remote: { version: number; document: string } | null = null;
  const runtime = {
    status: "connected",
    origin: "https://ha.test",
    configured: true,
    connect() {},
    disconnect: async () => {},
    sendStorageMessage: async (message: Record<string, unknown>) => {
      if (message.type === "get_panels") {
        if (options.panelError) throw new Error("Panel discovery unavailable");
        return options.missing || options.panelMissing
          ? {}
          : {
              cabane: {
                component_name: "custom",
                config: { _panel_custom: { name: "cabane-panel" } },
              },
            };
      }
      if (options.missing) throw { code: "unknown_command" };
      if (message.type === "cabane/workspaces/get") return remote;
      if (message.type === "cabane/workspaces/put") {
        if ((remote?.version ?? null) !== message.expected_version) throw { code: "conflict" };
        remote = { version: (remote?.version ?? 0) + 1, document: message.document as string };
        return remote.version;
      }
      if (message.type === "cabane/workspaces/delete") {
        remote = null;
        return null;
      }
      if (message.type === "cabane/workspaces/list") return [];
      throw { code: "unknown_command" };
    },
  };
  const container = document.createElement("div");
  document.body.append(container);
  function Settings() {
    const [record, setRecord] = useState(entry.record!);
    return (
      <WorkspaceHaStorageProvider
        id={entry.metadata.id}
        origin="https://ha.test"
        repository={repository}
      >
        <HomeEditor
          initialRecord={record}
          initialRequest={{ mode: "construct", panel: "settings", settingsSection: "backups" }}
          lifecycle={createBrowserHomeProjectLifecycle(indexedDB, entry.metadata.id)}
          homeAssistantUrl="https://ha.test"
          onClose={setRecord}
          isDemo={false}
          onCreatePersonal={() => {}}
        />
      </WorkspaceHaStorageProvider>
    );
  }
  const root = createRoot(container);
  root.render(
    <MemoryRouter initialEntries={[window.location.pathname + window.location.search]}>
      <HomeAssistantRuntimeValueProvider value={runtime as never}>
        {options.fullPage ? (
          <Settings />
        ) : (
          <WorkspaceHaStorage
            id={entry.metadata.id}
            origin="https://ha.test"
            repository={repository}
          />
        )}
      </HomeAssistantRuntimeValueProvider>
    </MemoryRouter>,
  );
  return {
    unmount: () => {
      root.unmount();
      container.remove();
    },
    id: entry.metadata.id,
    getRemoteVersion: () => remote?.version ?? null,
    repository,
    setIntegrationInstalled: () => {
      options.missing = false;
      options.panelMissing = false;
      options.panelError = false;
    },
  };
}

export async function mountHaStorageBackgroundHarness() {
  const repository = createWorkspaceRepository(indexedDB, ownerProjectRegistries);
  const entry = await repository.createBlank("Background sync home");
  let remote = { version: 1, document: exportWorkspaceBackup(entry.metadata, entry.record!) };
  await writeSyncCursor(indexedDB, {
    origin: "https://ha.test",
    homeId: entry.metadata.id,
    enabled: true,
    remoteVersion: 1,
    acknowledgedFingerprint: await fingerprintWorkspace(entry.metadata, entry.record!),
  });
  const runtime = {
    status: "connected",
    origin: "https://ha.test",
    configured: true,
    sendStorageMessage: async (message: Record<string, unknown>) => {
      if (message.type === "cabane/workspaces/get") return remote;
      if (message.type === "cabane/workspaces/put") {
        if (remote.version !== message.expected_version) throw { code: "conflict" };
        remote = { version: remote.version + 1, document: message.document as string };
        return remote.version;
      }
      throw { code: "unknown_command" };
    },
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  root.render(
    <HomeAssistantRuntimeValueProvider value={runtime as never}>
      <WorkspaceHaStorageProvider
        id={entry.metadata.id}
        origin="https://ha.test"
        repository={repository}
      >
        <div>Construct editor, without Connection settings</div>
      </WorkspaceHaStorageProvider>
    </HomeAssistantRuntimeValueProvider>,
  );
  return {
    unmount: () => {
      root.unmount();
      container.remove();
    },
    id: entry.metadata.id,
    repository,
    getRemoteVersion: () => remote.version,
  };
}

export async function mountHaOpenHarness(
  options: { divergent?: boolean; wrongOrigin?: boolean; missing?: boolean } = {},
) {
  const repository = createWorkspaceRepository(indexedDB, ownerProjectRegistries);
  const blank = await repository.createBlank("Remote cottage");
  const entry = await repository.setConnection(
    blank.metadata.id,
    blank.record!.revision,
    options.wrongOrigin ? "https://other.test" : "https://ha.test",
  );
  const document = exportWorkspaceBackup(entry.metadata, entry.record!);
  if (options.divergent) {
    await writeSyncCursor(indexedDB, {
      origin: "https://ha.test",
      homeId: entry.metadata.id,
      enabled: false,
      remoteVersion: 1,
      acknowledgedFingerprint: await fingerprintWorkspace(entry.metadata, entry.record!),
    });
    await repository.rename(entry.metadata.id, entry.record!.revision, "My local changes");
  } else await repository.delete(entry.metadata.id, await repository.readRaw(entry.metadata.id));
  let opened: string | null = null;
  const calls: string[] = [];
  const runtime = {
    status: "connected",
    origin: "https://ha.test",
    configured: true,
    sendStorageMessage: async (message: Record<string, unknown>) => {
      calls.push(String(message.type));
      if (message.type === "cabane/workspaces/get")
        return options.missing ? null : { version: 2, document };
      throw new Error("Opening must never upload or control devices");
    },
  };
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const onOpened = async (id: string) => {
    opened = id;
  };
  const root = createRoot(container);
  root.render(
    <MemoryRouter>
      <HomeAssistantRuntimeValueProvider value={runtime as never}>
        <WorkspaceOpenContent
          repository={repository}
          target={{ homeId: entry.metadata.id, origin: "https://ha.test", dashboard: true }}
          onOpened={onOpened}
        />
      </HomeAssistantRuntimeValueProvider>
    </MemoryRouter>,
  );
  return {
    unmount: () => {
      root.unmount();
      container.remove();
    },
    id: entry.metadata.id,
    repository,
    getOpened: () => opened,
    getCalls: () => calls,
  };
}
