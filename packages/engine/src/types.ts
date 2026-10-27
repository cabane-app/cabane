import type { StableDeviceModelId } from "./stable-device-model-id";
export type { StableDeviceModelId } from "./stable-device-model-id";
import type { ComponentType } from "react";
import type { RoomType } from "./room-types";
import type { HomeProject, SceneItemSpec } from "./home-project/types";
import type { ActionBarConfiguration } from "./action-bar/action-bar-config";

export type PlanPoint = readonly [x: number, y: number];
export type Polygon = readonly [PlanPoint, PlanPoint, PlanPoint, ...PlanPoint[]];
export type EntityId = `${string}.${string}`;
export type ExtensionKey = string;
export type DeviceDomain =
  | "light"
  | "switch"
  | "input_boolean"
  | "climate"
  | "cover"
  | "fan"
  | "media_player"
  | "humidifier"
  | "water_heater"
  | "vacuum"
  | "lock"
  | "alarm_control_panel"
  | "valve"
  | "siren"
  | "select"
  | "number"
  | "button"
  | "camera"
  | "sensor"
  | "binary_sensor"
  | "event";

export type ControllableDeviceDomain = Exclude<
  DeviceDomain,
  "camera" | "sensor" | "binary_sensor" | "event"
>;

export interface Assumption {
  id: string;
  subjectId: string;
  summary: string;
  basis: "measured" | "plan" | "photo" | "inferred" | "user";
}

export interface FloorCoordinates {
  origin: PlanPoint;
  metersPerPlanUnit: number;
  scaleBasis: "measured" | "inferred";
}

export interface SurfaceDevicePlacement {
  at: PlanPoint;
  elevationMeters: number;
  rotationYRadians?: number;
  scale?: number;
  support: {
    kind: "surface";
  };
}

export interface WallDevicePlacement {
  at: PlanPoint;
  elevationMeters: number;
  rotationYRadians: number;
  scale?: number;
  support: {
    kind: "wall";
    wallId: string;
  };
}

export type DevicePlacement = SurfaceDevicePlacement | WallDevicePlacement;

export interface EntityBindingSlotSpec {
  id: string;
  compatibleDomains: readonly DeviceDomain[];
  compatibleDeviceClasses?: readonly string[];
  required: boolean;
  autoMap: "unique-compatible" | "manual";
  deviceRole?: "primary" | "secondary";
  presentation: {
    label: string;
    dashboardRole: "primary" | "secondary" | "diagnostic" | "hidden";
  };
  sceneLight?: {
    at: PlanPoint;
    elevationMeters: number;
    color: string;
    maxIntensity: number;
    distance: number;
  };
}

export interface DeviceSlotSpec {
  id: string;
  model: ExtensionKey;
  entitySlots: readonly EntityBindingSlotSpec[];
  placement: DevicePlacement;
}

export const FLOOR_PATTERN_PRESET_IDS = [
  "light-oak",
  "light-oak-horizontal",
  "oak-herringbone",
  "travertine",
  "terracotta-tile",
  "terrazzo",
  "dark-walnut",
  "limestone",
  "square-tile",
  "subway-tile",
  "checkerboard-tile",
  "encaustic-tile",
  "black-white-patchwork",
  "blue-quatrefoil-tile",
  "sand",
  "gravel",
  "light-dirt",
  "dark-dirt",
  "pine-bark",
  "tomettes",
  "stepping-stones",
  "pebbles",
] as const;

export type FloorPatternPresetId = (typeof FLOOR_PATTERN_PRESET_IDS)[number];

export type FloorFinishSpec =
  | { kind: "solid"; color: string }
  | { kind: "preset"; preset: FloorPatternPresetId; color?: string };

export interface FloorFinishZoneSpec {
  id: string;
  polygon: Polygon;
  finish: FloorFinishSpec;
}

export interface RoomSpec {
  /** Enclosed structural volume, retained for reversible Construct editing. */
  isSolid?: boolean;
  id: string;
  name: string;
  polygon: Polygon;
  accent: string;
  floorFinish?: FloorFinishSpec;
  floorZones?: readonly FloorFinishZoneSpec[];
  furnishings?: ExtensionKey;
  dashboardSlots: readonly EntityBindingSlotSpec[];
  devices: readonly DeviceSlotSpec[];
}

/** A rectangular blind recess owned by one directed wall face. */
export interface WallNicheSpec {
  id: string;
  side: "left" | "right";
  offsetFromWallStartPlanUnits: number;
  widthPlanUnits: number;
  bottomMeters: number;
  heightMeters: number;
  depthMeters: number;
  /** Shelf bottom heights measured upward from the niche bottom. White wall finish. */
  shelfHeightsMeters?: readonly number[];
  shelfThicknessMeters?: number;
}

export interface WallSpec {
  id: string;
  from: PlanPoint;
  to: PlanPoint;
  classification: "interior" | "exterior";
  thicknessMeters: number;
  niches?: readonly WallNicheSpec[];
  heightMeters?: number;
  exteriorColor?: string;
  edgeColor?: string;
  faceColors?: {
    left?: string;
    right?: string;
  };
}

export interface WallJunctionSpec {
  id: string;
  at: PlanPoint;
  wallIds: readonly [string, string, ...string[]];
}

export interface OpeningContactSlotSpec {
  id: string;
  compatibleDeviceClasses: readonly ("door" | "window" | "opening")[];
  openState: "on" | "off";
  autoMap: "unique-compatible" | "manual";
}

export interface OpeningBaseSpec {
  id: string;
  wallId: string;
  offsetFromWallStartPlanUnits: number;
  widthPlanUnits: number;
  openingHeightMeters: number;
  sillHeightMeters: number;
  visualModel?: ExtensionKey;
}

export type DoorOperation = "hinged" | "sliding" | "roll-up";
export type DoorVariant =
  | "panel"
  | "panel-white-lever"
  | "french"
  | "full-glass"
  | "steel-arched"
  | "concealed"
  | "flush-knob"
  | "flush"
  | "plank";
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
        operation: "sliding";
        variant: DoorVariant;
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

export type WindowOperation = "fixed" | "casement";
export type WindowVariant = "plain" | "muntined" | "steel-arched";

export interface WindowSpec extends OpeningBaseSpec, OpeningOrientation {
  /** Optional six-digit hex finish override; omission preserves the original palette. */
  color?: string;
  kind: "window";
  operation: WindowOperation;
  variant: WindowVariant;
  panelCount: 1 | 2;
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

export interface FlatCeilingSpec {
  id: string;
  kind: "flat";
  roomIds: readonly string[];
  heightMeters: number;
}

export interface SlopedCeilingSpec {
  id: string;
  kind: "sloped";
  roomIds: readonly string[];
  planes: readonly {
    id: string;
    boundary: Polygon;
    lowEdge: readonly [PlanPoint, PlanPoint];
    highEdge: readonly [PlanPoint, PlanPoint];
    lowHeightMeters: number;
    highHeightMeters: number;
  }[];
}

export type CeilingSpec = FlatCeilingSpec | SlopedCeilingSpec;

/** Procedural boundary styles. Legacy hedge names remain the portable wire contract. */
export type HedgeStyle =
  | "clipped"
  | "rounded"
  | "bushy"
  | "mixed"
  | "ivy-wall"
  | "picket"
  | "privacy"
  | "post-rail"
  | "metal-bars"
  | "masonry";

export interface HedgeSpec {
  id: string;
  from: PlanPoint;
  to: PlanPoint;
  style: HedgeStyle;
  heightMeters: number;
  widthMeters: number;
}

/** An outdoor in-ground basin opening; its fixed rim extends outward. */
export interface PoolSpec {
  id: string;
  /** Simple, implicitly closed outline in this floor's plan coordinates. */
  polygon: Polygon;
}

export type OutdoorPlatformEdgeConfiguration =
  { kind: "railing" | "low-wall"; heightMeters: number } | { kind: "open" };
export interface OutdoorPlatformEdgeSpec {
  id: string;
  configuration?: OutdoorPlatformEdgeConfiguration;
}
export interface OutdoorPlatformSpec {
  id: string;
  polygon: Polygon;
  finish: FloorFinishSpec;
  defaultEdge: OutdoorPlatformEdgeConfiguration;
  /** One stable edge identity per polygon corner, in the same order. */
  edges: readonly OutdoorPlatformEdgeSpec[];
}

export interface FloorSpec {
  id: string;
  name: string;
  floorToFloorHeightMeters: number;
  /** Basement floors precede ground in bottom-to-top order. */
  belowGround?: boolean;
  coordinates: FloorCoordinates;
  defaultWallHeightMeters: number;
  defaultCeilingHeightMeters: number;
  footprint: readonly PlanPoint[];
  footprintRegions?: readonly Polygon[];
  rooms: readonly RoomSpec[];
  /** Derived runtime volumes excluded from room navigation and mapping. Never persisted. */
  solidRooms?: readonly RoomSpec[];
  walls: readonly WallSpec[];
  wallJunctions: readonly WallJunctionSpec[];
  openings: readonly OpeningSpec[];
  ceilings?: readonly CeilingSpec[];
  hedges?: readonly HedgeSpec[];
  pools?: readonly PoolSpec[];
  outdoorPlatforms?: readonly OutdoorPlatformSpec[];
  /** Ordered outdoor surface patches such as paths, gravel, or sand. */
  groundZones?: readonly FloorFinishZoneSpec[];
}

/** Publication requires a complete polygon; construction may be empty. */
export type RenderableFloorSpec = Omit<FloorSpec, "footprint"> & {
  footprint: Polygon;
  /** Derived preview level, preserving gaps when unfinished floors are omitted. Never persisted in HomeProject. */
  elevationMeters?: number;
};

export type BuiltInShortcutId =
  | "home-view"
  | "room-details"
  | "construct-mode"
  | "arrange-mode"
  | "connect-mode"
  | "walk-mode"
  | "lighting-mode"
  | "wall-fade"
  | "all-lights";

export interface ShortcutSpec {
  id: string;
  action: BuiltInShortcutId;
  context: "overview" | "room" | "both";
  order: number;
}

export interface EntityStateSnapshot {
  entityId: EntityId;
  state: string;
  attributes: Readonly<Record<string, unknown>>;
  available: boolean;
  stale: boolean;
  lastConfirmedAt?: string;
  lastChanged?: string;
  lastUpdated?: string;
}

export type HomeAssistantConnectionStatus =
  | "unconfigured"
  | "disconnected"
  | "authenticating"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "auth-expired"
  | "error";

export interface HomeAssistantAreaRegistryEntry {
  area_id: string;
  name: string;
  icon: string | null;
  picture: string | null;
  temperature_entity_id?: EntityId | null;
  humidity_entity_id?: EntityId | null;
}

export interface HomeAssistantDeviceRegistryEntry {
  id: string;
  area_id: string | null;
  name: string | null;
  name_by_user: string | null;
  model: string | null;
}

export interface HomeAssistantEntityRegistryEntry {
  entity_id: EntityId;
  area_id: string | null;
  device_id: string | null;
  platform: string;
  disabled_by: string | null;
  hidden_by?: string | null;
  name: string | null;
  original_name: string | null;
}

export interface HomeAssistantRuntimeSnapshot {
  status: HomeAssistantConnectionStatus;
  configured: boolean;
  canMutate: boolean;
  origin: string | null;
  error: string | null;
  areas: readonly HomeAssistantAreaRegistryEntry[];
  devices: readonly HomeAssistantDeviceRegistryEntry[];
  entityRegistry: readonly HomeAssistantEntityRegistryEntry[];
  entityStates: Readonly<Record<EntityId, EntityStateSnapshot>>;
}

export type HomeAssistantBindingIssueCode =
  | "binding.area-duplicate"
  | "binding.area-missing"
  | "binding.area-mismatch"
  | "binding.area-unmapped"
  | "binding.disabled"
  | "binding.domain-incompatible"
  | "binding.device-class-incompatible"
  | "binding.entity-missing"
  | "binding.hidden"
  | "binding.registry-missing"
  | "binding.slot-unmapped"
  | "binding.state-missing"
  | "binding.unavailable";

export interface HomeAssistantBindingIssue {
  code: HomeAssistantBindingIssueCode;
  severity: "error" | "warning";
  path: string;
  message: string;
  entityId?: EntityId;
  roomId?: string;
  slotId?: string;
}

export interface ResolvedEntityBinding {
  entityId: EntityId;
  domain: string;
  path: string;
  label: string;
  roomId: string;
  slotId: string;
  deviceSlotId?: string;
  registry?: HomeAssistantEntityRegistryEntry;
  state?: EntityStateSnapshot;
  areaId: string | null;
  deviceId: string | null;
  issues: readonly HomeAssistantBindingIssue[];
}

export interface ResolvedDeviceBinding {
  displayName?: string;
  slot: DeviceSlotSpec;
  entities: readonly ResolvedEntityBinding[];
  issues: readonly HomeAssistantBindingIssue[];
}

export interface ResolvedRoomBindings {
  room: RoomSpec;
  displayName: string;
  pictureUrl: string | null;
  sections: {
    primary: readonly ResolvedEntityBinding[];
    secondary: readonly ResolvedEntityBinding[];
    diagnostic: readonly ResolvedEntityBinding[];
  };
  devices: readonly ResolvedDeviceBinding[];
  issues: readonly HomeAssistantBindingIssue[];
}

export type ResolvedOpeningState = "open" | "closed" | "unavailable";

export interface ResolvedOpeningBinding {
  openingId: string;
  slotId: string;
  entityId?: EntityId;
  state: ResolvedOpeningState;
  position: number | null;
  available: boolean;
  bound: boolean;
  bindingKey: string;
  coverSlotId?: string;
  coverEntityId?: EntityId;
  issue?: HomeAssistantBindingIssue;
}

export interface ResolvedHomeBindings {
  rooms: Readonly<Record<string, ResolvedRoomBindings>>;
  openings: Readonly<Record<string, ResolvedOpeningBinding>>;
  issues: readonly HomeAssistantBindingIssue[];
}

export interface ExtensionInteractionTarget {
  id: string;
  label: string;
  slotId?: string;
  intent?: DeviceInteractionIntent | "light-toggle" | "light-dim";
  brightnessPercent?: number;
}

export type DeviceInteractionIntent = "device-dashboard" | "camera-viewer";

export type CameraStreamState = "idle" | "connecting" | "playing" | "unavailable" | "error";

export type CameraTransport = "webrtc" | "hls";

export type CameraPreviewState = "live" | "poster" | "cors-blocked";

export interface DeviceLiveMedia {
  kind: "camera-stream";
  video: HTMLVideoElement | null;
  posterUrl: string | null;
  state: CameraStreamState;
  transport: CameraTransport | null;
  previewState: CameraPreviewState;
  error: string | null;
}

export interface RoomFurnishingsProps {
  coordinates: FloorCoordinates;
  room: RoomSpec;
  entityStates: Readonly<Record<EntityId, EntityStateSnapshot>>;
  entityStatesBySlotId: Readonly<Record<string, EntityStateSnapshot>>;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
}

export interface HomeDeviceModelProps {
  color?: string;
  variant?: string;
  slot: DeviceSlotSpec;
  state?: EntityStateSnapshot;
  liveMedia?: DeviceLiveMedia;
  visualState: DeviceVisualState;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
}

export interface ArchitectureModelProps<Opening extends OpeningSpec = OpeningSpec> {
  wall: WallSpec;
  opening: Opening;
  floor: FloorSpec;
  position: number;
  reducedMotion: boolean;
}

export type ArchitectureModelComponent<Opening extends OpeningSpec = OpeningSpec> = ComponentType<
  ArchitectureModelProps<Opening>
>;

export interface ArchitectureModelRegistry {
  door: ArchitectureModelComponent<DoorSpec>;
  window: ArchitectureModelComponent<WindowSpec>;
  passage: ArchitectureModelComponent<PassageSpec>;
}

export type HomeOpeningModelProps = ArchitectureModelProps;
export type RoomFurnishingsComponent = ComponentType<RoomFurnishingsProps>;
export type HomeDeviceModelComponent = ComponentType<HomeDeviceModelProps>;
export type HomeOpeningModelComponent = ArchitectureModelComponent;

export interface SceneModelProps {
  color?: string;
  variant?: string;
  size: readonly [number, number, number];
  entityStatesBySlotId: Readonly<Record<string, EntityStateSnapshot>>;
  reducedMotion: boolean;
  walkMode: boolean;
  onInteract: (target: ExtensionInteractionTarget) => void;
}

export type ResizePolicy =
  | { kind: "fixed" }
  | { kind: "uniform" }
  | { kind: "planar" }
  | { kind: "axes"; axes: readonly ("width" | "height" | "depth")[] }
  | {
      kind: "custom";
      normalize: (
        defaultSize: readonly [number, number, number],
        requested: readonly [number, number, number],
      ) => readonly [number, number, number];
    };

export type DeviceVisualState =
  "disconnected" | "unavailable" | "connected-inactive" | "connected-active";

export type DeviceMountKind = "wall" | "surface";

export interface DeviceModelBounds {
  min: readonly [x: number, y: number, z: number];
  max: readonly [x: number, y: number, z: number];
}

export interface DeviceModelComplexity {
  visibleMeshes: number;
  triangles: number;
}

export interface SceneModelVariant {
  id: string;
  label: string;
  /** False when this variant has no physical light source. */
  sceneLight?: false;
}

export interface SceneModelEditorDescriptor {
  /** Enables the fabric color picker; omission keeps a model's original palette. */
  defaultColor?: string;
  /** Ordered choices sharing size, placement, and bindings. First is the default. */
  variants?: readonly SceneModelVariant[];
  defaultRoomType: RoomType;
  label: string;
  category: string;
  defaultSize: readonly [number, number, number];
  bounds: DeviceModelBounds;
  resizePolicy: ResizePolicy;
  /** Starting support for catalog additions; instances may use any placement kind. */
  preferredPlacement: "absolute" | "wall" | "ceiling";
  /** Outdoor-only models stay outside; indoor-outdoor models may also belong to a room. */
  placementEnvironment?: "outdoor" | "indoor-outdoor";
  /** Window/opening alignment uses the closed covering's width/height within the full envelope. */
  windowFit?: {
    openingWidthRatio: number;
    openingHeightRatio: number;
    depthOffsetMeters: number;
    /** Defaults to windows only; glazed sliding doors are opt-in because they are doors architecturally. */
    openingTypes?: readonly ("window" | "sliding-glass-door")[];
  };
  outlineContact: boolean;
  complexity: DeviceModelComplexity;
}

export interface FurnishingModelDefinition extends SceneModelEditorDescriptor {
  /** Read compatibility for existing items; omit from new-item catalogs. */
  legacyOnly?: boolean;
  component: ComponentType<SceneModelProps>;
}

export type FurnishingModelRegistry = Readonly<Record<string, FurnishingModelDefinition>>;

export interface DeviceModelDefinition extends SceneModelEditorDescriptor {
  component: HomeDeviceModelComponent;
  supportedDomains: readonly DeviceDomain[];
  supportedDeviceClasses?: Readonly<Partial<Record<DeviceDomain, readonly string[]>>>;
  /** Legacy rendering hint; does not restrict instance placement. */
  mountKind: DeviceMountKind;
  liveMedia?: {
    kind: "camera-stream";
    slotRole: "primary";
  };
  sceneLight?: {
    position: readonly [x: number, y: number, z: number];
    color: string;
    maxIntensity: number;
    distance: number;
  };
  interaction: {
    target?: DeviceInteractionIntent;
    tapTolerancePixels: number;
  };
}

export type DeviceModelRegistry = Readonly<Record<string, DeviceModelDefinition>>;
export type StableDeviceRegistry = Readonly<Record<StableDeviceModelId, DeviceModelDefinition>>;

export interface ProjectModelRegistries {
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
}

export interface HomeExtensionRegistry {
  furnishingModels: FurnishingModelRegistry;
  deviceModels: DeviceModelRegistry;
  openingModels: Readonly<Record<ExtensionKey, HomeOpeningModelComponent>>;
  /** Transitional Plan 1 fallback; deleted after owner-home migration. */
  roomFurnishings?: Readonly<Record<ExtensionKey, RoomFurnishingsComponent>>;
}

export interface HomeManifest {
  schemaVersion: 2;
  home: HomeProject["home"];
  coordinates: FloorCoordinates;
  stairs: readonly import("./stairs/types").StairSpec[];
  floors: readonly RenderableFloorSpec[];
  sceneItems: readonly SceneItemSpec[];
  shortcuts: readonly ShortcutSpec[];
  actionBar?: ActionBarConfiguration;
  extensions: HomeExtensionRegistry;
  assumptions: readonly Assumption[];
}

/** Full-home binding projection, including unfinished construction floors. Never render this type. */
export type HomeBindingManifest = Omit<HomeManifest, "floors"> & {
  floors: readonly (Omit<FloorSpec, "footprint"> & { footprint: readonly PlanPoint[] })[];
};

export type LegacyFloorSpec = Omit<FloorSpec, "floorToFloorHeightMeters"> & {
  floorToFloorHeightMeters?: number;
};
export type LegacyHomeManifest = Omit<
  HomeManifest,
  "schemaVersion" | "coordinates" | "stairs" | "floors" | "sceneItems"
> & {
  schemaVersion: 1;
  floors: readonly LegacyFloorSpec[];
  sceneItems: readonly import("./home-project/types").LegacySceneItemSpec[];
};

export interface RuntimeBindingProfile {
  weatherSource?: import("./weather/weather-state").WeatherSource;
  schemaVersion: 1;
  homeId: string;
  roomAreaIds: Readonly<Record<string, string>>;
  entityIdsBySlotId: Readonly<Record<string, EntityId>>;
  /** Private HA action mappings; project targets contain only the action kind. */
  actionEntityIdsByShortcutId?: Readonly<Record<string, EntityId>>;
}

export type BindingSlotKind = "dashboard" | "device" | "opening-contact" | "opening-cover";

export interface BindingSlotDescriptor {
  slotId: string;
  kind: BindingSlotKind;
  roomIds: readonly string[];
  spec: EntityBindingSlotSpec;
  deviceSlotId?: string;
  deviceModel?: DeviceSlotSpec["model"];
  openingId?: string;
}

export interface AutomaticBindingChange {
  kind: "room" | "entity";
  destinationId: string;
  value: string;
  reason: "exact-room-name" | "only-room-area" | "unique-compatible";
}

export interface AutomaticBindingAmbiguity {
  kind: "room" | "entity";
  destinationId: string;
  candidateIds: readonly string[];
}

export interface AutomaticBindingResult {
  profile: RuntimeBindingProfile;
  applied: readonly AutomaticBindingChange[];
  ambiguous: readonly AutomaticBindingAmbiguity[];
}

export type SceneMode = "overview" | "room" | "walk";

export interface ManifestIssue {
  code: string;
  severity: "fatal" | "error" | "warning";
  path: string;
  message: string;
}

export interface ManifestValidationResult {
  manifest?: HomeManifest;
  issues: ManifestIssue[];
  canRender: boolean;
}
