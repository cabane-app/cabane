import { useState, type ReactNode } from "react";
import type { MappingChoice, MappingOption, MappingOptionGroup } from "./auxiliary-mapping-choices";

const PAGE_SIZE = 8;
const domId = (value: string) => value.replaceAll(/[^a-zA-Z0-9_-]/g, "-");

export const mappingOptionMatches = (option: MappingOption, query: string) =>
  `${option.label} ${option.value} ${option.searchText ?? ""}`
    .toLocaleLowerCase("en")
    .includes(query.trim().toLocaleLowerCase("en"));

export function MappingChoicePicker({
  choice,
  primary,
  query,
  disabled,
  open,
  onChoose,
  onChoiceElement,
}: {
  choice: MappingChoice;
  primary: boolean;
  query: string;
  disabled: boolean;
  open: boolean;
  onChoose: (value: string) => void;
  onChoiceElement?: ((element: HTMLElement | null) => void) | undefined;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const groupId = `device-map-${domId(choice.id)}`;
  const matchingOptions = choice.options.filter((option) => mappingOptionMatches(option, query));
  const selectedOption = choice.options.find((option) => option.value === choice.value);
  const visibleOptions = matchingOptions.slice(0, limit);
  if (selectedOption && !visibleOptions.includes(selectedOption))
    visibleOptions.unshift(selectedOption);
  const shown = new Set(visibleOptions.map((option) => option.value));
  const remaining = Math.max(0, matchingOptions.length - limit);
  const renderOption = (option: MappingOption) => {
    const optionId = `${groupId}-${domId(option.value || "empty")}`;
    const selected = choice.value === option.value;
    return (
      <label
        key={option.value}
        className="device-mapping-inspector__option"
        data-selected={selected ? "true" : "false"}
        data-disabled={option.disabled ? "true" : "false"}
        htmlFor={optionId}
      >
        <input
          id={optionId}
          type="radio"
          name={groupId}
          value={option.value}
          checked={selected}
          disabled={option.disabled || (disabled && Boolean(option.value))}
          tabIndex={open ? undefined : -1}
          onChange={() => onChoose(option.value)}
        />
        <span className="device-mapping-inspector__option-marker" aria-hidden="true" />
        <span>
          {option.label}
          {option.value.includes(".") && (
            <>
              {" "}
              <span className="device-mapping-inspector__entity-id">{option.value}</span>
            </>
          )}
        </span>
      </label>
    );
  };
  const groupOptions = (group: MappingOptionGroup): readonly MappingOption[] => [
    ...group.options,
    ...(group.groups ?? []).flatMap(groupOptions),
  ];
  const renderGroup = (group: MappingOptionGroup): ReactNode => {
    const visible = groupOptions(group).filter((option) => shown.has(option.value));
    if (!visible.length) return null;
    const content = (
      <>
        {group.options.filter((option) => shown.has(option.value)).map(renderOption)}
        {group.groups?.map(renderGroup)}
      </>
    );
    return group.collapsed ? (
      <details
        key={group.id ?? group.label}
        className="device-mapping-inspector__option-group"
        open={Boolean(query.trim()) || visible.some((option) => option.value === choice.value)}
      >
        <summary>
          <span className="device-mapping-inspector__group-label">{group.label}</span>
          <span className="device-mapping-inspector__group-count">{visible.length}</span>
          <svg
            className="device-mapping-inspector__group-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </summary>
        {content}
      </details>
    ) : (
      <div
        key={group.id ?? group.label}
        className="device-mapping-inspector__option-group"
        role="group"
        aria-label={group.label}
      >
        <p>{group.label}</p>
        {content}
      </div>
    );
  };
  return (
    <div className="device-mapping-inspector__choice">
      <fieldset aria-label={choice.ariaLabel} disabled={!open}>
        <legend>{choice.label}</legend>
        <details
          className="device-mapping-inspector__picker"
          open={(primary && !choice.value) || (Boolean(query.trim()) && matchingOptions.length > 0)}
        >
          <summary ref={primary ? onChoiceElement : undefined} tabIndex={open ? undefined : -1}>
            <span className="device-mapping-inspector__selection">
              {selectedOption?.summaryLabel ??
                selectedOption?.label ??
                (choice.value ? "Saved match unavailable" : "Not connected")}
            </span>
            <span className="device-mapping-inspector__picker-action">
              {choice.value ? "Change" : "Choose"}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m9 5 7 7-7 7" />
            </svg>
          </summary>
          <div className="device-mapping-inspector__options">
            {renderOption({ value: "", label: "Not connected" })}
            {choice.optionGroups
              ? choice.optionGroups.map(renderGroup)
              : visibleOptions.map(renderOption)}
            {choice.options.length === 0 && (
              <p className="device-mapping-inspector__empty" role="status">
                {disabled ? "Reconnect to load compatible matches." : choice.emptyLabel}
              </p>
            )}
            {query.trim() && choice.options.length > 0 && matchingOptions.length === 0 && (
              <p className="device-mapping-inspector__empty" role="status">
                No matching results. Clear search to see all compatible matches.
              </p>
            )}
            {remaining > 0 && (
              <button
                className="device-mapping-inspector__more"
                type="button"
                onClick={() => setLimit(limit + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, remaining)} more · {matchingOptions.length} matches
              </button>
            )}
          </div>
        </details>
      </fieldset>
    </div>
  );
}
