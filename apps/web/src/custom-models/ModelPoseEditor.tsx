import {
  CUSTOM_MODEL_PROFILES,
  modelPoseStates,
  type CustomModelPoses,
  type CustomModelProfile,
} from "@cabane/engine";
import type { AnimationClip } from "three";
import { EditorButton } from "../editor-chrome/EditorButton";

export function ModelPoseEditor({
  poses,
  profile,
  onProfileChange,
  value,
  onChange,
  preview,
  onPreview,
}: {
  poses: readonly AnimationClip[];
  profile: CustomModelProfile;
  onProfileChange: (value: CustomModelProfile) => void;
  value: CustomModelPoses | undefined;
  onChange: (value: CustomModelPoses | undefined) => void;
  preview: string | undefined;
  onPreview: (value: string | undefined) => void;
}) {
  const states = modelPoseStates(profile);
  const options = poses.map((pose, index) => (
    <option key={index} value={String(index)}>
      {pose.name || `Pose ${index + 1}`}
    </option>
  ));
  const update = (state: string, pose: string) => {
    const next = { ...value?.states };
    if (pose) next[state] = pose;
    else delete next[state];
    onChange({ ...value, states: next });
    onPreview(pose || value?.defaultPose);
  };
  return (
    <section className="model-pose-editor" aria-label="State appearance">
      <h3>Match a pose to each state</h3>
      <p className="model-import-hint">
        Choose how the model looks. Connect its Home Assistant entity later.
      </p>
      <label className="model-pose-profile">
        Controlled by
        <select
          aria-label="State profile"
          value={profile}
          onChange={(event) => onProfileChange(event.target.value as CustomModelProfile)}
        >
          <option value="furniture">No device · fixed appearance</option>
          {CUSTOM_MODEL_PROFILES.filter(([id]) => modelPoseStates(id).length).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          {profile !== "furniture" && !states.length && (
            <option value={profile}>
              {CUSTOM_MODEL_PROFILES.find(([id]) => id === profile)?.[1]}
            </option>
          )}
        </select>
      </label>
      {states.length > 0 ? (
        <div className="model-pose-mappings">
          <div className="model-pose-column-labels">
            <span>When the device is</span>
            <span>Show this pose</span>
          </div>
          {states.map((state) => (
            <div className="model-pose-row" key={state}>
              <span className="model-pose-state">{state[0]!.toUpperCase() + state.slice(1)}</span>
              <select
                aria-label={`${state} pose`}
                value={value?.states[state] ?? ""}
                onChange={(event) => update(state, event.target.value)}
              >
                <option value="">Default appearance</option>
                {options}
              </select>
              <EditorButton
                aria-label={`Preview ${state}`}
                aria-pressed={preview === (value?.states[state] ?? value?.defaultPose)}
                onClick={() => onPreview(value?.states[state] ?? value?.defaultPose)}
              >
                Preview
              </EditorButton>
            </div>
          ))}
        </div>
      ) : (
        <p className="model-import-hint">
          Choose a device type above to use different poses for its states.
        </p>
      )}
      <details className="model-import-details" open={!states.length || undefined}>
        <summary>Default appearance</summary>
        <label>
          When no state is available
          <select
            aria-label="Default pose"
            value={value?.defaultPose ?? ""}
            onChange={(event) => {
              const next: CustomModelPoses = { states: value?.states ?? {} };
              if (event.target.value) next.defaultPose = event.target.value;
              onChange(next);
              onPreview(event.target.value || undefined);
            }}
          >
            <option value="">Original</option>
            {options}
          </select>
        </label>
      </details>
      {value && (
        <EditorButton
          className="model-pose-reset"
          onClick={() => {
            onChange(undefined);
            onPreview(undefined);
          }}
        >
          Reset to static model
        </EditorButton>
      )}
    </section>
  );
}
