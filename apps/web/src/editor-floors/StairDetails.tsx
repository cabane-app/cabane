import { MeasurementText } from "@cabane/engine";
import { LengthInput } from "../editor-chrome/LengthInput";
import { omitUndefinedProperties } from "@cabane/engine";
import { StairShapeSelect } from "./StairShapeSelect";
import { convertStairShape } from "./stair-placement-geometry";
import {
  canDraftStair,
  validateStairCandidate,
  type StairValidationRegistries,
} from "./stair-candidate-validation";
import { useEffect, useMemo, useState } from "react";
import { type HomeProject, type ManifestIssue, type StairSpec } from "@cabane/engine";
import { SelectionDetailsPanel } from "../editor-chrome/SelectionDetailsPanel";
import { StairNumberField } from "./StairNumberField";
import { StairWarnings } from "./StairWarnings";

export function StairDetails({
  project,
  stair,
  registries,
  liveIssues,
  onSave,
  onCancel,
}: {
  project: HomeProject;
  stair: StairSpec;
  onSave: (stair: StairSpec) => void;
  onCancel: () => void;
  registries?: StairValidationRegistries;
  liveIssues?: readonly ManifestIssue[] | null;
}) {
  const [draft, setDraft] = useState(stair);
  useEffect(() => setDraft(stair), [stair]);
  const draftIssues = useMemo(
    () => validateStairCandidate(project, draft, registries),
    [project, draft, registries],
  );
  const issues = liveIssues ?? draftIssues;
  const update = (next: StairSpec) => {
    setDraft(next);
    if (canDraftStair(project, next)) onSave(next);
  };
  const length = (
    label: string,
    value: number,
    onCommit: (value: number) => void,
    minimum?: number,
    metersPerUnit = 1,
  ) => (
    <label className="construction-inspector__single-control">
      {label}
      <LengthInput
        label={label}
        value={value}
        min={minimum === 0 ? 0.01 : minimum}
        metersPerUnit={metersPerUnit}
        onCommit={onCommit}
      />
    </label>
  );
  const planScale = project.floors.find((floor) => floor.id === draft.lowerFloorId)!.coordinates
    .metersPerPlanUnit;
  const number = (
    label: string,
    value: number,
    onCommit: (value: number) => void,
    minimum?: number,
    maximum?: number,
  ) => (
    <StairNumberField
      key={label}
      label={label}
      value={value}
      minimum={minimum}
      maximum={maximum}
      onCommit={onCommit}
    />
  );
  return (
    <SelectionDetailsPanel
      mode="construct"
      title="Stairs"
      subtitle={`To ${project.floors.find((f) => f.id === draft.upperFloorId)?.name}`}
      label="Stair properties"
      onClose={onCancel}
    >
      <StairShapeSelect
        value={draft.shape ?? "straight"}
        onChange={(shape) => update(convertStairShape(project, draft, shape))}
      />
      {draft.shape === "spiral" ? (
        <>
          {length(
            "Diameter",
            draft.diameterMeters,
            (diameterMeters) => update({ ...draft, diameterMeters }),
            0.2,
          )}
          {number(
            "Total turn (degrees)",
            draft.totalTurnDegrees,
            (totalTurnDegrees) => update({ ...draft, totalTurnDegrees }),
            0,
            360,
          )}
          <label className="construction-inspector__single-control stair-direction-control">
            Direction
            <select
              aria-label="Spiral direction"
              value={draft.direction}
              onChange={(event) =>
                update({
                  ...draft,
                  direction: event.target.value as "clockwise" | "counterclockwise",
                })
              }
            >
              <option value="clockwise">Clockwise</option>
              <option value="counterclockwise">Counterclockwise</option>
            </select>
          </label>
        </>
      ) : (
        <>
          {length(
            "Width",
            draft.widthMeters,
            (widthMeters) => update({ ...draft, widthMeters }),
            0,
          )}
          {draft.shape === "l-shaped" || draft.shape === "u-shaped" ? (
            <>
              {length(
                "Lower flight length",
                draft.lowerRunMeters,
                (lowerRunMeters) => update({ ...draft, lowerRunMeters }),
                0,
              )}
              {length(
                "Upper flight length",
                draft.upperRunMeters,
                (upperRunMeters) => update({ ...draft, upperRunMeters }),
                0,
              )}
              <label className="construction-inspector__single-control">
                Turn
                <select
                  aria-label="Stair turn"
                  value={draft.turn}
                  onChange={(event) =>
                    update({ ...draft, turn: event.target.value as "left" | "right" })
                  }
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </label>
            </>
          ) : (
            length("Length", draft.runMeters, (runMeters) => update({ ...draft, runMeters }), 0)
          )}
        </>
      )}
      <label className="construction-inspector__single-control">
        Railings
        <select
          aria-label="Stair railings"
          value={draft.railings ?? "both"}
          onChange={(event) =>
            update(
              omitUndefinedProperties({
                ...draft,
                ...((event.target.value as StairSpec["railings"]) === undefined
                  ? {}
                  : { railings: event.target.value as StairSpec["railings"] }),
              }),
            )
          }
        >
          <option value="both">Both sides</option>
          <option value="left">Left side</option>
          <option value="right">Right side</option>
          <option value="none">None</option>
        </select>
        <span>Left and right when walking upstairs.</span>
      </label>
      <details className="selection-details-advanced">
        <summary>Advanced</summary>
        {number("Rotation (degrees)", (draft.rotationYRadians * 180) / Math.PI, (value) =>
          update({ ...draft, rotationYRadians: (value * Math.PI) / 180 }),
        )}
        {length(
          draft.shape === "spiral" ? "Center X" : "Start X",
          draft.at[0],
          (value) => update({ ...draft, at: [value, draft.at[1]] }),
          undefined,
          planScale,
        )}
        {length(
          draft.shape === "spiral" ? "Center Y" : "Start Y",
          draft.at[1],
          (value) => update({ ...draft, at: [draft.at[0], value] }),
          undefined,
          planScale,
        )}
      </details>
      <StairWarnings issues={issues} />
      {issues
        .filter((issue) => issue.severity !== "warning")
        .map((issue, index) => (
          <p role="alert" key={`${issue.code}:${index}`}>
            <MeasurementText>{issue.message}</MeasurementText>
          </p>
        ))}
    </SelectionDetailsPanel>
  );
}
