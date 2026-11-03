import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { withStorageDom } from "./dom-test-environment.mjs";
import { withModules } from "./test-server.mjs";
await withModules(async (load) => {
  const { reconcileFloorSelection, adjacentFloorId, visibleFloorIds } = await load(
    "/packages/engine/src/building/index.ts",
  );
  const { FloorNavigationProvider, useFloorNavigation, FloorPicker } = await load(
    "/packages/engine/src/building/index.ts",
  );
  const floors = [
    { id: "cellar", name: "Cellar", belowGround: true },
    { id: "ground", name: "Ground" },
    { id: "upper", name: "Upper" },
  ];
  const key = (workspace) => `cabane:selected-floor:${workspace}`;
  function Navigation({ available = floors }) {
    const navigation = useFloorNavigation(available);
    return createElement(
      "div",
      null,
      createElement("output", null, navigation.activeFloorId),
      createElement(FloorPicker, {
        floors: available,
        selectedId: navigation.activeFloorId,
        onSelect: (id) => navigation.selectFloor(id, "picker"),
      }),
      ...["walk", "target"].map((source) =>
        createElement(
          "button",
          {
            key: source,
            onClick: () => navigation.selectFloor("cellar", source),
          },
          source,
        ),
      ),
      createElement("button", { onClick: () => navigation.selectFloor("ground") }, "Locate"),
    );
  }
  const mountNavigation = async (dom) => {
    const container = dom.document.createElement("div");
    dom.document.body.append(container);
    const root = createRoot(container);
    return {
      root,
      selected: () => container.querySelector("output").textContent,
      async render(workspace, available = floors) {
        await act(async () =>
          root.render(
            createElement(
              FloorNavigationProvider,
              { key: workspace, storageKey: key(workspace) },
              createElement(Navigation, { available }),
            ),
          ),
        );
      },
      unmount: () => root.unmount(),
    };
  };
  const choose = async (dom, name) =>
    act(async () => dom.document.querySelector(`button[aria-label="${name}"]`).click());
  test("remembers explicit floor picks per workspace and reconciles removed floors without writing", () =>
    withStorageDom(async (dom) => {
      let navigation = await dom.mount(mountNavigation, dom);
      await navigation.render("a");
      assert.equal(navigation.selected(), "ground");
      assert.equal(dom.window.localStorage.length, 0);
      await choose(dom, "Upper");
      assert.equal(dom.window.localStorage.getItem(key("a")), "upper");
      for (const source of ["walk", "target", "Locate"]) {
        await dom.click(source);
        assert.equal(dom.window.localStorage.getItem(key("a")), "upper");
      }
      await act(async () => navigation.root.unmount());
      navigation = await dom.mount(mountNavigation, dom);
      await navigation.render("a");
      assert.equal(navigation.selected(), "upper");
      await navigation.render("b");
      assert.equal(navigation.selected(), "ground");
      await choose(dom, "Cellar");
      await navigation.render("a");
      assert.equal(navigation.selected(), "upper");
      await navigation.render("a", floors.slice(0, 2));
      assert.equal(navigation.selected(), "ground");
      assert.equal(dom.window.localStorage.getItem(key("a")), "upper");
      await navigation.render("b");
      assert.equal(navigation.selected(), "cellar");
      await navigation.render("a", floors.slice(0, 2));
      assert.equal(
        navigation.selected(),
        "ground",
        "deleted preference uses the usual starting floor",
      );
      await navigation.render("a", [...floors.slice(0, 2), { id: "new", name: "New" }]);
      await choose(dom, "New");
      assert.equal(navigation.selected(), "new", "new floors remain selectable");
    }));
  test("unknown stored values and blocked reads or writes leave navigation usable", () =>
    withStorageDom(async (dom) => {
      const navigation = await dom.mount(mountNavigation, dom);
      for (const raw of ["", "{broken", '"upper"', "removed"]) {
        dom.window.localStorage.setItem(key(raw), raw);
        await navigation.render(raw);
        assert.equal(navigation.selected(), "ground");
        assert.equal(dom.window.localStorage.getItem(key(raw)), raw);
      }
      Object.defineProperty(dom.window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("Storage blocked");
        },
      });
      await navigation.render("blocked");
      assert.equal(navigation.selected(), "ground");
      await choose(dom, "Upper");
      assert.equal(navigation.selected(), "upper");
      Object.defineProperty(dom.window, "localStorage", {
        value: {
          getItem: () => "upper",
          setItem() {
            throw new Error("Quota exceeded");
          },
        },
      });
      await navigation.render("read-only");
      assert.equal(navigation.selected(), "upper");
      await choose(dom, "Cellar");
      assert.equal(navigation.selected(), "cellar");
    }));
  test("nested previews and standalone fixtures never read or write a workspace preference", () =>
    withStorageDom(async (dom) => {
      const navigation = await dom.mount(mountNavigation, dom);
      dom.window.localStorage.setItem(key("a"), "upper");
      await act(async () =>
        navigation.root.render(
          createElement(
            FloorNavigationProvider,
            { storageKey: key("a") },
            createElement(
              FloorNavigationProvider,
              { initialFloorId: "ground" },
              createElement(Navigation),
            ),
          ),
        ),
      );
      assert.equal(navigation.selected(), "ground");
      await choose(dom, "Cellar");
      assert.equal(navigation.selected(), "cellar");
      assert.equal(dom.window.localStorage.getItem(key("a")), "upper");
      await act(async () => navigation.root.render(createElement(Navigation)));
      assert.equal(navigation.selected(), "ground");
      await choose(dom, "Cellar");
      assert.equal(navigation.selected(), "cellar");
      assert.equal(dom.window.localStorage.length, 1);
      assert.equal(dom.window.localStorage.getItem(key("a")), "upper");
    }));
  test("starts on ground, retains existing selection, and falls back below a removed floor", () => {
    const order = ["ground", "first", "second"];
    assert.equal(
      reconcileFloorSelection({ activeFloorId: "", wholeBuilding: false }, order, order)
        .activeFloorId,
      "ground",
    );
    assert.equal(
      reconcileFloorSelection(
        { activeFloorId: "second", wholeBuilding: false },
        order,
        order.slice(0, 2),
      ).activeFloorId,
      "first",
    );
    assert.equal(adjacentFloorId(order, "ground", -1), null);
    assert.deepEqual(visibleFloorIds(order, "first", "plan"), ["first"]);
    assert.deepEqual(visibleFloorIds(order, "first", "cutaway"), ["ground", "first"]);
    assert.deepEqual(visibleFloorIds(order, "first", "whole"), order);
  });
});
