import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { withModules } from "./test-server.mjs";
import { connectedManifestFixture, connectedRuntimeFixture } from "./fixtures/home-assistant.mjs";

await withModules(async (load) => {
  const { neutralDemoManifest } = await load("/packages/engine/src/demo.ts");
  const profileModule = await load("/packages/engine/src/runtime-binding-profile.ts");
  const { connectionCandidates } = await load(
    "/packages/engine/src/home-assistant-mapping/connection-candidates.ts",
  );
  const resolver = await load("/packages/engine/src/home-assistant-resolver.ts");
  const controls = await load("/packages/engine/src/home-assistant-controls.ts");
  const { ConnectionSourcePicker } = await load(
    "/packages/engine/src/home-assistant-mapping/ConnectionSourcePicker.tsx",
  );
  const { ownerProjectRegistries } = await load("/apps/web/src/project-runtime.ts");
  const { catalogEntries } = await load("/apps/web/src/editor-preview/furnish/catalog/catalog.ts");
  const { createCatalogItem } = await load(
    "/apps/web/src/editor-preview/furnish/placement/item-creation.ts",
  );
  const entries = catalogEntries(
    ownerProjectRegistries.furnishingModels,
    ownerProjectRegistries.deviceModels,
  );

  const manifestFixture = () => connectedManifestFixture(neutralDemoManifest);

  for (const [model, domain, deviceClass, otherClass] of [
    ["smart-plug", "switch", "outlet", "switch"],
    ["smart-power-strip", "switch", "outlet", "switch"],
    ["motorized-curtain", "cover", "curtain", "blind"],
  ]) {
    test(`${model} accepts explicit connections regardless of optional device class`, () => {
      const manifest = manifestFixture();
      const room = manifest.floors[0].rooms[0];
      room.dashboardSlots = [];
      const item = createCatalogItem(
        entries.find((entry) => entry.modelId === model),
        { kind: "absolute", at: [2, 2], elevationMeters: 0, rotationYRadians: 0 },
        [],
        [],
        manifest.floors[0].id,
      );
      const slot = item.entitySlots[0];
      const slotId = slot.id;
      // Saved homes retain these constraints too; no re-placement or migration.
      assert.deepEqual(slot.compatibleDeviceClasses, [deviceClass]);
      room.devices = [
        {
          ...room.devices[0],
          id: item.id,
          model,
          entitySlots: item.entitySlots,
        },
      ];
      const runtime = connectedRuntimeFixture();
      const entry = runtime.entityRegistry.find((entry) =>
        entry.entity_id.startsWith(`${domain}.`),
      );
      const state = runtime.entityStates[entry.entity_id];
      for (const [name, candidateClass, platform] of [
        ["matter_control", deviceClass, "matter"],
        ["zigbee_control", undefined, "mqtt"],
        ["generic_control", otherClass, "mqtt"],
        ["null_class", null, "template"],
      ]) {
        const entityId = `${domain}.${name}`;
        runtime.entityRegistry.push({ ...entry, entity_id: entityId, platform });
        runtime.entityStates[entityId] = {
          ...state,
          entityId,
          state: domain === "switch" ? "off" : "closed",
          attributes: {
            ...state.attributes,
            ...(candidateClass !== undefined ? { device_class: candidateClass } : {}),
          },
        };
      }
      const profile = profileModule.createEmptyRuntimeBindingProfile(manifest.home.id);
      const descriptor = profileModule
        .collectBindingSlots(manifest)
        .find((slot) => slot.slotId === slotId);
      const candidates = connectionCandidates(descriptor, room.id, profile, runtime);
      const expected = runtime.entityRegistry
        .filter((entry) => entry.entity_id.startsWith(`${domain}.`))
        .map((entry) => entry.entity_id)
        .sort();
      assert.deepEqual(candidates.map((entry) => entry.entityId).sort(), expected);
      assert.equal(
        candidates[0].entityId,
        `${domain}.matter_control`,
        "class matches remain preferred",
      );
      const markup = renderToStaticMarkup(
        React.createElement(ConnectionSourcePicker, {
          descriptor,
          roomId: room.id,
          profile,
          runtime,
          disabled: false,
          title: "Connect",
          description: "Choose a source",
          onSelect() {},
        }),
      );
      const document = new JSDOM(markup).window.document;
      assert.equal(
        document.querySelectorAll(".connection-source:not([disabled])").length,
        expected.length,
      );
      for (const entityId of expected) {
        const mapped = profileModule.replaceEntitySlotMapping(profile, slotId, entityId);
        const imported = profileModule.importRuntimeBindingProfile(
          profileModule.exportRuntimeBindingProfile(mapped),
          manifest,
          runtime,
        );
        assert.equal(imported.valid, true, `${entityId}: ${JSON.stringify(imported.issues)}`);
        const binding = resolver.resolveHomeAssistantBindings(manifest, imported.profile, runtime)
          .rooms[room.id].devices[0].entities[0];
        assert.deepEqual(binding.issues, []);
        assert.equal(resolver.bindingCanMutate(binding), true);
        const call =
          domain === "switch"
            ? controls.toggleEntityCall(binding.state)
            : controls.coverActionCall(binding.state, "open_cover");
        assert.equal(call.domain, domain);
        assert.deepEqual(call.target, { entity_id: entityId });
      }
      slot.autoMap = "unique-compatible";
      profile.roomAreaIds[room.id] = "demo_room";
      assert.equal(
        profileModule.automaticallyMapRuntimeBindings(manifest, profile, runtime).profile
          .entityIdsBySlotId[slotId],
        `${domain}.matter_control`,
      );
      delete runtime.entityStates[`${domain}.matter_control`].attributes.device_class;
      assert.equal(
        profileModule.automaticallyMapRuntimeBindings(manifest, profile, runtime).profile
          .entityIdsBySlotId[slotId],
        undefined,
        "automatic matching still requires declared classes",
      );
    });
  }
});
