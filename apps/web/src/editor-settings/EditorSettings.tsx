import { useState, type ReactNode } from "react";
import {
  ScenePreferences,
  createHomeProjectRepository,
  createIndexedDbProjectRecordStore,
  type HomeProjectRecord,
  type WeatherSource,
} from "@cabane/engine";
import { HomeAssistantPage } from "../workspaces/HomeAssistantPage";
import { ownerProjectRegistries } from "../project-runtime";
import { updateWorkspaceWeatherSource } from "../workspaces/workspace-weather-source";
import type { useHomeEditorController } from "../editor-workspace/useHomeEditorController";
import type { ConnectWorkspaceProps } from "../editor-workspace/editor-workspace-contract";
import { settingsSections, type SettingsSection } from "./settings-sections";
import "./editor-settings.css";

export function EditorSettings({
  section,
  controller,
  shortcuts,
  importWorkspace,
  onPrepareOrigin,
  isDemo = false,
  onCreatePersonal,
  onBusyChange,
}: {
  section: SettingsSection;
  controller: ReturnType<typeof useHomeEditorController>;
  shortcuts: ReactNode;
  importWorkspace: (json: string) => void;
  onPrepareOrigin: ConnectWorkspaceProps["onPrepareOrigin"];
  isDemo?: boolean;
  onCreatePersonal: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const {
    workspace,
    snapshot,
    homeAssistantUrl,
    lifecycle,
    connect,
    editingLocked,
    unsettled,
    publishOpen,
    previewOpen,
  } = controller;
  const [busy, setBusy] = useState(false);
  const entry = settingsSections.find((entry) => entry.id === section)!;
  const currentRecord = (): HomeProjectRecord => ({
    ...workspace.getRecord(),
    draft: snapshot.project,
    bindings: snapshot.bindings,
  });
  const updateRecord = async (save: (record: HomeProjectRecord) => Promise<HomeProjectRecord>) => {
    setBusy(true);
    onBusyChange(true);
    try {
      const flushed = await workspace.flush();
      if (flushed.status !== "saved")
        throw new Error("The draft could not be saved. Retry before changing settings.");
      const next = await save(workspace.getRecord());
      if (!workspace.adoptRecord(next))
        throw new Error("The workspace changed. Reopen Settings to retry.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };
  const changeOrigin = (origin: string | null) =>
    updateRecord(async (record) => {
      if (!onPrepareOrigin) throw new Error("Connection settings are unavailable in this preview.");
      return onPrepareOrigin(record, origin);
    });
  const changeWeatherSource =
    !isDemo && homeAssistantUrl
      ? (source: WeatherSource) =>
          updateRecord(async (record) => {
            const repository = createHomeProjectRepository(
              createIndexedDbProjectRecordStore(window.indexedDB),
              ownerProjectRegistries,
            );
            return repository.replace(
              updateWorkspaceWeatherSource(record, homeAssistantUrl, source),
              record.revision,
            );
          })
      : undefined;
  return (
    <section
      className="editor-settings"
      data-settings-section={section}
      aria-labelledby="editor-settings-title"
      inert={editingLocked || publishOpen || previewOpen}
    >
      <div className="editor-settings__content" key={section}>
        <header className="editor-settings__heading">
          <h1 id="editor-settings-title">{entry.label}</h1>
          <p>{entry.description}</p>
        </header>
        <fieldset className="editor-settings__fields" disabled={busy || unsettled}>
          {section === "shortcuts" ? (
            shortcuts
          ) : section === "home-assistant" || section === "backups" ? (
            <HomeAssistantPage
              section={section}
              record={currentRecord()}
              getCurrentRecord={currentRecord}
              lifecycle={lifecycle}
              origin={homeAssistantUrl}
              onChangeOrigin={changeOrigin}
              onRecordChange={() => undefined}
              onImportDraft={importWorkspace}
              onBusyChange={onBusyChange}
              isDemo={isDemo}
              onCreatePersonal={onCreatePersonal}
            />
          ) : (
            <>
              <ScenePreferences
                section={section}
                profile={connect.profile}
                onWeatherSourceChange={changeWeatherSource}
              />
              <p className="editor-settings__saved-note">
                Preferences are applied immediately. Device preferences stay in this browser.
              </p>
            </>
          )}
        </fieldset>
      </div>
    </section>
  );
}
