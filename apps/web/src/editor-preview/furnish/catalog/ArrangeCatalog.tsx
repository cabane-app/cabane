import { MeasurementText } from "@cabane/engine";
import { EditorButton } from "../../../editor-chrome/EditorButton";
import { type DeviceModelRegistry, type FurnishingModelRegistry } from "@cabane/engine";
import { Fragment, useMemo, useRef, type ReactNode } from "react";
import { EditorIcon } from "../../../editor-chrome/EditorIcon";
import { catalogEntries, filterCatalog, type CatalogEntry, type CatalogRoom } from "./catalog";
import { ModelThumbnail, ModelThumbnailRenderer } from "./ModelThumbnailRenderer";
import "./arrange-catalog.css";

import { CatalogCategoryCards, catalogFilters } from "./CatalogCategoryCards";

export interface CatalogBrowsing {
  room: CatalogRoom;
  query: string;
  view?: "categories" | "items";
}

export function ArrangeCatalog({
  furnishingModels,
  deviceModels,
  browsing,
  onBrowse,
  error,
  onChoose,
  enabled = true,
  customModels,
  renderCustomModel,
}: {
  enabled?: boolean;
  customModels?: ReactNode;
  renderCustomModel?: (entry: CatalogEntry) => ReactNode;
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
  browsing: CatalogBrowsing;
  onBrowse: (next: CatalogBrowsing) => void;
  error?: string | null;
  onChoose: (entry: CatalogEntry) => void;
}) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  const entries = useMemo(
    () => catalogEntries(furnishingModels, deviceModels),
    [furnishingModels, deviceModels],
  );
  const resultRoom = browsing.query.trim() ? "all" : browsing.room;
  const results = useMemo(
    () => filterCatalog(entries, resultRoom, browsing.query),
    [entries, resultRoom, browsing.query],
  );
  const filterLabel =
    catalogFilters.find((filter) => filter.id === resultRoom)?.label ?? "All items";
  const chooseFilter = (room: CatalogRoom) => {
    onBrowse({ room, query: "", view: "items" });
    if (scrollRoot.current) scrollRoot.current.scrollTop = 0;
  };
  const categoriesOpen =
    browsing.room === "all" && !browsing.query.trim() && browsing.view === "categories";
  return (
    <div className="arrange-catalog" aria-label="Item catalog">
      {error && (
        <p className="catalog-add-error" role="alert">
          <MeasurementText>{error}</MeasurementText>
        </p>
      )}
      <div className="arrange-catalog__body">
        <div className="catalog-results">
          {browsing.room === "my-models" && customModels}
          <div className="catalog-search">
            <EditorIcon name="search" />
            <input
              type="search"
              aria-label="Search all items"
              value={browsing.query}
              placeholder="Search all items…"
              onChange={(event) => onBrowse({ ...browsing, query: event.target.value })}
            />
            {browsing.query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onBrowse({ ...browsing, query: "" })}
              >
                <EditorIcon name="close" />
              </button>
            )}
          </div>
          {categoriesOpen ? (
            <CatalogCategoryCards entries={entries} onChoose={chooseFilter} />
          ) : (
            <>
              <header className="catalog-navigation">
                <button
                  type="button"
                  onClick={() => onBrowse({ room: "all", query: "", view: "categories" })}
                >
                  <EditorIcon name="chevronLeft" />
                  Categories
                </button>
                <span>{filterLabel}</span>
              </header>
              <ModelThumbnailRenderer scrollRoot={scrollRoot} enabled={enabled}>
                <div
                  className="catalog-grid"
                  ref={scrollRoot}
                  aria-label={`${filterLabel} catalog`}
                >
                  {results.map((entry) =>
                    browsing.room === "my-models" &&
                    entry.modelId.startsWith("custom:") &&
                    renderCustomModel ? (
                      <Fragment key={entry.key}>{renderCustomModel(entry)}</Fragment>
                    ) : (
                      <button
                        type="button"
                        className="catalog-card"
                        key={entry.key}
                        aria-label={`Add ${entry.definition.label}`}
                        disabled={
                          entry.kind === "device" && entry.definition.supportedDomains.length === 0
                        }
                        onClick={() => onChoose(entry)}
                      >
                        <ModelThumbnail entry={entry} />
                        <strong>{entry.definition.label}</strong>
                        <small>{entry.kind === "device" ? "Device" : "Furniture"}</small>
                      </button>
                    ),
                  )}
                  {results.length === 0 && (
                    <div className="catalog-empty" role="status">
                      <p>
                        {browsing.query.trim()
                          ? "No matching items"
                          : browsing.room === "my-models"
                            ? "Your models will appear here. Import one or create one with your AI."
                            : "No items in this category yet"}
                      </p>
                      {(browsing.query.trim() || browsing.room !== "my-models") && (
                        <EditorButton
                          onClick={() =>
                            browsing.query.trim()
                              ? onBrowse({ ...browsing, query: "" })
                              : chooseFilter("all")
                          }
                        >
                          {browsing.query.trim() ? "Clear search" : "Browse all items"}
                        </EditorButton>
                      )}
                    </div>
                  )}
                </div>
              </ModelThumbnailRenderer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
