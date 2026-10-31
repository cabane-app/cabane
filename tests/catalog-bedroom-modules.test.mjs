import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { Box3, Vector3 } from "three";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await withModules(async (load) => {
  const { stableFurnishingRegistry } = await load("/packages/catalog/src/furnishing/index.ts");
  test("bedside cabinet variants render one full-height door and one handed knob", async () => {
    const definition = stableFurnishingRegistry["knob-door-wardrobe"];
    for (const variant of ["default", "single-left", "single-right"]) {
      const renderer = await create(
        createElement(definition.component, { size: [0.53, 2.4, 0.6], variant }),
      );
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const doors = [],
          knobs = [];
        scene.traverse((object) => {
          if (object.name === "wardrobe-door") doors.push(object);
          if (object.name === "wardrobe-knob") knobs.push(object);
        });
        assert.equal(doors.length, variant === "default" ? 2 : 1);
        assert.equal(knobs.length, doors.length);
        if (variant !== "default") {
          const knob = knobs[0].getWorldPosition(new Vector3());
          assert.equal(Math.sign(knob.x), variant === "single-left" ? -1 : 1);
          const doorBounds = new Box3().setFromObject(doors[0]);
          assert.ok(doorBounds.getSize(new Vector3()).x > 0.52, "one door spans the cabinet width");
        }
      } finally {
        await renderer.unmount();
      }
    }
  });
  test("overbed bridge has three independently modeled doors", async () => {
    const definition = stableFurnishingRegistry["overbed-bridge-cabinet"];
    const renderer = await create(
      createElement(definition.component, { size: definition.defaultSize }),
    );
    try {
      const doors = [];
      renderer.scene.instance.traverse((object) => {
        if (object.name === "bridge-door") doors.push(object);
      });
      assert.equal(doors.length, 3);
    } finally {
      await renderer.unmount();
    }
  });
  test("bunk bed exposes ladder variants on all four sides in one envelope", async () => {
    const definition = stableFurnishingRegistry["wood-bunk-bed"];
    assert.deepEqual(definition.variants, [
      { id: "default", label: "Ladder on right side" },
      { id: "ladder-left", label: "Ladder on left side" },
      { id: "ladder-front", label: "Ladder on front end" },
      { id: "ladder-back", label: "Ladder on back end" },
    ]);
    for (const { variant, axis, side, rungAxis } of [
      { variant: "default", axis: "x", side: 1, rungAxis: "z" },
      { variant: "ladder-left", axis: "x", side: -1, rungAxis: "z" },
      { variant: "ladder-front", axis: "z", side: 1, rungAxis: "x" },
      { variant: "ladder-back", axis: "z", side: -1, rungAxis: "x" },
    ]) {
      const renderer = await create(
        createElement(definition.component, { size: definition.defaultSize, variant }),
      );
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const ladderParts = [];
        scene.traverse((object) => {
          if (object.name === "bunk-ladder-post" || object.name === "bunk-ladder-rung")
            ladderParts.push(object);
        });
        assert.equal(ladderParts.length, 6);
        assert.ok(
          ladderParts.every(
            (part) => Math.sign(part.getWorldPosition(new Vector3())[axis]) === side,
          ),
        );
        const rung = ladderParts.find((part) => part.name === "bunk-ladder-rung");
        const rungSize = new Box3().setFromObject(rung).getSize(new Vector3());
        assert.ok(
          rungAxis === "x" ? rungSize.x > rungSize.z * 5 : rungSize.z > rungSize.x * 5,
          "ladder rungs must span across the selected bed side",
        );
        const bounds = new Box3().setFromObject(scene);
        const extents = bounds.getSize(new Vector3());
        definition.defaultSize.forEach((expected, axis) =>
          assert.ok(Math.abs(extents.getComponent(axis) - expected) < 0.001),
        );
        assert.ok(Math.abs(bounds.min.y) < 0.001, "bunk bed must remain grounded");
      } finally {
        await renderer.unmount();
      }
    }
  });
  test("folding chair tubes join floor pads to the seat and back at independent axis sizes", async () => {
    const definition = stableFurnishingRegistry["white-folding-chair"];
    for (const scale of [
      [1, 1, 1],
      [0.8, 1.3, 1.2],
    ]) {
      const renderer = await create(
        createElement(definition.component, {
          size: definition.defaultSize.map((value, axis) => value * scale[axis]),
        }),
      );
      try {
        const scene = renderer.scene.instance;
        scene.updateMatrixWorld(true);
        const supports = [],
          feet = [],
          tops = [];
        scene.traverse((object) => {
          if (object.name === "folding-chair-support") supports.push(object);
          if (object.name === "folding-chair-foot") feet.push(new Box3().setFromObject(object));
          if (["folding-chair-seat", "folding-chair-back-slat"].includes(object.name))
            tops.push(new Box3().setFromObject(object));
        });
        assert.equal(supports.length, 4);
        for (const support of supports) {
          const half = support.geometry.parameters.height / 2;
          const bottom = support.localToWorld(new Vector3(0, -half, 0));
          const top = support.localToWorld(new Vector3(0, half, 0));
          assert.ok(
            feet.some((bounds) => bounds.containsPoint(bottom)),
            "tube must meet a floor pad",
          );
          assert.ok(
            tops.some((bounds) => bounds.containsPoint(top)),
            "tube must meet the seat or back",
          );
        }
        const bounds = new Box3().setFromObject(scene);
        assert.ok(Math.abs(bounds.min.y) < 0.001, "chair must remain grounded");
      } finally {
        await renderer.unmount();
      }
    }
  });
});
