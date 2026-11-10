import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { withModules } from "./test-server.mjs";

await withModules(async (load) => {
  const engine = await load("/packages/engine/src/index.ts");
  const { ownerHomeProject, homeExtensions } = await load("/tests/fixtures/bundled-home.ts");
  const { EntitySlotMappingRow } = await load(
    "/packages/engine/src/home-assistant-mapping/EntitySlotMappingRow.tsx",
  );
  const { deviceRoom } = await load("/apps/web/src/editor-connect/connect-navigation.ts");
  const project = structuredClone(ownerHomeProject);
  project.openingProfiles = {};
  const manifest = engine.composeHomeManifest(project, homeExtensions);
  const floor = {
    rooms: manifest.floors.flatMap((floor) => floor.rooms),
    openings: manifest.floors.flatMap((floor) => floor.openings),
  };
  const descriptors = engine
    .collectBindingSlots(manifest)
    .filter((slot) => slot.kind === "opening-contact");
  const descriptor = descriptors[0];
  const runtime = {
    status: "connected",
    origin: "https://synthetic.invalid",
    areas: [],
    devices: [],
    entityRegistry: [
      {
        entity_id: "binary_sensor.arbitrary_contact",
        area_id: null,
        device_id: null,
        name: "Custom contact",
        disabled_by: null,
        hidden_by: null,
      },
    ],
    entityStates: {
      "binary_sensor.arbitrary_contact": {
        entityId: "binary_sensor.arbitrary_contact",
        state: "on",
        available: true,
        attributes: { device_class: "opening" },
        lastChanged: "",
        lastUpdated: "",
      },
    },
  };
  const profile = engine.createEmptyRuntimeBindingProfile(manifest.home.id);

  const { openingPreviewEntry } = await load(
    "/apps/web/src/editor-preview/openings/opening-preview-entry.tsx",
  );
  test("opening previews use the actual door/window geometry and invalidate cached images on visual edits", () => {
    for (const opening of floor.openings) {
      const entry = openingPreviewEntry(manifest, opening.id);
      if (opening.kind === "passage") {
        assert.equal(entry, null);
        continue;
      }
      assert.equal(entry.kind, "procedural");
      const rendered = entry.definition.component();
      assert.equal(rendered.props.opening.kind, opening.kind);
      assert.equal(rendered.props.opening.variant, opening.variant);
      assert.equal(rendered.props.opening.operation, opening.operation);
      assert.equal(rendered.props.opening.openingHeightMeters, opening.openingHeightMeters);
      assert.equal(rendered.props.opening.sillHeightMeters, 0);
      assert.equal(rendered.props.reducedMotion, true);
      const changed = structuredClone(project);
      changed.floors
        .flatMap((floor) => floor.openings)
        .find((item) => item.id === opening.id).openingHeightMeters += 0.2;
      assert.notEqual(
        openingPreviewEntry(engine.composeHomeManifest(changed, homeExtensions), opening.id).key,
        entry.key,
      );
    }
  });

  test("every project door and window gets a stable manual contact, without mutating the layout", () => {
    assert.equal(
      descriptors.length,
      floor.openings.filter((opening) => opening.kind !== "passage").length,
    );
    assert.ok(
      project.floors.flatMap((floor) => floor.openings).every((opening) => !opening.contactSlot),
    );
    for (const opening of floor.openings) {
      if (opening.kind === "passage") {
        assert.equal(opening.contactSlot, undefined);
        continue;
      }
      assert.equal(opening.contactSlot.id, `${opening.id}-contact`);
      assert.equal(opening.contactSlot.autoMap, "manual");
      assert.ok(deviceRoom(manifest, opening.contactSlot.id), opening.id);
    }
    const restored = engine.composeHomeManifest(
      JSON.parse(JSON.stringify(project)),
      homeExtensions,
    );
    assert.deepEqual(engine.collectBindingSlots(restored), engine.collectBindingSlots(manifest));
  });

  test("unbound openings do not produce missing-binding warnings", () => {
    const resolved = engine.resolveHomeAssistantBindings(manifest, profile, runtime);
    for (const opening of Object.values(resolved.openings)) {
      assert.equal(opening.issue, undefined);
      assert.equal(opening.entityId, undefined);
    }
  });

  test("manual opening mapping accepts an opening sensor without any area mapping and drives state", () => {
    const candidates = engine.bindingEntityCandidates({
      descriptor,
      roomId: descriptor.roomIds[0],
      profile,
      runtime,
      scope: "all-areas",
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].selectable, true);
    const bound = {
      ...profile,
      entityIdsBySlotId: { [descriptor.slotId]: candidates[0].entityId },
    };
    const validation = engine.validateRuntimeBindingProfile(bound, manifest, runtime);
    assert.equal(validation.valid, true, JSON.stringify(validation.issues));
    const resolved = engine.resolveHomeAssistantBindings(manifest, bound, runtime);
    assert.equal(resolved.openings[descriptor.openingId].state, "open");
    assert.ok(!resolved.openings[descriptor.openingId].issue);
    const closed = structuredClone(runtime);
    closed.entityStates[candidates[0].entityId].state = "off";
    assert.equal(
      engine.resolveHomeAssistantBindings(manifest, bound, closed).openings[descriptor.openingId]
        .state,
      "closed",
    );
  });

  test("only opening detectors are offered, regardless of area or detector name", () => {
    for (const deviceClass of [
      "door",
      "window",
      "opening",
      "garage_door",
      "motion",
      "battery",
      "connectivity",
      undefined,
    ]) {
      const snapshot = structuredClone(runtime);
      snapshot.entityStates["binary_sensor.arbitrary_contact"].attributes.device_class =
        deviceClass;
      const accepted = ["door", "window", "opening", "garage_door"].includes(deviceClass);
      const candidates = engine.bindingEntityCandidates({
        descriptor,
        roomId: descriptor.roomIds[0],
        profile,
        runtime: snapshot,
        scope: "all-areas",
      });
      assert.equal(candidates.length, accepted ? 1 : 0, String(deviceClass));
      assert.equal(
        engine.validateRuntimeBindingProfile(
          {
            ...profile,
            entityIdsBySlotId: { [descriptor.slotId]: "binary_sensor.arbitrary_contact" },
          },
          manifest,
          snapshot,
        ).valid,
        accepted,
      );
    }
  });

  test("a sensor already bound to another opening remains selectable and preserves both bindings", () => {
    const other = descriptors[1];
    const used = {
      ...profile,
      entityIdsBySlotId: { [other.slotId]: "binary_sensor.arbitrary_contact" },
    };
    const candidates = engine.bindingEntityCandidates({
      descriptor,
      roomId: descriptor.roomIds[0],
      profile: used,
      runtime,
      scope: "all-areas",
    });
    assert.equal(candidates[0].selectable, true);
    const bound = engine.replaceEntitySlotMapping(used, descriptor.slotId, candidates[0].entityId);
    assert.equal(Object.keys(bound.entityIdsBySlotId).length, 2);
    assert.equal(engine.validateRuntimeBindingProfile(bound, manifest, runtime).valid, true);
    const resolved = engine.resolveHomeAssistantBindings(manifest, bound, runtime);
    assert.equal(resolved.openings[descriptor.openingId].state, "open");
    assert.equal(resolved.openings[other.openingId].state, "open");
    assert.ok(!resolved.openings[other.openingId].issue);
  });

  test("the opening card displays its saved cross-area sensor without a room mapping", () => {
    const html = renderToStaticMarkup(
      createElement(EntitySlotMappingRow, {
        descriptor,
        room: floor.rooms.find((room) => room.id === descriptor.roomIds[0]),
        profile: {
          ...profile,
          entityIdsBySlotId: { [descriptor.slotId]: "binary_sensor.arbitrary_contact" },
        },
        runtime,
        disabled: false,
        selected: false,
        onOpen() {},
      }),
    );
    assert.match(html, /Custom contact/);
    assert.doesNotMatch(html, /Saved match unavailable/);
  });

  test("explicit legacy slot IDs and inverted polarity survive composition", () => {
    const custom = structuredClone(project);
    custom.openingProfiles[descriptor.openingId] = {
      contactSlot: {
        id: "legacy-contact",
        compatibleDeviceClasses: ["door"],
        openState: "off",
        autoMap: "manual",
      },
    };
    const restored = engine.composeHomeManifest(custom, homeExtensions);
    const opening = restored.floors
      .flatMap((floor) => floor.openings)
      .find((opening) => opening.id === descriptor.openingId);
    assert.equal(opening.contactSlot.id, "legacy-contact");
    assert.equal(
      engine.deriveOpeningState(opening, "binary_sensor.arbitrary_contact", runtime),
      "closed",
    );
    assert.equal(engine.entityMatchesBindingSlot(descriptor, "light.example", runtime), false);
  });
});
