import { outdoorPlatforms } from "./schema-outdoor-platforms";
import { validateHomePosition } from "./schema-home-position";
import { validateActionBarSchema } from "./schema-action-bar";
import { entitySlot } from "./schema-entity-slot";
import { wallSchema } from "./schema-wall";
import { projectSchemaVersionMessage } from "./project-format-errors";
import { sceneItem } from "./schema-scene-item";
import { validateProjectModelCatalogs } from "../imported-models/model-schema";
import { keys, record, array, string, finite, point, polygon } from "./schema-json-values";
import { openingSchema } from "./schema-opening";
import { validHedge } from "../hedges/hedge-validity";
import type { HedgeSpec } from "../types";
import { room } from "./schema-room";
import { floorZone } from "./schema-floor-finish";
import type { HomeProject, LegacyHomeProject } from "./types";
import { addProjectIssue, isPlainRecord, type HomeProjectIssue } from "./validation-types";

const stringArray = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  array(value, path, issues)?.forEach((entry, index) => string(entry, `${path}[${index}]`, issues));
};

const contactSlot = (value: unknown, path: string, issues: HomeProjectIssue[]) => {
  const slot = record(value, path, issues);
  if (!slot) return;
  keys(slot, ["id", "compatibleDeviceClasses", "openState", "autoMap"], path, issues);
  string(slot.id, `${path}.id`, issues);
  array(slot.compatibleDeviceClasses, `${path}.compatibleDeviceClasses`, issues)?.forEach(
    (entry, index) => {
      if (!["door", "window", "opening"].includes(String(entry))) {
        addProjectIssue(
          issues,
          "project.contact-class",
          `${path}.compatibleDeviceClasses[${index}]`,
          "Opening contact device class is invalid.",
        );
      }
    },
  );
  if (!["on", "off"].includes(String(slot.openState))) {
    addProjectIssue(
      issues,
      "project.contact-open-state",
      `${path}.openState`,
      "Contact openState is invalid.",
    );
  }
  if (!["unique-compatible", "manual"].includes(String(slot.autoMap))) {
    addProjectIssue(
      issues,
      "project.contact-auto-map",
      `${path}.autoMap`,
      "Contact autoMap is invalid.",
    );
  }
};

const floor = (value: unknown, path: string, issues: HomeProjectIssue[], legacy: boolean) => {
  const candidate = record(value, path, issues);
  if (!candidate) return;
  keys(
    candidate,
    [
      "id",
      "name",
      "floorToFloorHeightMeters",
      "belowGround",
      "coordinates",
      "defaultWallHeightMeters",
      "defaultCeilingHeightMeters",
      "footprint",
      "footprintRegions",
      "rooms",
      "walls",
      "wallJunctions",
      "openings",
      "ceilings",
      "hedges",
      "pools",
      "outdoorPlatforms",
      "groundZones",
    ],
    path,
    issues,
  );
  if (candidate.groundZones !== undefined)
    array(candidate.groundZones, `${path}.groundZones`, issues)?.forEach((entry, index) =>
      floorZone(entry, `${path}.groundZones[${index}]`, issues),
    );
  if (candidate.hedges !== undefined)
    array(candidate.hedges, `${path}.hedges`, issues)?.forEach((entry, index) => {
      const hedgePath = `${path}.hedges[${index}]`;
      const hedge = record(entry, hedgePath, issues);
      if (!hedge) return;
      keys(hedge, ["id", "from", "to", "style", "heightMeters", "widthMeters"], hedgePath, issues);
      string(hedge.id, `${hedgePath}.id`, issues);
      point(hedge.from, `${hedgePath}.from`, issues);
      point(hedge.to, `${hedgePath}.to`, issues);
      if (
        !validHedge(
          hedge as unknown as HedgeSpec,
          (candidate.coordinates as { metersPerPlanUnit?: number } | undefined)
            ?.metersPerPlanUnit ?? 1,
        )
      )
        addProjectIssue(
          issues,
          "project.hedge",
          hedgePath,
          "Boundaries need distinct endpoints, a supported style, height 0.2–5 m and width 0.2–3 m.",
        );
    });
  if (candidate.outdoorPlatforms !== undefined)
    outdoorPlatforms(candidate.outdoorPlatforms, `${path}.outdoorPlatforms`, issues);
  if (candidate.pools !== undefined)
    array(candidate.pools, `${path}.pools`, issues)?.forEach((entry, index) => {
      const poolPath = `${path}.pools[${index}]`;
      const pool = record(entry, poolPath, issues);
      if (!pool) return;
      keys(pool, ["id", "polygon"], poolPath, issues);
      string(pool.id, `${poolPath}.id`, issues);
      polygon(pool.polygon, `${poolPath}.polygon`, issues);
    });
  string(candidate.id, `${path}.id`, issues);
  string(candidate.name, `${path}.name`, issues);
  const coordinates = record(candidate.coordinates, `${path}.coordinates`, issues);
  if (coordinates) {
    keys(coordinates, ["origin", "metersPerPlanUnit", "scaleBasis"], `${path}.coordinates`, issues);
    point(coordinates.origin, `${path}.coordinates.origin`, issues);
    finite(coordinates.metersPerPlanUnit, `${path}.coordinates.metersPerPlanUnit`, issues);
    if (!["measured", "inferred"].includes(String(coordinates.scaleBasis)))
      addProjectIssue(
        issues,
        "project.scale-basis",
        `${path}.coordinates.scaleBasis`,
        "Scale basis is invalid.",
      );
  }
  finite(candidate.defaultWallHeightMeters, `${path}.defaultWallHeightMeters`, issues);
  finite(candidate.defaultCeilingHeightMeters, `${path}.defaultCeilingHeightMeters`, issues);
  if (!legacy || candidate.floorToFloorHeightMeters !== undefined) {
    finite(candidate.floorToFloorHeightMeters, `${path}.floorToFloorHeightMeters`, issues);
    if (
      typeof candidate.floorToFloorHeightMeters === "number" &&
      candidate.floorToFloorHeightMeters <= 0
    )
      addProjectIssue(
        issues,
        "project.floor-height",
        `${path}.floorToFloorHeightMeters`,
        "Floor height must be positive.",
      );
  }
  if (legacy || !Array.isArray(candidate.footprint) || candidate.footprint.length !== 0)
    polygon(candidate.footprint, `${path}.footprint`, issues);
  if (candidate.footprintRegions !== undefined) {
    array(candidate.footprintRegions, `${path}.footprintRegions`, issues)?.forEach((entry, index) =>
      polygon(entry, `${path}.footprintRegions[${index}]`, issues),
    );
  }
  array(candidate.rooms, `${path}.rooms`, issues)?.forEach((entry, index) =>
    room(entry, `${path}.rooms[${index}]`, issues),
  );
  array(candidate.walls, `${path}.walls`, issues)?.forEach((entry, index) =>
    wallSchema(entry, `${path}.walls[${index}]`, issues),
  );
  array(candidate.wallJunctions, `${path}.wallJunctions`, issues)?.forEach((entry, index) => {
    const junctionPath = `${path}.wallJunctions[${index}]`;
    const junction = record(entry, junctionPath, issues);
    if (!junction) return;
    keys(junction, ["id", "at", "wallIds"], junctionPath, issues);
    string(junction.id, `${junctionPath}.id`, issues);
    point(junction.at, `${junctionPath}.at`, issues);
    stringArray(junction.wallIds, `${junctionPath}.wallIds`, issues);
  });
  array(candidate.openings, `${path}.openings`, issues)?.forEach((entry, index) =>
    openingSchema(entry, `${path}.openings[${index}]`, issues),
  );
  if (candidate.ceilings !== undefined)
    array(candidate.ceilings, `${path}.ceilings`, issues)?.forEach((entry, index) => {
      const ceilingPath = `${path}.ceilings[${index}]`;
      const ceiling = record(entry, ceilingPath, issues);
      if (!ceiling) return;
      keys(ceiling, ["id", "kind", "roomIds", "heightMeters"], ceilingPath, issues);
      string(ceiling.id, `${ceilingPath}.id`, issues);
      if (ceiling.kind !== "flat")
        addProjectIssue(
          issues,
          "project.ceiling-kind",
          `${ceilingPath}.kind`,
          "Layout projects support flat ceilings only.",
        );
      stringArray(ceiling.roomIds, `${ceilingPath}.roomIds`, issues);
      finite(ceiling.heightMeters, `${ceilingPath}.heightMeters`, issues);
    });
};

export const validateHomeProjectSchemaShape = (
  input: unknown,
  issues: HomeProjectIssue[],
): HomeProject | LegacyHomeProject | null => {
  const project = record(input, "$", issues);
  if (!project) return null;
  const legacy = project.schemaVersion === 1;
  validateProjectModelCatalogs(project, issues);
  keys(
    project,
    [
      "schemaVersion",
      "seedRevision",
      "home",
      ...(legacy ? ["floor"] : ["floors", "coordinates", "stairs"]),
      "sceneItems",
      "customModels",
      "modelLights",
      "roomProfiles",
      "openingProfiles",
      "shortcuts",
      "actionBar",
      "toolState",
      "assumptions",
    ],
    "$",
    issues,
  );
  if (!legacy && project.schemaVersion !== 2)
    addProjectIssue(
      issues,
      "project.schema-version",
      "schemaVersion",
      projectSchemaVersionMessage(project.schemaVersion, "project"),
    );
  if (project.toolState !== undefined) record(project.toolState, "toolState", issues);
  string(project.seedRevision, "seedRevision", issues);
  const home = record(project.home, "home", issues);
  if (home) {
    keys(
      home,
      [
        "id",
        "name",
        "locale",
        "palette",
        "roof",
        "walkStart",
        "northAngleDegrees",
        "apartmentFloor",
      ],
      "home",
      issues,
    );
    validateHomePosition(home, issues);
    if (home.walkStart !== undefined) {
      const start = record(home.walkStart, "home.walkStart", issues);
      if (start) {
        keys(start, ["floorId", "at"], "home.walkStart", issues);
        string(start.floorId, "home.walkStart.floorId", issues);
        point(start.at, "home.walkStart.at", issues);
      }
    }
    if (home.roof !== undefined) {
      const roof = record(home.roof, "home.roof", issues);
      if (roof) {
        keys(roof, ["direction", "color", "edgeColor"], "home.roof", issues);
        if (
          roof.direction !== "left-right" &&
          roof.direction !== "front-back" &&
          roof.direction !== "flat"
        )
          addProjectIssue(
            issues,
            "project.roof-direction",
            "home.roof.direction",
            "Choose a left–right or front–back roof ridge, or a flat roof.",
          );
        for (const field of ["color", "edgeColor"]) {
          if (typeof roof[field] !== "string" || !/^#[0-9a-f]{6}$/i.test(roof[field]))
            addProjectIssue(
              issues,
              "project.roof-color",
              `home.roof.${field}`,
              "Choose a six-digit hex roof color, such as #aa6250.",
            );
        }
      }
    }
    string(home.id, "home.id", issues);
    string(home.name, "home.name", issues);
    if (home.locale !== "en")
      addProjectIssue(issues, "project.locale", "home.locale", "V1 supports only the en locale.");
    const palette = record(home.palette, "home.palette", issues);
    if (palette) {
      keys(
        palette,
        ["accent", "secondary", "exterior", "interior", "ground"],
        "home.palette",
        issues,
      );
      for (const color of ["accent", "secondary", "exterior", "interior", "ground"])
        string(palette[color], `home.palette.${color}`, issues);
    }
  }
  if (legacy) floor(project.floor, "floor", issues, true);
  else {
    const coordinates = record(project.coordinates, "coordinates", issues);
    if (coordinates) {
      keys(coordinates, ["origin", "metersPerPlanUnit", "scaleBasis"], "coordinates", issues);
      point(coordinates.origin, "coordinates.origin", issues);
      finite(coordinates.metersPerPlanUnit, "coordinates.metersPerPlanUnit", issues);
      if (typeof coordinates.metersPerPlanUnit === "number" && coordinates.metersPerPlanUnit <= 0)
        addProjectIssue(
          issues,
          "project.scale",
          "coordinates.metersPerPlanUnit",
          "Scale must be positive.",
        );
      if (!["measured", "inferred"].includes(String(coordinates.scaleBasis)))
        addProjectIssue(
          issues,
          "project.scale-basis",
          "coordinates.scaleBasis",
          "Scale basis is invalid.",
        );
    }
    const floors = array(project.floors, "floors", issues);
    if (floors?.length === 0)
      addProjectIssue(
        issues,
        "project.floors-empty",
        "floors",
        "A building requires a ground floor.",
      );
    const floorIds = new Set<string>();
    let groundSeen = false;
    floors?.forEach((entry, index) => {
      const path = `floors[${index}]`;
      floor(entry, path, issues, false);
      if (!isPlainRecord(entry)) return;
      if (entry.belowGround !== undefined && typeof entry.belowGround !== "boolean")
        addProjectIssue(
          issues,
          "project.floor-basement",
          `${path}.belowGround`,
          "Basement classification must be a boolean.",
        );
      if (entry.belowGround === true && groundSeen)
        addProjectIssue(
          issues,
          "project.floor-order",
          `${path}.belowGround`,
          "Basements must precede the ground floor.",
        );
      if (entry.belowGround !== true) groundSeen = true;
      if (typeof entry.id === "string") {
        if (floorIds.has(entry.id))
          addProjectIssue(
            issues,
            "project.floor-id-duplicate",
            `${path}.id`,
            "Floor IDs must be unique.",
          );
        floorIds.add(entry.id);
      }
      const transform = entry.coordinates;
      if (
        coordinates &&
        isPlainRecord(transform) &&
        (JSON.stringify(transform.origin) !== JSON.stringify(coordinates.origin) ||
          transform.metersPerPlanUnit !== coordinates.metersPerPlanUnit ||
          transform.scaleBasis !== coordinates.scaleBasis)
      )
        addProjectIssue(
          issues,
          "project.floor-transform",
          `${path}.coordinates`,
          "All floors must use the building coordinates.",
        );
    });
    if (floors?.length && !groundSeen)
      addProjectIssue(
        issues,
        "project.ground-missing",
        "floors",
        "A building requires a ground floor.",
      );
    array(project.stairs, "stairs", issues)?.forEach((entry, index) => {
      const path = `stairs[${index}]`;
      const stair = record(entry, path, issues);
      if (!stair) return;
      const shape = stair.shape ?? "straight";
      if (
        stair.railings !== undefined &&
        !["both", "left", "right", "none"].includes(
          typeof stair.railings === "string" ? stair.railings : "",
        )
      )
        addProjectIssue(
          issues,
          "stair.railings",
          `${path}.railings`,
          "Choose Both, Left, Right, or None.",
        );
      const dimensions =
        shape === "spiral"
          ? ["diameterMeters", "totalTurnDegrees"]
          : shape === "l-shaped" || shape === "u-shaped"
            ? ["widthMeters", "lowerRunMeters", "upperRunMeters"]
            : ["widthMeters", "runMeters"];
      keys(
        stair,
        [
          "id",
          "lowerFloorId",
          "upperFloorId",
          "at",
          "rotationYRadians",
          "shape",
          "railings",
          ...dimensions,
          ...(shape === "spiral"
            ? ["direction"]
            : shape === "l-shaped" || shape === "u-shaped"
              ? ["turn"]
              : []),
        ],
        path,
        issues,
      );
      if (
        !["straight", "l-shaped", "u-shaped", "spiral"].includes(
          typeof shape === "string" ? shape : "",
        )
      )
        addProjectIssue(issues, "stair.shape", `${path}.shape`, "Unknown stair shape.");
      if (
        shape === "spiral" &&
        !["clockwise", "counterclockwise"].includes(String(stair.direction))
      )
        addProjectIssue(
          issues,
          "stair.direction",
          `${path}.direction`,
          "Choose clockwise or counterclockwise.",
        );
      if (
        (shape === "l-shaped" || shape === "u-shaped") &&
        !["left", "right"].includes(String(stair.turn))
      )
        addProjectIssue(issues, "stair.turn", `${path}.turn`, "Choose left or right.");
      for (const key of ["id", "lowerFloorId", "upperFloorId"])
        string(stair[key], `${path}.${key}`, issues);
      point(stair.at, `${path}.at`, issues);
      for (const key of ["rotationYRadians", ...dimensions])
        finite(stair[key], `${path}.${key}`, issues);
    });
  }
  array(project.sceneItems, "sceneItems", issues)?.forEach((entry, index) =>
    sceneItem(entry, `sceneItems[${index}]`, issues, legacy),
  );
  const roomProfiles = record(project.roomProfiles, "roomProfiles", issues);
  if (roomProfiles)
    for (const [id, entry] of Object.entries(roomProfiles)) {
      const path = `roomProfiles.${id}`;
      const profile = record(entry, path, issues);
      if (!profile) continue;
      keys(profile, ["dashboardSlots"], path, issues);
      array(profile.dashboardSlots, `${path}.dashboardSlots`, issues)?.forEach((slot, index) =>
        entitySlot(slot, `${path}.dashboardSlots[${index}]`, issues),
      );
    }
  const openingProfiles = record(project.openingProfiles, "openingProfiles", issues);
  if (openingProfiles)
    for (const [id, entry] of Object.entries(openingProfiles)) {
      const path = `openingProfiles.${id}`;
      const profile = record(entry, path, issues);
      if (!profile) continue;
      keys(profile, ["contactSlot", "coverSlot"], path, issues);
      if (profile.coverSlot !== undefined) {
        const slot = record(profile.coverSlot, `${path}.coverSlot`, issues);
        if (slot) {
          keys(slot, ["id", "autoMap"], `${path}.coverSlot`, issues);
          if (typeof slot.id !== "string" || !slot.id.trim())
            addProjectIssue(
              issues,
              "project.cover-slot-id",
              `${path}.coverSlot.id`,
              "Cover slot needs an ID.",
            );
          if (!["manual", "unique-compatible"].includes(String(slot.autoMap)))
            addProjectIssue(
              issues,
              "project.cover-slot-auto-map",
              `${path}.coverSlot.autoMap`,
              "Invalid cover mapping policy.",
            );
        }
      }
      if (profile.contactSlot !== undefined)
        contactSlot(profile.contactSlot, `${path}.contactSlot`, issues);
    }
  array(project.shortcuts, "shortcuts", issues)?.forEach((entry, index) => {
    const path = `shortcuts[${index}]`;
    const shortcut = record(entry, path, issues);
    if (!shortcut) return;
    keys(shortcut, ["id", "action", "context", "order"], path, issues);
    string(shortcut.id, `${path}.id`, issues);
    if (
      ![
        "home-view",
        "room-details",
        "construct-mode",
        "arrange-mode",
        "connect-mode",
        "walk-mode",
        "lighting-mode",
        "wall-fade",
        "all-lights",
      ].includes(String(shortcut.action))
    )
      addProjectIssue(
        issues,
        "project.shortcut-action",
        `${path}.action`,
        "Shortcut action is invalid.",
      );
    if (!["overview", "room", "both"].includes(String(shortcut.context)))
      addProjectIssue(
        issues,
        "project.shortcut-context",
        `${path}.context`,
        "Shortcut context is invalid.",
      );
    if (!Number.isInteger(shortcut.order))
      addProjectIssue(
        issues,
        "project.shortcut-order",
        `${path}.order`,
        "Shortcut order must be an integer.",
      );
  });
  validateActionBarSchema(project, issues);
  array(project.assumptions, "assumptions", issues)?.forEach((entry, index) => {
    const path = `assumptions[${index}]`;
    const assumption = record(entry, path, issues);
    if (!assumption) return;
    keys(assumption, ["id", "subjectId", "summary", "basis"], path, issues);
    string(assumption.id, `${path}.id`, issues);
    string(assumption.subjectId, `${path}.subjectId`, issues);
    string(assumption.summary, `${path}.summary`, issues);
    if (!["measured", "plan", "photo", "inferred", "user"].includes(String(assumption.basis)))
      addProjectIssue(
        issues,
        "project.assumption-basis",
        `${path}.basis`,
        "Assumption basis is invalid.",
      );
  });
  return project as unknown as HomeProject | LegacyHomeProject;
};
