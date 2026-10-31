import { MeasurementText } from "@cabane/engine";
import { stableArchitectureModelRegistry } from "@cabane/catalog/architecture";

import {
  CabaneDashboard,
  FloorNavigationProvider,
  HomeAssistantRuntimeValueProvider,
  createEmptyRuntimeBindingProfile,
} from "@cabane/engine";

import { useHomeEditorController } from "./useHomeEditorController";

type Props = Pick<
  ReturnType<typeof useHomeEditorController>,
  | "activeFloorId"
  | "mode"
  | "editingLocked"
  | "publishOpen"
  | "previewOpen"
  | "connect"
  | "deviceModels"
  | "unsettled"
  | "walkButton"
  | "setPublishOpen"
  | "runtime"
  | "editedManifest"
  | "closeWalk"
  | "publishErrors"
  | "publishWarnings"
  | "publishIssues"
  | "publishMessage"
  | "publishing"
  | "publishProject"
>;
export function EditorCompletionDialogs({
  activeFloorId,
  mode,
  editingLocked,
  publishOpen,
  previewOpen,
  deviceModels,
  unsettled,
  walkButton,
  setPublishOpen,
  runtime,
  editedManifest,
  closeWalk,
  publishErrors,
  publishWarnings,
  publishIssues,
  publishMessage,
  publishing,
  publishProject,
}: Props) {
  return (
    <>
      {previewOpen && mode !== "connect" && (
        <section
          className="direction-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Explore draft"
        >
          {/* Explore shares the walking scene, but must not switch the editor behind it. */}
          <FloorNavigationProvider initialFloorId={activeFloorId}>
            <HomeAssistantRuntimeValueProvider
              value={{
                ...runtime,
                status: "unconfigured",
                configured: false,
                canMutate: false,
                origin: null,
                areas: [],
                devices: [],
                entityRegistry: [],
                entityStates: {},
                cameraClient: null,
                connect: () => undefined,
                retry: () => undefined,
                disconnect: async () => undefined,
                refresh: async () => undefined,
                callService: async () => {
                  throw new Error("Draft preview is non-operative.");
                },
              }}
            >
              <CabaneDashboard
                manifest={editedManifest}
                architectureModels={stableArchitectureModelRegistry}
                deviceModels={deviceModels}
                bindingManager={{
                  profile: createEmptyRuntimeBindingProfile(editedManifest.home.id),
                  loaded: true,
                  hasStoredProfile: false,
                  save: () => undefined,
                }}
                walkthrough={{
                  onExit: closeWalk,
                  pointerLockTarget: walkButton.current?.closest("main"),
                }}
              />
            </HomeAssistantRuntimeValueProvider>
          </FloorNavigationProvider>
          <div className="direction-dialog-bar">
            <div>
              <small>Explore draft</small>
              <strong>Check your changes at eye level.</strong>
            </div>
            <button type="button" autoFocus aria-keyshortcuts="Escape" onClick={closeWalk}>
              Back to editor<kbd aria-hidden="true">Esc</kbd>
            </button>
          </div>
        </section>
      )}

      {publishOpen && (
        <div className="direction-publish-backdrop" role="presentation">
          <section
            className="direction-publish-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-title"
          >
            <p>Save home</p>
            <h2 id="publish-title">
              {publishErrors.length > 0
                ? `${publishErrors.length} issue${publishErrors.length === 1 ? "" : "s"} to fix`
                : publishWarnings.length > 0
                  ? "Ready with warnings"
                  : "Ready to save"}
            </h2>
            <p className="direction-publish-dialog__summary">
              {publishErrors.length > 0
                ? "The current draft stays saved, but it cannot replace your live home yet."
                : "Saving replaces the version used by Home. Your draft remains editable."}
            </p>
            {publishIssues.length > 0 && (
              <ul>
                {publishIssues.map((issue) => (
                  <li
                    key={`${issue.code}:${issue.path}:${issue.message}`}
                    data-severity={issue.severity}
                  >
                    <span>{issue.severity === "error" ? "×" : "!"}</span>
                    <div>
                      <strong>
                        <MeasurementText>{issue.message}</MeasurementText>
                      </strong>
                      <small>{issue.path}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {publishMessage && (
              <div className="direction-publish-dialog__result" role="status">
                <MeasurementText>{publishMessage}</MeasurementText>
              </div>
            )}
            <footer>
              <button type="button" disabled={publishing} onClick={() => setPublishOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="is-primary"
                disabled={publishErrors.length > 0 || editingLocked || unsettled}
                onClick={() => void publishProject()}
              >
                {publishing
                  ? "Saving…"
                  : publishWarnings.length > 0
                    ? "Save anyway"
                    : "Save changes"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
