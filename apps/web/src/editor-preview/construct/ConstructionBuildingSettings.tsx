import { SidebarSectionSummary } from "../../editor-chrome/SidebarSectionSummary";
import { RoofSettingsEditor } from "./RoofSettingsEditor";
import { FloorSettingsEditor } from "./FloorSettingsEditor";
import type { ConstructionInspectorProps } from "./ConstructionInspector";

export function ConstructionBuildingSettings({
  inert,
  planImportControls,
  onRoofChange,
  roof,
  northControls,
  terrainControls,
  walkStartControls,
  tutorialControls,
  editor,
}: Pick<
  ConstructionInspectorProps,
  | "inert"
  | "planImportControls"
  | "onRoofChange"
  | "roof"
  | "northControls"
  | "terrainControls"
  | "walkStartControls"
  | "tutorialControls"
  | "editor"
>) {
  return (
    <div className="construction-inspector__context" inert={inert}>
      {planImportControls}
      {onRoofChange && (
        <details className="construction-inspector__floor-disclosure">
          <SidebarSectionSummary
            icon="roof"
            title="Roof"
            description="Set roof direction and colors."
          />
          <RoofSettingsEditor value={roof} onChange={onRoofChange} />
        </details>
      )}
      {northControls}
      {terrainControls}
      {walkStartControls}
      <details className="construction-inspector__floor-disclosure">
        <SidebarSectionSummary
          icon="measure"
          title="Scale & heights"
          description="Set plan scale and wall and ceiling heights."
        />
        <FloorSettingsEditor editor={editor} />
      </details>
      {tutorialControls}
    </div>
  );
}
