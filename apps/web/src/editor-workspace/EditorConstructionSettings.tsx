import type { ReactNode } from "react";
import { EditorButton } from "../editor-chrome/EditorButton";
import { SidebarSectionSummary } from "../editor-chrome/SidebarSectionSummary";
import { PlanImportActions } from "../editor-plan-import/PlanImportActions";
import { FloorSettingsEditor } from "../editor-preview/construct/FloorSettingsEditor";
import { NorthSettingsEditor } from "../editor-preview/construct/NorthSettingsEditor";
import { RoofSettingsEditor } from "../editor-preview/construct/RoofSettingsEditor";
import { TerrainSettingsEditor } from "../editor-preview/construct/TerrainSettingsEditor";
import { ReferencePlanPanel } from "../editor-reference-plan/ReferencePlanPanel";
import type { useHomeEditorController } from "./useHomeEditorController";

const PLAN_IMPORT_ENABLED = false;

type Props = Pick<
  ReturnType<typeof useHomeEditorController>,
  | "activeFloorId"
  | "cameraView"
  | "clearConstructionSelection"
  | "constructEditor"
  | "executeProjectAction"
  | "northOrientation"
  | "reference"
  | "snapshot"
  | "stairPlacement"
  | "unsettled"
> & {
  importWorkspace: (json: string) => void;
  placingWalkStart: boolean;
  setWalkStartFloor: (id: string | null) => void;
  tutorialPanel: ReactNode;
  tutorialBusy: boolean;
  onRestartTutorial: () => void;
};

export function EditorConstructionSettings({
  activeFloorId,
  cameraView,
  clearConstructionSelection,
  constructEditor,
  executeProjectAction,
  northOrientation,
  reference,
  snapshot,
  stairPlacement,
  unsettled,
  importWorkspace,
  placingWalkStart,
  setWalkStartFloor,
  tutorialPanel,
  tutorialBusy,
  onRestartTutorial,
}: Props) {
  const { home } = snapshot.project;
  return (
    <div className="construction-inspector">
      <div inert={reference.adjusting || Boolean(stairPlacement)}>{tutorialPanel}</div>
      <ReferencePlanPanel reference={reference} floorName={constructEditor.previewFloor.name} />
      <div inert={reference.adjusting || Boolean(stairPlacement)}>
        {PLAN_IMPORT_ENABLED && (
          <PlanImportActions homeId={home.id} disabled={tutorialBusy} onImport={importWorkspace} />
        )}
        <details className="construction-inspector__floor-disclosure">
          <SidebarSectionSummary
            icon="roof"
            title="Roof"
            description="Set roof direction and colors."
          />
          <RoofSettingsEditor
            value={home.roof}
            onChange={(roof) =>
              executeProjectAction({ type: "update-home-settings", changes: { roof } })
            }
          />
        </details>
        <NorthSettingsEditor
          value={home.northAngleDegrees ?? 0}
          disabled={unsettled}
          onEdit={northOrientation.start}
        />
        <TerrainSettingsEditor
          value={home.terrain}
          disabled={(home.apartmentFloor ?? 0) > 0}
          onChange={(terrain) =>
            executeProjectAction({ type: "update-home-settings", changes: { terrain } })
          }
        />
        {cameraView === "top" && (
          <details className="construction-inspector__floor-disclosure">
            <SidebarSectionSummary
              icon="spawn"
              title="Spawn area"
              description="Choose where you start in Explore."
            />
            <div
              className="construction-walk-start sidebar-section-content"
              role="group"
              aria-label="Walk starting point"
            >
              <EditorButton
                aria-pressed={placingWalkStart}
                disabled={unsettled && !placingWalkStart}
                onClick={() => {
                  clearConstructionSelection();
                  constructEditor.setTool("select");
                  setWalkStartFloor(placingWalkStart ? null : activeFloorId);
                }}
              >
                {placingWalkStart
                  ? "Cancel"
                  : home.walkStart
                    ? "Move starting point"
                    : "Set starting point"}
              </EditorButton>
              {placingWalkStart && (
                <p role="status">
                  Click inside the floor to set your starting point. Escape cancels.
                </p>
              )}
              {home.walkStart && (
                <EditorButton
                  variant="text"
                  onClick={() => {
                    executeProjectAction({ type: "set-walk-start", walkStart: null });
                    setWalkStartFloor(null);
                  }}
                >
                  Use automatic start
                </EditorButton>
              )}
            </div>
          </details>
        )}
        <details className="construction-inspector__floor-disclosure">
          <SidebarSectionSummary
            icon="measure"
            title="Scale & heights"
            description="Set plan scale and wall and ceiling heights."
          />
          <FloorSettingsEditor editor={constructEditor} />
        </details>
        {!tutorialPanel && (
          <details className="construction-inspector__floor-disclosure">
            <SidebarSectionSummary
              icon="tutorial"
              title="Tutorial"
              description="Learn to draw and furnish your first room."
            />
            <div className="sidebar-section-content">
              <EditorButton disabled={tutorialBusy} onClick={onRestartTutorial}>
                Restart tutorial
              </EditorButton>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
