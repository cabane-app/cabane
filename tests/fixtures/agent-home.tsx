import {
  defineHomeExtensionRegistry,
  defineHomeManifest,
  Outlines,
  ToonMaterial,
} from "@cabane/engine";
import type {
  EntityId,
  EntityStateSnapshot,
  HomeAssistantRuntimeSnapshot,
  HomeManifest,
  RoomFurnishingsProps,
} from "@cabane/engine";

const timestamp = "2026-08-27T10:00:00.000Z";

export function FixtureStudioFurnishings(_props: RoomFurnishingsProps) {
  return (
    <group name="fixture-studio-furnishings">
      <mesh position={[2.8, 0.72, 2.5]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.06, 0.62]} />
        <ToonMaterial color="#c98f64" />
        <Outlines color="#6c5040" thickness={0.008} />
      </mesh>
      {[
        [2.3, 0.35, 2.25],
        [3.3, 0.35, 2.25],
        [2.3, 0.35, 2.75],
        [3.3, 0.35, 2.75],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} castShadow>
          <boxGeometry args={[0.07, 0.7, 0.07]} />
          <ToonMaterial color="#78877f" />
        </mesh>
      ))}
      <mesh position={[2.8, 0.42, 3.5]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.42, 0.48]} />
        <ToonMaterial color="#8aa79a" />
        <Outlines color="#52605b" thickness={0.009} />
      </mesh>
    </group>
  );
}

const emptyExtensions = defineHomeExtensionRegistry({
  furnishingModels: {},
  roomFurnishings: {},
  deviceModels: {},
  openingModels: {},
});

export const layoutFixtureManifest = defineHomeManifest({
  schemaVersion: 1,
  home: {
    id: "agent-layout-fixture",
    name: "Agent workflow fixture",
    locale: "en",
    palette: {
      accent: "#db7653",
      secondary: "#7c9f91",
      exterior: "#c97370",
      interior: "#e4e0d8",
      ground: "#91a06a",
    },
  },
  floors: [
    {
      id: "fixture-floor",
      name: "Fixture floor",
      coordinates: {
        origin: [0, 0],
        metersPerPlanUnit: 1,
        scaleBasis: "measured",
      },
      defaultWallHeightMeters: 2.6,
      defaultCeilingHeightMeters: 2.6,
      footprint: [
        [0, 0],
        [8, 0],
        [8, 5],
        [0, 5],
      ],
      rooms: [
        {
          id: "fixture-studio",
          name: "Fixture studio",
          polygon: [
            [0.12, 0.12],
            [4.88, 0.12],
            [4.88, 4.88],
            [0.12, 4.88],
          ],
          accent: "#efc5a9",
          dashboardSlots: [],
          devices: [],
        },
        {
          id: "fixture-hall",
          name: "Fixture hall",
          polygon: [
            [5.12, 0.12],
            [7.88, 0.12],
            [7.88, 4.88],
            [5.12, 4.88],
          ],
          accent: "#c7d9cf",
          dashboardSlots: [],
          devices: [],
        },
      ],
      walls: [
        {
          id: "fixture-north",
          from: [0, 0],
          to: [8, 0],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "fixture-east",
          from: [8, 0],
          to: [8, 5],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "fixture-south",
          from: [8, 5],
          to: [0, 5],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "fixture-west",
          from: [0, 5],
          to: [0, 0],
          classification: "exterior",
          thicknessMeters: 0.18,
        },
        {
          id: "fixture-divider",
          from: [5, 0],
          to: [5, 5],
          classification: "interior",
          thicknessMeters: 0.12,
        },
      ],
      wallJunctions: [
        {
          id: "fixture-north-west-junction",
          at: [0, 0],
          wallIds: ["fixture-north", "fixture-west"],
        },
        {
          id: "fixture-north-divider-junction",
          at: [5, 0],
          wallIds: ["fixture-north", "fixture-divider"],
        },
        {
          id: "fixture-north-east-junction",
          at: [8, 0],
          wallIds: ["fixture-north", "fixture-east"],
        },
        {
          id: "fixture-south-east-junction",
          at: [8, 5],
          wallIds: ["fixture-east", "fixture-south"],
        },
        {
          id: "fixture-south-divider-junction",
          at: [5, 5],
          wallIds: ["fixture-south", "fixture-divider"],
        },
        {
          id: "fixture-south-west-junction",
          at: [0, 5],
          wallIds: ["fixture-south", "fixture-west"],
        },
      ],
      openings: [
        {
          id: "fixture-entry",
          wallId: "fixture-south",
          kind: "door",
          offsetFromWallStartPlanUnits: 0.7,
          widthPlanUnits: 0.95,
          openingHeightMeters: 2.12,
          sillHeightMeters: 0,
          operation: "hinged",
          variant: "panel",
          finish: "wood",
          leafCount: 1,
        },
        {
          id: "fixture-window",
          wallId: "fixture-north",
          kind: "window",
          offsetFromWallStartPlanUnits: 1.8,
          widthPlanUnits: 1.8,
          openingHeightMeters: 1.2,
          sillHeightMeters: 0.85,
          operation: "casement",
          variant: "plain",
          panelCount: 1,
          glazing: "clear",
        },
        {
          id: "fixture-room-door",
          wallId: "fixture-divider",
          kind: "door",
          offsetFromWallStartPlanUnits: 2,
          widthPlanUnits: 0.9,
          openingHeightMeters: 2.1,
          sillHeightMeters: 0,
          operation: "hinged",
          variant: "panel",
          finish: "wood",
          leafCount: 1,
        },
      ],
      ceilings: [
        {
          id: "fixture-ceiling",
          kind: "flat",
          roomIds: ["fixture-studio", "fixture-hall"],
          heightMeters: 2.6,
        },
      ],
    },
  ],
  sceneItems: [],
  shortcuts: [
    { id: "fixture-home", action: "home-view", context: "both", order: 0 },
    { id: "fixture-construct", action: "construct-mode", context: "overview", order: 1 },
    { id: "fixture-arrange", action: "arrange-mode", context: "overview", order: 2 },
    { id: "fixture-connect", action: "connect-mode", context: "overview", order: 3 },
    { id: "fixture-walk", action: "walk-mode", context: "both", order: 4 },
    { id: "fixture-lighting", action: "lighting-mode", context: "both", order: 5 },
    { id: "fixture-fade", action: "wall-fade", context: "both", order: 6 },
    { id: "fixture-all-off", action: "all-lights", context: "both", order: 7 },
  ],
  extensions: emptyExtensions,
  assumptions: [
    {
      id: "fixture-measured-scale",
      subjectId: "fixture-floor",
      summary: "The agent workflow fixture uses synthetic metre coordinates.",
      basis: "measured",
    },
  ],
});

const entitySlot = (
  id: string,
  compatibleDomains: HomeManifest["floors"][number]["rooms"][number]["devices"][number]["entitySlots"][number]["compatibleDomains"],
  label: string,
  dashboardRole: "primary" | "secondary" | "diagnostic",
  compatibleDeviceClasses?: readonly string[],
) => ({
  id,
  compatibleDomains,
  compatibleDeviceClasses,
  required: true,
  autoMap: "unique-compatible" as const,
  deviceRole: "primary" as const,
  presentation: { label, dashboardRole },
});

const studioDevices: HomeManifest["floors"][number]["rooms"][number]["devices"] = [
  {
    id: "fixture-ac",
    model: "indoor-ac",
    entitySlots: [entitySlot("fixture-ac-entity", ["climate"], "Indoor AC", "primary")],
    placement: {
      at: [1.2, 0.094],
      elevationMeters: 2.05,
      rotationYRadians: 0,
      support: { kind: "wall", wallId: "fixture-north" },
    },
  },
  {
    id: "fixture-washing-machine",
    model: "washing-machine",
    entitySlots: [
      entitySlot("fixture-washing-machine-entity", ["switch"], "Washing machine", "secondary"),
    ],
    placement: {
      at: [1.4, 3.4],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-tumble-dryer",
    model: "tumble-dryer",
    entitySlots: [
      entitySlot("fixture-tumble-dryer-entity", ["switch"], "Tumble dryer", "secondary"),
    ],
    placement: {
      at: [1, 4.2],
      elevationMeters: 0.002,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-dishwasher",
    model: "dishwasher",
    entitySlots: [entitySlot("fixture-dishwasher-entity", ["switch"], "Dishwasher", "secondary")],
    placement: {
      at: [1.7, 4.2],
      elevationMeters: 0.002,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-oven",
    model: "oven",
    entitySlots: [entitySlot("fixture-oven-entity", ["switch"], "Oven", "secondary")],
    placement: {
      at: [2.4, 4.2],
      elevationMeters: 0.002,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-water-heater",
    model: "water-heater",
    entitySlots: [
      entitySlot("fixture-water-heater-entity", ["switch"], "Water heater", "secondary"),
    ],
    placement: {
      at: [3.1, 0.299],
      elevationMeters: 0.8,
      rotationYRadians: 0,
      support: { kind: "wall", wallId: "fixture-north" },
    },
  },
  {
    id: "fixture-speaker",
    model: "speaker",
    entitySlots: [entitySlot("fixture-speaker-entity", ["media_player"], "Speaker", "secondary")],
    placement: {
      at: [2.8, 2.5],
      elevationMeters: 0.75,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-television",
    model: "television",
    entitySlots: [
      entitySlot("fixture-television-entity", ["media_player"], "Television", "secondary"),
    ],
    placement: {
      at: [3, 3.4],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-camera-screen",
    model: "camera-screen",
    entitySlots: [entitySlot("fixture-camera-entity", ["camera"], "Studio camera", "secondary")],
    placement: {
      at: [2.5, 0.094],
      elevationMeters: 1.35,
      rotationYRadians: 0,
      support: { kind: "wall", wallId: "fixture-north" },
    },
  },
  {
    id: "fixture-floor-lamp",
    model: "floor-lamp",
    entitySlots: [entitySlot("fixture-floor-lamp-entity", ["light"], "Floor lamp", "secondary")],
    placement: {
      at: [4, 2],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-terracotta-pendant",
    model: "terracotta-pendant",
    entitySlots: [
      entitySlot("fixture-terracotta-pendant-entity", ["light"], "Terracotta pendant", "secondary"),
    ],
    placement: {
      at: [1.3, 1.4],
      elevationMeters: 1.8,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-switch",
    model: "wall-switch",
    entitySlots: [entitySlot("fixture-switch-entity", ["switch"], "Wall switch", "secondary")],
    placement: {
      at: [4, 0.094],
      elevationMeters: 1.05,
      rotationYRadians: 0,
      support: { kind: "wall", wallId: "fixture-north" },
    },
  },
  {
    id: "fixture-contact",
    model: "opening-contact",
    entitySlots: [
      entitySlot("fixture-contact-entity", ["binary_sensor"], "Opening contact", "diagnostic", [
        "door",
        "garage_door",
        "opening",
        "window",
      ]),
    ],
    placement: {
      at: [3.6, 0.094],
      elevationMeters: 1.35,
      rotationYRadians: 0,
      support: { kind: "wall", wallId: "fixture-north" },
    },
  },
  {
    id: "fixture-thermometer",
    model: "thermometer",
    entitySlots: [
      entitySlot("fixture-temperature-entity", ["sensor"], "Thermometer", "diagnostic", [
        "temperature",
      ]),
    ],
    placement: {
      at: [0.094, 1.25],
      elevationMeters: 1.45,
      rotationYRadians: Math.PI / 2,
      support: { kind: "wall", wallId: "fixture-west" },
    },
  },
  {
    id: "fixture-motion",
    model: "motion-sensor",
    entitySlots: [
      entitySlot("fixture-motion-entity", ["binary_sensor"], "Motion sensor", "diagnostic", [
        "motion",
        "occupancy",
        "presence",
      ]),
    ],
    placement: {
      at: [0.094, 3.65],
      elevationMeters: 2.05,
      rotationYRadians: Math.PI / 2,
      support: { kind: "wall", wallId: "fixture-west" },
    },
  },
  {
    id: "fixture-blind",
    model: "motorized-blind",
    entitySlots: [entitySlot("fixture-blind-entity", ["cover"], "Motorized blind", "secondary")],
    placement: {
      at: [2.7, 0.093],
      elevationMeters: 0.57,
      rotationYRadians: 0,
      support: { kind: "wall", wallId: "fixture-north" },
    },
  },
  {
    id: "fixture-leak",
    model: "leak-sensor",
    entitySlots: [
      entitySlot("fixture-leak-entity", ["binary_sensor"], "Leak sensor", "diagnostic", [
        "moisture",
      ]),
    ],
    placement: {
      at: [4.25, 4.1],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-ceiling-fan",
    model: "ceiling-fan",
    entitySlots: [entitySlot("fixture-ceiling-fan-entity", ["fan"], "Ceiling fan", "secondary")],
    placement: {
      at: [3.5, 1.3],
      elevationMeters: 2.2,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-table-fan",
    model: "table-fan",
    entitySlots: [entitySlot("fixture-table-fan-entity", ["fan"], "Table fan", "secondary")],
    placement: {
      at: [3.15, 2.5],
      elevationMeters: 0.75,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-pedestal-fan",
    model: "pedestal-fan",
    entitySlots: [entitySlot("fixture-pedestal-fan-entity", ["fan"], "Pedestal fan", "secondary")],
    placement: {
      at: [4.2, 3.5],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-computer-fan",
    model: "computer-fan",
    entitySlots: [entitySlot("fixture-computer-fan-entity", ["fan"], "Computer fan", "secondary")],
    placement: {
      at: [1.1, 3.5],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
  {
    id: "fixture-ventilation-fan",
    model: "ventilation-fan",
    entitySlots: [
      entitySlot("fixture-ventilation-fan-entity", ["fan"], "Ventilation fan", "secondary"),
    ],
    placement: {
      at: [1.4, 3.5],
      elevationMeters: 0,
      support: { kind: "surface" },
    },
  },
];

const equippedStudio = {
  ...layoutFixtureManifest.floors[0].rooms[0],
  furnishings: "fixture-studio-furnishings",
  dashboardSlots: [],
  devices: studioDevices,
};

export const equippedFixtureManifest = defineHomeManifest({
  ...layoutFixtureManifest,
  home: { ...layoutFixtureManifest.home, id: "agent-room-fixture" },
  floors: [
    {
      ...layoutFixtureManifest.floors[0],
      rooms: [equippedStudio, layoutFixtureManifest.floors[0].rooms[1]],
    },
  ],
  extensions: defineHomeExtensionRegistry({
    furnishingModels: {},
    roomFurnishings: {
      "fixture-studio-furnishings": FixtureStudioFurnishings,
    },
    deviceModels: {},
    openingModels: {},
  }),
  assumptions: [
    ...layoutFixtureManifest.assumptions,
    {
      id: "fixture-studio-placement",
      subjectId: "fixture-studio",
      summary: "Synthetic placements exercise wall and horizontal support contacts.",
      basis: "measured",
    },
  ],
});

const state = (
  entityId: EntityId,
  value: string,
  attributes: Readonly<Record<string, unknown>> = {},
): EntityStateSnapshot => ({
  entityId,
  state: value,
  attributes,
  available: !["unknown", "unavailable"].includes(value),
  stale: false,
  lastConfirmedAt: timestamp,
  lastChanged: timestamp,
  lastUpdated: timestamp,
});

export const fixtureCatalogStates: Readonly<Record<EntityId, EntityStateSnapshot>> = {
  "switch.fixture_oven": state("switch.fixture_oven", "off", {
    friendly_name: "Oven",
  }),
  "switch.fixture_dishwasher": state("switch.fixture_dishwasher", "off", {
    friendly_name: "Dishwasher",
  }),
  "switch.fixture_tumble_dryer": state("switch.fixture_tumble_dryer", "off", {
    friendly_name: "Tumble dryer",
  }),
  "fan.fixture_pedestal_fan": state("fan.fixture_pedestal_fan", "on", {
    friendly_name: "Pedestal fan",
    percentage: 50,
    percentage_step: 10,
    preset_modes: ["normal", "sleep"],
    preset_mode: "normal",
  }),
  "fan.fixture_table_fan": state("fan.fixture_table_fan", "on", {
    friendly_name: "Table fan",
    percentage: 50,
    percentage_step: 10,
    preset_modes: ["normal", "sleep"],
    preset_mode: "normal",
  }),
  "fan.fixture_ceiling_fan": state("fan.fixture_ceiling_fan", "on", {
    friendly_name: "Ceiling fan",
    percentage: 50,
    percentage_step: 10,
    preset_modes: ["normal", "sleep"],
    preset_mode: "normal",
  }),
  "fan.fixture_computer_fan": state("fan.fixture_computer_fan", "on", {
    friendly_name: "Computer fan",
    percentage: 50,
    percentage_step: 10,
  }),
  "fan.fixture_ventilation_fan": state("fan.fixture_ventilation_fan", "on", {
    friendly_name: "Ventilation fan",
    percentage: 50,
    percentage_step: 10,
  }),
  "climate.fixture_ac": state("climate.fixture_ac", "cool", {
    friendly_name: "Indoor AC",
    current_temperature: 21.2,
    temperature: 20,
    hvac_modes: ["off", "cool"],
  }),
  "switch.fixture_washing_machine": state("switch.fixture_washing_machine", "on", {
    friendly_name: "Washing machine",
  }),
  "switch.fixture_water_heater": state("switch.fixture_water_heater", "on", {
    friendly_name: "Water heater",
  }),
  "media_player.fixture_speaker": state("media_player.fixture_speaker", "playing", {
    friendly_name: "Speaker",
    supported_features: 16389,
    volume_level: 0.3,
  }),
  "media_player.fixture_television": state("media_player.fixture_television", "playing", {
    friendly_name: "Television",
    supported_features: 16389,
    volume_level: 0.2,
  }),
  "camera.fixture_camera": state("camera.fixture_camera", "idle", {
    friendly_name: "Studio camera",
    entity_picture: "/api/camera_proxy/camera.fixture_camera?token=fixture-redacted",
    frontend_stream_type: "web_rtc",
  }),
  "light.fixture_floor_lamp": state("light.fixture_floor_lamp", "on", {
    friendly_name: "Floor lamp",
  }),
  "light.fixture_terracotta_pendant": state("light.fixture_terracotta_pendant", "on", {
    friendly_name: "Terracotta pendant",
  }),
  "switch.fixture_switch": state("switch.fixture_switch", "on", {
    friendly_name: "Wall switch",
  }),
  "binary_sensor.fixture_contact": state("binary_sensor.fixture_contact", "on", {
    friendly_name: "Opening contact",
    device_class: "window",
  }),
  "sensor.fixture_temperature": state("sensor.fixture_temperature", "21.2", {
    friendly_name: "Thermometer",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  "sensor.fixture_humidity": state("sensor.fixture_humidity", "46", {
    friendly_name: "Humidity",
    device_class: "humidity",
    unit_of_measurement: "%",
  }),
  "binary_sensor.fixture_motion": state("binary_sensor.fixture_motion", "on", {
    friendly_name: "Motion sensor",
    device_class: "motion",
  }),
  "cover.fixture_blind": state("cover.fixture_blind", "open", {
    friendly_name: "Motorized blind",
    device_class: "shade",
    current_position: 50,
    supported_features: 15,
  }),
  "binary_sensor.fixture_leak": state("binary_sensor.fixture_leak", "off", {
    friendly_name: "Leak sensor",
    device_class: "moisture",
  }),
};

export const equippedFixtureProfile = {
  schemaVersion: 1 as const,
  homeId: "agent-room-fixture",
  roomAreaIds: {
    "fixture-studio": "fixture_studio",
    "fixture-hall": "fixture_hall",
  },
  entityIdsBySlotId: {
    "fixture-ac-entity": "climate.fixture_ac",
    "fixture-washing-machine-entity": "switch.fixture_washing_machine",
    "fixture-oven-entity": "switch.fixture_oven",
    "fixture-dishwasher-entity": "switch.fixture_dishwasher",
    "fixture-tumble-dryer-entity": "switch.fixture_tumble_dryer",
    "fixture-water-heater-entity": "switch.fixture_water_heater",
    "fixture-speaker-entity": "media_player.fixture_speaker",
    "fixture-television-entity": "media_player.fixture_television",
    "fixture-camera-entity": "camera.fixture_camera",
    "fixture-floor-lamp-entity": "light.fixture_floor_lamp",
    "fixture-terracotta-pendant-entity": "light.fixture_terracotta_pendant",
    "fixture-switch-entity": "switch.fixture_switch",
    "fixture-contact-entity": "binary_sensor.fixture_contact",
    "fixture-temperature-entity": "sensor.fixture_temperature",
    "fixture-motion-entity": "binary_sensor.fixture_motion",
    "fixture-blind-entity": "cover.fixture_blind",
    "fixture-leak-entity": "binary_sensor.fixture_leak",
    "fixture-pedestal-fan-entity": "fan.fixture_pedestal_fan",
    "fixture-table-fan-entity": "fan.fixture_table_fan",
    "fixture-ceiling-fan-entity": "fan.fixture_ceiling_fan",
    "fixture-computer-fan-entity": "fan.fixture_computer_fan",
    "fixture-ventilation-fan-entity": "fan.fixture_ventilation_fan",
  },
};

const catalogEntityIds = Object.keys(fixtureCatalogStates) as EntityId[];

export const connectedCatalogRuntime: HomeAssistantRuntimeSnapshot = {
  status: "connected",
  configured: true,
  canMutate: false,
  origin: new URL("http:" + "//fixture-ha.local:8123").origin,
  error: null,
  areas: [
    {
      area_id: "fixture_studio",
      name: "Fixture studio",
      icon: "mdi:sofa-outline",
      picture: null,
      temperature_entity_id: "sensor.fixture_temperature",
      humidity_entity_id: "sensor.fixture_humidity",
    },
    {
      area_id: "fixture_hall",
      name: "Fixture hall",
      icon: "mdi:door-open",
      picture: null,
      temperature_entity_id: null,
      humidity_entity_id: null,
    },
  ],
  devices: catalogEntityIds.map((entityId, index) => ({
    id: `fixture-device-${index}`,
    area_id: "fixture_studio",
    name: fixtureCatalogStates[entityId].attributes.friendly_name as string,
    name_by_user: null,
    model: "Procedural fixture",
  })),
  entityRegistry: catalogEntityIds.map((entityId, index) => ({
    entity_id: entityId,
    area_id: "fixture_studio",
    device_id: `fixture-device-${index}`,
    disabled_by: null,
    hidden_by: null,
    name: null,
    original_name: fixtureCatalogStates[entityId].attributes.friendly_name as string,
  })),
  entityStates: fixtureCatalogStates,
};

export const unavailableCatalogRuntime: HomeAssistantRuntimeSnapshot = {
  ...connectedCatalogRuntime,
  canMutate: false,
  entityStates: Object.fromEntries(
    catalogEntityIds.map((entityId) => [
      entityId,
      state(entityId, "unavailable", fixtureCatalogStates[entityId].attributes),
    ]),
  ) as Readonly<Record<EntityId, EntityStateSnapshot>>,
};

const scaleRooms: HomeManifest["floors"][number]["rooms"] = Array.from(
  { length: 20 },
  (_, roomIndex) => {
    const column = roomIndex % 5;
    const row = Math.floor(roomIndex / 5);
    const x = column * 4;
    const y = row * 3;
    const entityIds = Array.from(
      { length: 5 },
      (_, deviceIndex) => `media_player.scale_${roomIndex}_${deviceIndex}` as EntityId,
    );
    return {
      id: `scale-room-${roomIndex}`,
      name: `Scale room ${roomIndex + 1}`,
      polygon: [
        [x + 0.08, y + 0.08],
        [x + 3.92, y + 0.08],
        [x + 3.92, y + 2.92],
        [x + 0.08, y + 2.92],
      ],
      accent: roomIndex % 2 === 0 ? "#efc5a9" : "#c7d9cf",
      dashboardSlots: [],
      devices: entityIds.map((entityId, deviceIndex) => ({
        id: `scale-device-${roomIndex}-${deviceIndex}`,
        model: "speaker" as const,
        entitySlots: [
          entitySlot(
            `scale-entity-slot-${roomIndex}-${deviceIndex}`,
            ["media_player"],
            `Scale device ${roomIndex + 1}.${deviceIndex + 1}`,
            "secondary",
          ),
        ],
        placement: {
          at: [x + 0.65 + deviceIndex * 0.65, y + 1.4] as const,
          elevationMeters: 0,
          support: { kind: "surface" as const },
        },
      })),
    };
  },
);

const scaleWalls: HomeManifest["floors"][number]["walls"] = [
  ...Array.from({ length: 6 }, (_, column) => ({
    id: `scale-wall-v-${column}`,
    from: [column * 4, 0] as const,
    to: [column * 4, 12] as const,
    classification: column === 0 || column === 5 ? ("exterior" as const) : ("interior" as const),
    thicknessMeters: column === 0 || column === 5 ? 0.18 : 0.12,
  })),
  ...Array.from({ length: 5 }, (_, row) => ({
    id: `scale-wall-h-${row}`,
    from: [0, row * 3] as const,
    to: [20, row * 3] as const,
    classification: row === 0 || row === 4 ? ("exterior" as const) : ("interior" as const),
    thicknessMeters: row === 0 || row === 4 ? 0.18 : 0.12,
  })),
];

const scaleWallJunctions: HomeManifest["floors"][number]["wallJunctions"] = Array.from(
  { length: 30 },
  (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      id: `scale-junction-${column}-${row}`,
      at: [column * 4, row * 3] as const,
      wallIds: [`scale-wall-v-${column}`, `scale-wall-h-${row}`] as const,
    };
  },
);

export const scaleFixtureManifest: HomeManifest = defineHomeManifest({
  schemaVersion: 1,
  home: {
    id: "representative-scale-fixture",
    name: "Representative scale fixture",
    locale: "en",
    palette: layoutFixtureManifest.home.palette,
  },
  floors: [
    {
      id: "scale-floor",
      name: "Scale floor",
      coordinates: { origin: [0, 0], metersPerPlanUnit: 1, scaleBasis: "measured" },
      defaultWallHeightMeters: 2.6,
      defaultCeilingHeightMeters: 2.6,
      footprint: [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
      ],
      rooms: scaleRooms,
      walls: scaleWalls,
      wallJunctions: scaleWallJunctions,
      openings: [],
    },
  ],
  sceneItems: [],
  shortcuts: layoutFixtureManifest.shortcuts,
  extensions: emptyExtensions,
  assumptions: [
    {
      id: "scale-fixture-purpose",
      subjectId: "scale-floor",
      summary: "Synthetic 20-room/100-binding fixture for deterministic budgets.",
      basis: "measured",
    },
  ],
});

export const scaleFixtureProfile = {
  schemaVersion: 1 as const,
  homeId: "representative-scale-fixture",
  roomAreaIds: Object.fromEntries(
    Array.from({ length: 20 }, (_, roomIndex) => [
      `scale-room-${roomIndex}`,
      `scale_room_${roomIndex}`,
    ]),
  ),
  entityIdsBySlotId: Object.fromEntries(
    Array.from({ length: 20 }, (_, roomIndex) =>
      Array.from({ length: 5 }, (_, deviceIndex) => [
        `scale-entity-slot-${roomIndex}-${deviceIndex}`,
        `media_player.scale_${roomIndex}_${deviceIndex}` as EntityId,
      ]),
    ).flat(),
  ),
};

const scaleEntityRecords = Array.from({ length: 20 }, (_, roomIndex) =>
  Array.from({ length: 5 }, (_, deviceIndex) => {
    const entityId = `media_player.scale_${roomIndex}_${deviceIndex}` as EntityId;
    return { roomIndex, deviceIndex, entityId };
  }),
).flat();

export const scaleMappingRuntime: HomeAssistantRuntimeSnapshot = {
  status: "connected",
  configured: true,
  canMutate: false,
  origin: new URL("http:" + "//scale-ha.local:8123").origin,
  error: null,
  areas: Array.from({ length: 20 }, (_, roomIndex) => ({
    area_id: `scale_room_${roomIndex}`,
    name: `HA room ${String(roomIndex + 1).padStart(2, "0")}`,
    icon: roomIndex % 2 === 0 ? "mdi:sofa-outline" : "mdi:bed-outline",
    picture: null,
  })),
  devices: scaleEntityRecords.map(({ roomIndex, deviceIndex }) => ({
    id: `scale-ha-device-${roomIndex}-${deviceIndex}`,
    area_id: `scale_room_${roomIndex}`,
    name: `Speaker ${roomIndex + 1}.${deviceIndex + 1}`,
    name_by_user: null,
    model: "Scale fixture speaker",
  })),
  entityRegistry: scaleEntityRecords.map(({ roomIndex, deviceIndex, entityId }) => ({
    entity_id: entityId,
    area_id: `scale_room_${roomIndex}`,
    device_id: `scale-ha-device-${roomIndex}-${deviceIndex}`,
    platform: "fixture",
    disabled_by: null,
    hidden_by: null,
    name: null,
    original_name: `Speaker ${roomIndex + 1}.${deviceIndex + 1}`,
  })),
  entityStates: Object.fromEntries(
    scaleEntityRecords.map(({ roomIndex, deviceIndex, entityId }) => [
      entityId,
      {
        entityId,
        state: "idle",
        attributes: {
          friendly_name: `Speaker ${roomIndex + 1}.${deviceIndex + 1}`,
          supported_features: 0,
        },
        available: true,
        stale: false,
        lastConfirmedAt: timestamp,
        lastChanged: timestamp,
        lastUpdated: timestamp,
      },
    ]),
  ) as Readonly<Record<EntityId, EntityStateSnapshot>>,
};
