import type { CustomModel, CustomModelLight } from "../imported-models/contracts";
import type {
  Assumption,
  EntityBindingSlotSpec,
  FlatCeilingSpec,
  FloorSpec,
  FloorCoordinates,
  Polygon,
  OpeningSpec,
  OpeningContactSlotSpec,
  OpeningCoverSlotSpec,
  PlanPoint,
  RoomSpec,
  ShortcutSpec,
} from "../types";
import type { StairSpec } from "../stairs/types";
import type { RoofSettings } from "../roof/roof-settings";
import type { ActionBarConfiguration } from "../action-bar/action-bar-config";
import type { TerrainSettings } from "../terrain/terrain-settings";
import { migrateLegacyProject } from "./migrations";

export type LayoutRoomSpec = Omit<RoomSpec, "furnishings" | "dashboardSlots" | "devices"> & {
  furnishings?: never;
  dashboardSlots: readonly [];
  devices: readonly [];
};

type LayoutOpeningWithoutContact<T extends OpeningSpec> = T extends OpeningSpec
  ? Omit<T, "contactSlot" | "coverSlot"> & { contactSlot?: never; coverSlot?: never }
  : never;

export type LayoutOpeningSpec = LayoutOpeningWithoutContact<OpeningSpec>;

export type LayoutFloorSpec = Omit<
  FloorSpec,
  "rooms" | "openings" | "ceilings" | "footprint" | "solidRooms"
> & {
  footprint: Polygon;
  rooms: readonly LayoutRoomSpec[];
  openings: readonly LayoutOpeningSpec[];
  ceilings?: readonly FlatCeilingSpec[];
};
/** Serializable construction draft; an empty footprint is not a renderable floor. */
export type DraftLayoutFloorSpec = Omit<LayoutFloorSpec, "footprint"> & {
  footprint: readonly PlanPoint[];
};
export type SceneItemSize = readonly [width: number, height: number, depth: number];

export type ItemPlacement =
  | {
      kind: "absolute";
      at: PlanPoint;
      elevationMeters: number;
      rotationYRadians: number;
    }
  | {
      kind: "wall";
      wallId: string;
      face: "left" | "right";
      offsetFromWallStartPlanUnits: number;
      elevationMeters: number;
      depthOffsetMeters: number;
      rotationOffsetRadians: number;
    }
  | {
      kind: "ceiling";
      roomId: string;
      at: PlanPoint;
      dropMeters: number;
      rotationYRadians: number;
    };

interface SceneItemBase {
  /** Flat Arrange group. Members share this metadata and retain independent bindings. */
  group?: { id: string; name: string };
  /** Independent lighting relationship; the entity slot is derived as <id>-entity. */
  lightSlotId?: string;
  /** Local scene appearance only; this never sends Home Assistant commands. */
  lightState?: "always-off" | "always-on" | "night-only" | "connected";
  /** Optional six-digit hex fabric override; omitted preserves the model palette. */
  color?: string;
  /** Omitted values use the model's first variant. */
  variant?: string;
  id: string;
  floorId: string;
  modelId: string;
  placement: ItemPlacement;
  size: SceneItemSize;
}

export interface FurnishingItemSpec extends SceneItemBase {
  kind: "furnishing";
  /** Optional read-only sensor attachments, independent of model controls. */
  entitySlots?: readonly EntityBindingSlotSpec[];
}

export interface DeviceItemSpec extends SceneItemBase {
  kind: "device";
  /** Scene appearance override; omitted means connected. */
  lightState?: "always-off" | "always-on" | "night-only" | "connected";
  /** Exactly one slot must declare deviceRole "primary". */
  entitySlots: readonly EntityBindingSlotSpec[];
}

export type SceneItemSpec = FurnishingItemSpec | DeviceItemSpec;

export interface RoomProfileSpec {
  dashboardSlots: readonly EntityBindingSlotSpec[];
}

export interface OpeningProfileSpec {
  coverSlot?: OpeningCoverSlotSpec;
  contactSlot?: OpeningContactSlotSpec;
}

export interface HomeProject {
  /** Home-local overrides for built-in models. Null disables their lighting. */
  modelLights?: Readonly<Record<string, CustomModelLight | null>>;
  customModels?: readonly CustomModel[];
  schemaVersion: 2;
  seedRevision: string;
  home: {
    terrain?: TerrainSettings;
    /** Decorative storeys below the modeled home; zero preserves the original appearance. */
    apartmentFloor?: number;
    walkStart?: { floorId: string; at: PlanPoint };
    roof?: RoofSettings;
    /** Clockwise from plan up (−Z); omitted means 0°. */
    northAngleDegrees?: number;
    id: string;
    name: string;
    locale: "en";
    palette: {
      accent: string;
      secondary: string;
      exterior: string;
      interior: string;
      ground: string;
    };
  };
  coordinates: FloorCoordinates;
  floors: readonly DraftLayoutFloorSpec[];
  stairs: readonly StairSpec[];
  sceneItems: readonly SceneItemSpec[];
  roomProfiles: Readonly<Record<string, RoomProfileSpec>>;
  openingProfiles: Readonly<Record<string, OpeningProfileSpec>>;
  shortcuts: readonly ShortcutSpec[];
  actionBar?: ActionBarConfiguration;
  /** Namespaced JSON owned and validated by optional tool packages. */
  toolState?: Readonly<Record<string, unknown>>;
  assumptions: readonly Assumption[];
}

export type LegacySceneItemSpec = SceneItemSpec extends infer Item
  ? Item extends SceneItemSpec
    ? Omit<Item, "floorId"> & { floorId?: string }
    : never
  : never;
export type LegacyLayoutFloorSpec = Omit<LayoutFloorSpec, "floorToFloorHeightMeters"> & {
  floorToFloorHeightMeters?: number;
};
export type LegacyHomeProject = Omit<
  HomeProject,
  "schemaVersion" | "coordinates" | "floors" | "stairs" | "sceneItems"
> & {
  schemaVersion: 1;
  floor: LegacyLayoutFloorSpec;
  sceneItems: readonly LegacySceneItemSpec[];
};

export const defineHomeProject = (project: HomeProject | LegacyHomeProject): HomeProject =>
  project.schemaVersion === 1 ? migrateLegacyProject(project) : project;
