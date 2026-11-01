import { useMemo, useState } from "react";
import type { BindingEntityCandidateScope } from "../binding-profile-contract";
import { DeviceCategoryIcon } from "../DeviceCategoryIcon";
import type {
  BindingSlotDescriptor,
  EntityId,
  HomeAssistantRuntimeSnapshot,
  RuntimeBindingProfile,
} from "../types";
import { connectionCandidates } from "./connection-candidates";
import { entityConnectionSummary } from "./connection-presentation";
import { ConnectionIcon } from "./ConnectionIcon";
import "./connection-workbench.css";

export function ConnectionSourcePicker({
  descriptor,
  roomId,
  profile,
  runtime,
  selected,
  disabled,
  title,
  description,
  preferredDeviceId,
  attached = [],
  onSelect,
  onBack,
  onDisconnect,
  scope = "all-areas",
}: {
  descriptor: BindingSlotDescriptor;
  roomId: string;
  profile: RuntimeBindingProfile;
  runtime: HomeAssistantRuntimeSnapshot;
  selected?: EntityId | undefined;
  disabled: boolean;
  scope?: BindingEntityCandidateScope;
  title: string;
  description: string;
  preferredDeviceId?: string | null | undefined;
  attached?: readonly EntityId[];
  onSelect: (entityId: EntityId) => void;
  onBack?: (() => void) | undefined;
  onDisconnect?: (() => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All types");
  const [limit, setLimit] = useState(20);
  const [showIds, setShowIds] = useState(false);
  const sources = useMemo(
    () => connectionCandidates(descriptor, roomId, profile, runtime, preferredDeviceId, scope),
    [descriptor, roomId, profile, runtime, preferredDeviceId, scope],
  );
  const filters = [...new Set(sources.map((source) => source.type))].sort();
  const queryWords = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = sources.filter(
    (source) =>
      (filter === "All types" || source.type === filter) &&
      queryWords.every((word) => source.searchText.includes(word)),
  );
  const shown = matches.slice(0, limit);
  const suggested = shown.filter((source) => source.suggested);
  const others = shown.filter((source) => !source.suggested);
  const renderSource = (source: (typeof sources)[number]) => {
    const added = attached.includes(source.entityId);
    const summary = entityConnectionSummary(source.entityId, runtime);
    return (
      <button
        type="button"
        key={source.entityId}
        className={`connection-source${selected === source.entityId ? " is-selected" : ""}`}
        aria-label={`${source.label} · ${source.deviceName || source.areaLabel} · ${source.entityId}${added ? " · Added" : ""}`}
        aria-pressed={selected === source.entityId}
        disabled={disabled || added || source.disabled || source.hidden}
        onClick={() => onSelect(source.entityId)}
      >
        {source.type === "Water" ? (
          <ConnectionIcon name="water" />
        ) : source.type === "Temperature" ? (
          <ConnectionIcon name="temperature" />
        ) : (
          <DeviceCategoryIcon domain={source.domain} />
        )}
        <span className="connection-source__identity">
          <strong>{source.label}</strong>
          <span>{[source.deviceName, source.areaLabel].filter(Boolean).join(" · ")}</span>
          {source.matchRank > 0 && <small>On/off only</small>}
          {source.stateLabel !== "Available" && <small>{source.stateLabel}</small>}
          {source.claimed && <small>Also used by another connection</small>}
          {showIds && <code>{source.entityId}</code>}
        </span>
        <span className="connection-source__value">
          {added ? "Added" : summary.value}
          {selected === source.entityId && <ConnectionIcon name="check" />}
        </span>
      </button>
    );
  };
  return (
    <section className="connection-source-picker" aria-label={`${title} sources`}>
      {onBack && (
        <button type="button" className="connection-mobile-back" onClick={onBack}>
          <ConnectionIcon name="back" />
          Connections
        </button>
      )}
      <header className="connection-column-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="connection-source-picker__tools">
        <label className="connection-search">
          <ConnectionIcon name="search" />
          <input
            type="search"
            aria-label="Search all compatible sources"
            placeholder="Search sensors, devices, names or IDs…"
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setLimit(20);
            }}
          />
        </label>
        <div className="connection-type-filters" role="group" aria-label="Filter by type">
          {["All types", ...filters].map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={filter === type}
              onClick={() => {
                setFilter(type);
                setLimit(20);
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <p className="connection-source-scope">
          {scope === "all-areas" ? "All Home Assistant areas" : "Room’s Home Assistant area"} ·
          compatible sources only
        </p>
      </div>
      <div className="connection-source-list">
        {suggested.length > 0 && (
          <>
            <h3>Suggested for this device</h3>
            {suggested.map(renderSource)}
          </>
        )}
        {others.length > 0 && (
          <>
            <h3>{suggested.length ? "All other compatible sources" : "Compatible sources"}</h3>
            {others.map(renderSource)}
          </>
        )}
        {!matches.length && (
          <div className="connection-source-empty" role="status">
            <h3>{disabled ? "Home Assistant is offline" : "No matching sources"}</h3>
            <p>
              {disabled
                ? "Reconnect to choose a source. Your saved connections are retained."
                : "Try another source name, device name or ID."}
            </p>
            {(query || filter !== "All types") && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("All types");
                }}
              >
                Clear search and filters
              </button>
            )}
          </div>
        )}
        {matches.length > shown.length && (
          <button className="connection-more" type="button" onClick={() => setLimit(limit + 20)}>
            Show {Math.min(20, matches.length - limit)} more · {matches.length} matches
          </button>
        )}
      </div>
      <footer>
        <span>
          {matches.length} {matches.length === 1 ? "source" : "sources"}
        </span>
        <button type="button" onClick={() => setShowIds(!showIds)}>
          {showIds ? "Hide" : "Show"} entity IDs
        </button>
        {selected && onDisconnect && (
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        )}
      </footer>
    </section>
  );
}
