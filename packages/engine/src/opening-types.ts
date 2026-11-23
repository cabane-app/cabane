import type { ExtensionKey } from "./types";
import type { GardenGateVariant } from "./garden-gate";

export interface OpeningContactSlotSpec {
  id: string;
  compatibleDeviceClasses: readonly ("door" | "window" | "opening")[];
  openState: "on" | "off";
  autoMap: "unique-compatible" | "manual";
}

export interface OpeningBaseSpec {
  id: string;
  name?: string;
  wallId: string;
  offsetFromWallStartPlanUnits: number;
  widthPlanUnits: number;
  openingHeightMeters: number;
  sillHeightMeters: number;
  visualModel?: ExtensionKey;
}

export type DoorOperation = "hinged" | "sliding" | "bifold" | "roll-up";
export type DoorVariant =
  | "panel"
  | "panel-white-lever"
  | "french"
  | "full-glass"
  | "steel-arched"
  | "concealed"
  | "flush-knob"
  | "flush"
  | "plank"
  | GardenGateVariant;
export type DoorFinish = "wood" | "white";

/** Relative to the owning wall's from → to direction, never the camera. */
export interface OpeningOrientation {
  /** Single hinged leaf only; paired leaves keep their outer hinges. Defaults to start. */
  hingeSide?: "start" | "end";
  /** Swing side or sliding assembly facing, using the wall-face convention. Defaults to right. */
  openingSide?: "left" | "right";
}

export interface OpeningCoverSlotSpec {
  id: string;
  autoMap: "unique-compatible" | "manual";
}

interface DoorBaseSpec extends OpeningBaseSpec {
  /** Optional six-digit hex finish override; omission preserves the original palette. */
  color?: string;
  /** Optional flush-front jamb overlap, capped by adjacent structural margins. */
  frontOverlayMeters?: number;
  /** Concealed door finish plane; independent of the swing side. */
  frontSide?: "left" | "right";
  kind: "door";
  finish: DoorFinish;
  openingSide?: "left" | "right";
  contactSlot?: OpeningContactSlotSpec;
}

export type DoorSpec = DoorBaseSpec &
  (
    | {
        operation: "hinged";
        variant: DoorVariant;
        leafCount: 1 | 2;
        hingeSide?: "start" | "end";
        slideDirection?: never;
        coverSlot?: never;
      }
    | {
        operation: "bifold";
        variant: "panel";
        /** Number of folding pairs (two panels per pair). */
        leafCount: 1 | 2;
        hingeSide?: "start" | "end";
        slideDirection?: never;
        coverSlot?: never;
      }
    | {
        operation: "sliding";
        variant: Exclude<DoorVariant, GardenGateVariant>;
        leafCount: 1 | 2;
        hingeSide?: never;
        slideDirection?: "start" | "end";
        coverSlot?: never;
      }
    | {
        operation: "roll-up";
        variant: "slatted";
        leafCount?: never;
        hingeSide?: never;
        slideDirection?: never;
        coverSlot?: OpeningCoverSlotSpec;
      }
  );

/** Design and dimensions, independent of identity, wall attachment, and bindings. */
export type DoorConfiguration = DoorSpec extends infer D
  ? D extends DoorSpec
    ? Omit<D, keyof OpeningBaseSpec | "contactSlot" | "coverSlot"> & {
        widthMeters: number;
        heightMeters: number;
      }
    : never
  : never;

export type WindowOperation = "fixed" | "casement" | "sliding";
export type WindowVariant = "plain" | "muntined" | "steel-arched";

export interface WindowSpec extends OpeningBaseSpec, OpeningOrientation {
  /** Optional six-digit hex finish override; omission preserves the original palette. */
  color?: string;
  kind: "window";
  operation: WindowOperation;
  variant: WindowVariant;
  panelCount: 1 | 2 | 3 | 4;
  /** Sliding windows stack toward this jamb; defaults to start. */
  slideDirection?: "start" | "end";
  glazing: "clear" | "privacy";
  muntins?: {
    columns: number;
    rows: number;
  };
  contactSlot?: OpeningContactSlotSpec;
  coverSlot?: never;
}

interface PassageBaseSpec extends OpeningBaseSpec {
  kind: "passage";
  walkThrough?: never;
  contactSlot?: never;
  coverSlot?: never;
}

export type PassageSpec = PassageBaseSpec &
  (
    | { variant: "rectangular"; archRiseMeters?: never }
    | { variant: "arched"; archRiseMeters: number }
  );

export type OpeningSpec = DoorSpec | WindowSpec | PassageSpec;
