import { useState } from "react";
import { newReadingDescriptor } from "./connection-candidates";
import { bindingEntityCandidates } from "../binding-entity-candidates";
import type {
  EntityId,
  HomeAssistantRuntimeSnapshot,
  RuntimeBindingProfile,
} from "../types";
import { entityDeviceNames, type MappingOption } from "./auxiliary-mapping-choices";
import { mappingOptionMatches } from "./MappingChoicePicker";

interface ReadingOption extends MappingOption {
  value: EntityId;
  detail: string;
}

export const readingMappingOptions = (
  profile: RuntimeBindingProfile,
  runtime: HomeAssistantRuntimeSnapshot,
): ReadingOption[] => {
  const names = entityDeviceNames(runtime);
  return bindingEntityCandidates({
    descriptor: newReadingDescriptor,
    roomId: "",
    profile,
    runtime,
    scope: "all-areas",
  }).map((candidate) => ({
    value: candidate.entityId,
    label: candidate.label,
    searchText: names.get(candidate.entityId) ?? "",
    detail: [
      names.get(candidate.entityId),
      candidate.areaLabel,
      candidate.stateLabel === "Available" ? "" : candidate.stateLabel,
    ]
      .filter(Boolean)
      .join(" · "),
    disabled: candidate.disabled || candidate.hidden,
  }));
};

export function AddReadingPicker({
  options,
  query,
  attached,
  disabled,
  onAdd,
}: {
  options: readonly ReadingOption[];
  query: string;
  attached: readonly EntityId[];
  disabled: boolean;
  onAdd: (entityId: EntityId) => void;
}) {
  const [limit, setLimit] = useState(8);
  const matches = options.filter((option) => mappingOptionMatches(option, query));
  return (
    <details className="device-mapping-inspector__add-reading" open={Boolean(query.trim())}>
      <summary>Add reading</summary>
      <p>Choose a sensor or event to show its reading on this object.</p>
      {matches.slice(0, limit).map((option) => {
        const added = attached.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className="device-mapping-inspector__reading-option"
            aria-label={`Add ${option.label} as reading`}
            disabled={disabled || option.disabled || added}
            onClick={() => onAdd(option.value)}
          >
            <span>
              <strong>{option.label}</strong>
              <span className="device-mapping-inspector__entity-id">{option.detail}</span>
              <span className="device-mapping-inspector__entity-id">{option.value}</span>
            </span>
            <span>{added ? "Added" : "Add"}</span>
          </button>
        );
      })}
      {!matches.length && (
        <p role="status">
          {disabled ? "Reconnect to load readings." : "No readings match this search."}
        </p>
      )}
      {matches.length > limit && (
        <button
          type="button"
          className="device-mapping-inspector__more"
          onClick={() => setLimit(limit + 8)}
        >
          Show {Math.min(8, matches.length - limit)} more · {matches.length} matches
        </button>
      )}
    </details>
  );
}
