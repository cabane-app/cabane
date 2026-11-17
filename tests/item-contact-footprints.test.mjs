import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { create } from "@react-three/test-renderer";
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  RingGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { withModules } from "./test-server.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const wood = new MeshBasicMaterial();
const box = (x, y, z, width, height, depth) =>
  new BoxGeometry(width, height, depth).translate(x, y, z);
const area = (polygon) =>
  Math.abs(
    polygon.reduce((sum, p, i) => {
      const next = polygon[(i + 1) % polygon.length];
      return sum + p[0] * next[1] - p[1] * next[0];
    }, 0) / 2,
  );
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} ≠ ${expected}`);

await withModules(async (load) => {
  const { itemContactFootprints } = await load(
    "/packages/engine/src/item-contacts/contact-footprints.ts",
  );
  const { FloorContactBake } = await load(
    "/packages/engine/src/item-contacts/floor-contact-bake.ts",
  );

  const { ItemContactShadows } = await load(
    "/packages/engine/src/item-contacts/ItemContactShadows.tsx",
  );

  test("Arrange displays the last complete contact mesh until its replacement is ready", async () => {
    const floor = { id: "main" };
    const view = (x) =>
      h(
        "group",
        null,
        h(
          "mesh",
          { name: "room-main", position: [0, -0.1, 0] },
          h("boxGeometry", { args: [4, 0.2, 4] }),
          h("meshBasicMaterial"),
        ),
        h(
          "mesh",
          {
            name: "scene-item-stool",
            userData: { itemContactCaster: true },
            position: [x, 0.1, 0],
          },
          h("boxGeometry", { args: [0.2, 0.2, 0.2] }),
          h("meshBasicMaterial"),
        ),
        h(ItemContactShadows, {
          floor,
          items: [{ id: "stool", placement: { kind: "absolute", at: [x, 0] } }],
        }),
      );
    const renderer = await create(view(0));
    const mesh = renderer.scene.instance.getObjectByName("item-contact-shadows");
    const released = [];
    function trackResources() {
      const pair = [mesh.geometry, mesh.material.uniforms.outlines.value];
      for (const resource of pair)
        resource.addEventListener("dispose", () => released.push(resource));
      return pair;
    }
    let current;
    try {
      await renderer.advanceFrames(12, 1 / 60);
      assert.ok(mesh.visible && mesh.geometry.attributes.position.count);
      const previous = trackResources();
      await renderer.update(view(1));
      assert.ok(mesh.visible);
      assert.equal(mesh.geometry, previous[0]);
      assert.equal(mesh.material.uniforms.outlines.value, previous[1]);
      assert.equal(released.length, 0);
      await renderer.advanceFrames(12, 1 / 60);
      current = trackResources();
      assert.notEqual(current[0], previous[0]);
      assert.notEqual(current[1], previous[1]);
      assert.deepEqual(released, previous);
    } finally {
      await renderer.unmount();
    }
    assert.deepEqual(released.slice(2), current);
  });

  test("Arrange reprojects resting objects at both ends of a support move and reuses distant feet", () => {
    const floor = new Group();
    const ground = new Mesh(box(0, -0.1, 0, 24, 0.2, 4), wood);
    ground.name = "room-main";
    floor.add(ground);
    const layout = new Map();
    function furniture(id, x, y, width, height) {
      const root = new Group();
      root.name = `scene-item-${id}`;
      root.userData.itemContactCaster = true;
      root.position.set(x, y, 0);
      root.add(new Mesh(box(0, height / 2, 0, width, height, width), wood));
      floor.add(root);
      layout.set(id, "original");
      return root;
    }
    const table = furniture("table", 0, 0, 1, 0.75);
    furniture("left-candle", 0.2, 0.75, 0.08, 0.16);
    furniture("right-candle", 3.2, 0.75, 0.08, 0.16);
    const chair = furniture("chair", 9, 0, 0.3, 0.5);
    const bake = new FloorContactBake(floor);
    function finish() {
      const work = bake.update(layout);
      let part = work.next();
      while (!part.done) part = work.next();
      if (!part.value) return null;
      const { geometry, texture } = part.value;
      const positions = geometry.attributes.position;
      const tabletop = [],
        distant = [];
      for (let i = 0; i < positions.count; i++) {
        if (positions.getY(i) > 0.7) tabletop.push(positions.getX(i));
        else if (positions.getX(i) > 8) distant.push(positions.getX(i));
      }
      geometry.dispose();
      texture.dispose();
      return { tabletop, distant };
    }
    const original = finish();
    assert.ok(original.tabletop.length > 0 && original.tabletop.every((x) => x < 0.5));
    assert.ok(original.distant.length > 0);
    const chairVertices = chair.children[0].geometry.attributes.position;
    chairVertices.getX = () => assert.fail("an unrelated Arrange edit resampled the chair");
    table.position.x = 2;
    layout.set("table", "mid-drag");
    assert.equal(bake.update(layout).next().done, false);
    table.position.x = 3;
    layout.set("table", "end-drag");
    const moved = finish();
    assert.ok(moved.tabletop.length > 0 && moved.tabletop.every((x) => x > 3 && x < 3.5));
    assert.deepEqual(moved.distant, original.distant);
    floor.remove(table);
    layout.delete("table");
    assert.deepEqual(finish(), { tabletop: [], distant: original.distant });
    table.position.x = 0;
    floor.add(table);
    layout.set("table", "restored");
    assert.deepEqual(finish(), original);
    assert.equal(finish(), null, "no GPU resources for an unchanged layout");
    table.scale.x = 0.1;
    layout.set("table", "narrower");
    assert.deepEqual(finish(), { tabletop: [], distant: original.distant });
    ground.geometry = box(0, -0.6, 0, 24, 0.2, 4);
    assert.deepEqual(finish(), { tabletop: [], distant: [] }, "replaced ground geometry");
  });

  test("one imported console mesh keeps four real feet through floor and model transforms", () => {
    const floor = new Group();
    floor.position.set(-3, 6, 12);
    floor.rotation.set(0.16, 0.7, -0.2);
    const item = new Group();
    item.rotation.y = Math.PI / 3;
    item.position.set(2, 0.82, -4);
    item.scale.set(1.4, 0.75, 0.8);
    floor.add(item);
    const offsets = [
      [-0.4, -0.2],
      [0.4, -0.2],
      [0.4, 0.2],
      [-0.4, 0.2],
    ];
    const mesh = new Mesh(
      mergeGeometries([
        box(0, 0.77, 0, 1, 0.06, 0.5),
        ...offsets.map(([x, z]) => box(x, 0.37, z, 0.05, 0.74, 0.07)),
      ]).toNonIndexed(),
      wood,
    );
    item.add(mesh);
    const patches = itemContactFootprints(item, floor);
    assert.equal(patches.length, 4);
    for (const [x, z] of offsets) {
      const center = new Vector3(x, 0, z).applyMatrix4(item.matrix);
      const patch = patches.find(({ polygon }) => {
        const cx = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
        const cz = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
        return Math.hypot(cx - center.x, cz - center.z) < 1e-5;
      });
      assert.ok(patch);
      near(patch.bottomY, 0.82);
      near(area(patch.polygon), 0.05 * 0.07 * 1.4 * 0.8);
    }
    item.position.y += 0.41;
    for (const patch of itemContactFootprints(item, floor)) near(patch.bottomY, 1.23);
  });

  test("the round base of an elevated candle excludes its wick, glow and helper meshes", () => {
    const floor = new Group();
    const candle = new Group();
    floor.add(candle);
    candle.position.y = 1.05;
    const body = new Mesh(new CylinderGeometry(0.06, 0.06, 0.17, 24).translate(0, 0.085, 0), wood);
    const sleeve = new Mesh(
      new CylinderGeometry(0.062, 0.062, 0.04, 20).translate(0, 0.023, 0),
      wood,
    );
    const wick = new Mesh(box(0, 0.175, 0, 0.004, 0.01, 0.004), wood);
    const glass = new Mesh(
      box(0, -0.02, 0, 0.4, 0.1, 0.4),
      new MeshPhysicalMaterial({ transmission: 1 }),
    );
    const glow = new Mesh(
      glass.geometry,
      new MeshBasicMaterial({ transparent: true, opacity: 0.3 }),
    );
    const helper = new Mesh(glass.geometry, new MeshBasicMaterial({ wireframe: true }));
    const hidden = new Group();
    hidden.visible = false;
    hidden.add(new Mesh(glass.geometry, wood));
    candle.add(
      body,
      wick,
      sleeve,
      glass,
      glow,
      helper,
      hidden,
      new InstancedMesh(glass.geometry, wood, 12),
    );
    const patches = itemContactFootprints(candle, floor);
    assert.equal(patches.length, 1);
    near(patches[0].bottomY, 1.05);
    assert.equal(patches[0].polygon.length, 24);
    for (const [x, z] of patches[0].polygon) near(Math.hypot(x, z), 0.06);
  });

  test("respects drawn material groups and refuses hollow, animated or over-budget geometry", () => {
    const floor = new Group();
    const item = new Group();
    floor.add(item);
    const invisible = new MeshBasicMaterial({ visible: false });
    const mesh = new Mesh(
      mergeGeometries([box(0, 0.2, 0, 1, 0.4, 0.5), box(0, -0.2, 0, 2, 0.4, 2)], true),
      [wood, invisible],
    );
    item.add(mesh);
    const [solid] = itemContactFootprints(item, floor);
    near(solid.bottomY, 0);
    near(area(solid.polygon), 0.5);
    mesh.geometry.setDrawRange(36, 36);
    assert.deepEqual(itemContactFootprints(item, floor), []);
    item.remove(mesh);
    const ring = new Mesh(new RingGeometry(0.3, 0.4, 32).rotateX(Math.PI / 2), wood);
    item.add(ring);
    assert.deepEqual(itemContactFootprints(item, floor), []);
    item.remove(ring);
    const dense = new BufferGeometry();
    const vertices = new Float32BufferAttribute(new Float32Array(160_000 * 3), 3);
    vertices.getX = () => assert.fail("dense buffer must not be scanned");
    dense.setAttribute("position", vertices);
    item.add(new Mesh(dense, wood));
    assert.deepEqual(itemContactFootprints(item, floor), []);
    item.clear().add(new Mesh(box(0, 0.2, 0, 1, 0.4, 0.5), wood));
    item.animations.push({});
    assert.deepEqual(itemContactFootprints(item, floor), []);
  });
});
