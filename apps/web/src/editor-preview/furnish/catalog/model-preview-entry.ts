import type { ComponentType } from "react";
import type { CatalogEntry } from "./catalog";

/** Standalone procedural previews can use the same queue as catalog entries. */
export type ModelPreviewEntry =
  | (CatalogEntry & { variant?: string })
  | {
      key: string;
      kind: "procedural";
      definition: { bounds: CatalogEntry["definition"]["bounds"]; component: ComponentType };
    };
