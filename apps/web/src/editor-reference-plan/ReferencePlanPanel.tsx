import { MeasurementText } from "@cabane/engine";
import { LengthInput } from "../editor-chrome/LengthInput";
import { useState } from "react";
import { SidebarSectionSummary } from "../editor-chrome/SidebarSectionSummary";
import { EditorButton } from "../editor-chrome/EditorButton";
import type { ReferencePlanController } from "./useReferencePlan";
import "./reference-plan.css";
export function ReferencePlanPanel({
  reference: r,
  floorName,
}: {
  reference: ReferencePlanController;
  floorName: string;
}) {
  const input = r.input;
  const [distance, setDistance] = useState("");
  const plan = r.plan;
  return (
    <section className="reference-plan" aria-label="Reference plan">
      <input
        ref={input}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(event) => {
          if (event.target.files?.length) void r.upload(event.target.files);
          event.target.value = "";
        }}
      />
      <details
        className="construction-inspector__floor-disclosure"
        open={r.expanded || r.adjusting}
        onToggle={(event) => {
          if (!r.adjusting) r.setExpanded(event.currentTarget.open);
          else if (!event.currentTarget.open) event.currentTarget.open = true;
        }}
      >
        <SidebarSectionSummary
          icon="plan"
          title="Reference plan"
          description="Add a floor plan image to trace."
        />
        {!plan ? (
          <div className="reference-plan__content sidebar-section-content">
            <EditorButton disabled={r.disabled} onClick={r.openPicker}>
              Add image
            </EditorButton>
          </div>
        ) : (
          <div className="reference-plan__content sidebar-section-content">
            <p className="reference-plan__filename" title={plan.name}>
              {plan.name}
            </p>
            <p className="reference-plan__storage">{floorName} · Saved in this browser only</p>
            <label className="reference-plan__visible">
              <input
                type="checkbox"
                checked={r.preference.visible}
                disabled={r.adjusting}
                onChange={(event) => r.setPreference({ visible: event.target.checked })}
              />
              Show reference plan
            </label>
            <label className="reference-plan__opacity">
              Opacity{" "}
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(r.preference.opacity * 100)}
                onChange={(event) => r.setPreference({ opacity: Number(event.target.value) / 100 })}
              />
              <output>{Math.round(r.preference.opacity * 100)}%</output>
            </label>
            {!r.adjusting ? (
              <>
                <div className="reference-plan__actions">
                  <EditorButton disabled={r.disabled} onClick={() => r.begin()}>
                    Adjust
                  </EditorButton>
                  <EditorButton disabled={r.disabled} onClick={() => r.begin(true)}>
                    Set scale
                  </EditorButton>
                </div>
                <div className="reference-plan__secondary">
                  <EditorButton variant="text" disabled={r.disabled} onClick={r.openPicker}>
                    Replace image
                  </EditorButton>
                  <EditorButton variant="text" disabled={r.disabled} onClick={r.remove}>
                    Remove
                  </EditorButton>
                </div>
              </>
            ) : (
              <>
                <p role="status">
                  {r.calibrating
                    ? r.points.length < 2
                      ? "Click two points on the image with a known distance between them."
                      : "Enter the real distance between these points."
                    : "Drag to move. Use corner handles to resize and the top handle to rotate."}
                </p>
                {r.calibrating ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      r.calibrate(Number(distance));
                    }}
                  >
                    <label>
                      Distance
                      <LengthInput
                        label="Reference distance"
                        min={0.0001}
                        value={Number(distance)}
                        onCommit={(value) => setDistance(String(value))}
                      />
                    </label>
                    <EditorButton type="submit" variant="primary" disabled={r.points.length !== 2}>
                      Apply scale
                    </EditorButton>
                  </form>
                ) : (
                  <EditorButton onClick={() => r.begin(true)}>Set scale</EditorButton>
                )}
                <div className="reference-plan__actions">
                  <EditorButton variant="primary" onClick={r.done} disabled={r.calibrating}>
                    Done
                  </EditorButton>
                  <EditorButton onClick={r.cancel}>Cancel</EditorButton>
                </div>
              </>
            )}
          </div>
        )}
      </details>
      {r.loading && <p role="status">Opening image…</p>}
      {r.error && (
        <p role="alert" className="reference-plan__error">
          <MeasurementText>{r.error}</MeasurementText>
        </p>
      )}
      {r.storage.error && (
        <div role="alert" className="reference-plan__error">
          <p>
            <MeasurementText>{r.storage.error}</MeasurementText>
          </p>
          <EditorButton onClick={r.storage.retry}>Retry</EditorButton>
        </div>
      )}
    </section>
  );
}
