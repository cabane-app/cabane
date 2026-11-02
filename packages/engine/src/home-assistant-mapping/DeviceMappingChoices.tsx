import { useState } from "react";
import type { EntityId, HomeAssistantRuntimeSnapshot, RuntimeBindingProfile } from "../types";
import { entityDeviceNames, type MappingChoice } from "./auxiliary-mapping-choices";
import { AddReadingPicker, readingMappingOptions } from "./AddReadingPicker";
import { MappingChoicePicker, mappingOptionMatches } from "./MappingChoicePicker";

export function DeviceMappingChoices({
  primaryChoice,
  functionChoices,
  readingSlotIds,
  profile,
  runtime,
  disabled,
  open,
  onChoose,
  onChoiceElement,
  onAddReading,
}: {
  primaryChoice: MappingChoice;
  functionChoices: readonly MappingChoice[];
  readingSlotIds: readonly string[];
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  disabled: boolean;
  open: boolean;
  onChoose: (choice: MappingChoice, value: string, primary: boolean) => void;
  onChoiceElement?: ((element: HTMLElement | null) => void) | undefined;
  onAddReading?: ((entityId: EntityId) => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const names = entityDeviceNames(runtime);
  const searchableChoice = (choice: MappingChoice): MappingChoice => ({
    ...choice,
    options: choice.options.map((option) => ({
      ...option,
      searchText: names.get(option.value) ?? "",
    })),
  });
  const primary = searchableChoice(primaryChoice);
  const functions = functionChoices.map(searchableChoice);
  const choices = [primary, ...functions];
  const readingOptions = onAddReading ? readingMappingOptions(profile, runtime) : [];
  const hasReadings = readingSlotIds.length > 0;
  const required = functions.filter((choice) => choice.required);
  const optional = functions.filter((choice) => !choice.required);
  const renderChoice = (choice: MappingChoice, primary = false) => (
    <MappingChoicePicker
      key={`${choice.id}:${query}`}
      choice={choice}
      primary={primary}
      query={query}
      disabled={disabled}
      open={open}
      onChoose={(value) => onChoose(choice, value, primary)}
      onChoiceElement={onChoiceElement}
    />
  );
  return (
    <div className="device-mapping-inspector__choices">
      {(choices.some((choice) => choice.options.length > 0) || onAddReading) && (
        <input
          type="search"
          className="device-mapping-inspector__search"
          aria-label="Search Home Assistant matches"
          placeholder="Search devices and entities…"
          value={query}
          disabled={!open}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {query.trim() &&
        !readingOptions.some((option) => mappingOptionMatches(option, query)) &&
        !choices.some((choice) =>
          choice.options.some((option) => mappingOptionMatches(option, query)),
        ) && (
          <p className="device-mapping-inspector__empty" role="status">
            No compatible matches. Try another device, entity name or ID.
          </p>
        )}
      {renderChoice(
        hasReadings || onAddReading ? { ...primary, label: "Primary control" } : primary,
        true,
      )}
      {required.map((choice) => renderChoice(choice))}
      {optional.length > 0 && (
        <details
          className="device-mapping-inspector__functions"
          open={hasReadings || Boolean(query.trim())}
        >
          <summary>
            {hasReadings ? "Readings" : "Optional device functions"} <span>{optional.length}</span>
          </summary>
          <div>{optional.map((choice) => renderChoice(choice))}</div>
        </details>
      )}
      {onAddReading && (
        <AddReadingPicker
          key={query}
          options={readingOptions}
          query={query}
          attached={readingSlotIds.flatMap((id) => profile.entityIdsBySlotId[id] ?? [])}
          disabled={disabled || !open}
          onAdd={onAddReading}
        />
      )}
    </div>
  );
}
