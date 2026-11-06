import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { withModules } from "./test-server.mjs";

test("workspace repository uses atomic IndexedDB operations and never reseeds deleted homes", async () => {
  const indexedDB = new IDBFactory();
  await withModules(async (load) => {
    const result = await (async () => {
      const api = await load("/packages/engine/src/home-project/index.ts");
      const registries = { furnishingModels: {}, deviceModels: {} };
      const repository = api.createWorkspaceRepository(indexedDB, registries);
      const seed = api.defineHomeProject({
        schemaVersion: 1,
        seedRevision: "fixture-v1",
        home: {
          id: "fixture-home",
          name: "Fixture home",
          locale: "en",
          palette: {
            accent: "#d48a54",
            secondary: "#758f83",
            exterior: "#c97370",
            interior: "#e4e0d8",
            ground: "#91a06a",
          },
        },
        floor: {
          id: "ground-floor",
          name: "Ground floor",
          coordinates: {
            origin: [0, 0],
            metersPerPlanUnit: 1,
            scaleBasis: "measured",
          },
          defaultWallHeightMeters: 2.4,
          defaultCeilingHeightMeters: 2.4,
          footprint: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
          ],
          rooms: [
            {
              id: "room",
              name: "Room",
              polygon: [
                [0.12, 0.12],
                [3.88, 0.12],
                [3.88, 2.88],
                [0.12, 2.88],
              ],
              accent: "#c98164",
              dashboardSlots: [],
              devices: [],
            },
          ],
          walls: [
            {
              id: "north",
              from: [0, 0],
              to: [4, 0],
              classification: "exterior",
              thicknessMeters: 0.18,
            },
            {
              id: "east",
              from: [4, 0],
              to: [4, 3],
              classification: "exterior",
              thicknessMeters: 0.18,
            },
            {
              id: "south",
              from: [4, 3],
              to: [0, 3],
              classification: "exterior",
              thicknessMeters: 0.18,
            },
            {
              id: "west",
              from: [0, 3],
              to: [0, 0],
              classification: "exterior",
              thicknessMeters: 0.18,
            },
          ],
          wallJunctions: [
            { id: "north-west", at: [0, 0], wallIds: ["north", "west"] },
            { id: "north-east", at: [4, 0], wallIds: ["north", "east"] },
            { id: "south-east", at: [4, 3], wallIds: ["east", "south"] },
            { id: "south-west", at: [0, 3], wallIds: ["south", "west"] },
          ],
          openings: [],
          ceilings: [
            {
              id: "room-ceiling",
              kind: "flat",
              roomIds: ["room"],
              heightMeters: 2.4,
            },
          ],
        },
        sceneItems: [],
        roomProfiles: { room: { dashboardSlots: [] } },
        openingProfiles: {},
        shortcuts: [],
        assumptions: [],
      });
      const checks = [];
      const check = (condition, message) => {
        if (!condition) throw new Error(message);
        checks.push(message);
      };
      const rejects = async (operation, message) => {
        let rejected = false;
        try {
          await operation();
        } catch {
          rejected = true;
        }
        check(rejected, message);
      };
      await Promise.all([repository.initialize(seed), repository.initialize(seed)]);
      check((await repository.list()).length === 1, "concurrent initialization seeds once");
      const seeded = await repository.read(seed.home.id);
      check(Boolean(seeded.record), "initialized demo is readable");
      const progress = await repository.readOnboarding();
      check(
        progress.demoWorkspaceId === seed.home.id && !progress.welcomeDismissed,
        "fresh installation owns an explicit demo role",
      );
      await rejects(
        () =>
          repository.setConnection(seed.home.id, seeded.record.revision, "https://fixture.test"),
        "demo cannot connect to real HA",
      );
      const [personal, resumed] = await Promise.all([
        repository.startOnboarding("connect"),
        repository.startOnboarding("connect"),
      ]);
      check(personal.metadata.id === resumed.metadata.id, "concurrent onboarding resumes one home");
      check(
        personal.metadata.id !== seed.home.id && personal.metadata.homeAssistantUrl === null,
        "personal copy has new identity and no connection",
      );
      check(Object.keys(personal.record.bindings).length === 0, "personal copy has no mappings");
      check(
        JSON.stringify(personal.record.draft) === JSON.stringify(personal.record.published),
        "personal copy starts from applied content",
      );
      check(
        (await api.createWorkspaceRepository(indexedDB, registries).startOnboarding("connect"))
          .metadata.id === personal.metadata.id,
        "onboarding destination survives repository reopen",
      );
      await repository.delete(personal.metadata.id, await repository.readRaw(personal.metadata.id));
      await rejects(
        () => repository.startOnboarding("connect"),
        "deleted destination does not silently reappear",
      );
      const replacement = await repository.startOnboarding("connect", {
        replaceDeletedId: personal.metadata.id,
      });
      check(
        replacement.metadata.id !== personal.metadata.id,
        "explicit replacement allocates a new identity",
      );
      const built = await repository.startOnboarding("build");
      check(
        built.record.publishedAt === 0 && built.metadata.id !== replacement.metadata.id,
        "build creates a separate blank draft",
      );
      await repository.delete(
        replacement.metadata.id,
        await repository.readRaw(replacement.metadata.id),
      );
      await repository.delete(built.metadata.id, await repository.readRaw(built.metadata.id));
      await repository.delete(seed.home.id, await repository.readRaw(seed.home.id));
      await repository.initialize(seed);
      check((await repository.list()).length === 0, "deleting the demo never reseeds");

      let blank = await repository.createBlank("  Empty home  ");
      const id = blank.metadata.id;
      check(
        !blank.metadata.hasPublished && blank.record.publishedAt === 0,
        "blank home remains unapplied",
      );
      check(blank.record.draft.floors[0].footprint.length === 0, "blank architecture round trips");
      check(blank.metadata.name === "Empty home", "names are trimmed");
      blank = await repository.setConnection(
        id,
        blank.record.revision,
        "https://fixture.test/path",
      );
      check(blank.metadata.homeAssistantUrl === "https://fixture.test", "connection is normalized");
      const staleRevision = blank.record.revision;
      blank = await repository.rename(id, staleRevision, "Renamed");
      check(
        blank.record.draft.home.name === "Renamed" &&
          blank.record.published.home.name === "Renamed",
        "rename updates both names",
      );
      check(!blank.metadata.hasPublished, "rename never applies a draft");
      await rejects(() => repository.rename(id, staleRevision, "Stale"), "stale rename rejects");
      await rejects(
        () => repository.duplicate(id, staleRevision, "Stale copy"),
        "stale duplicate rejects",
      );
      const copy = await repository.duplicate(id, blank.record.revision, "Copy");
      check(
        copy.metadata.id !== id && copy.record.revision === 0,
        "duplicate has independent identity and revision",
      );
      check(
        copy.metadata.homeAssistantUrl === "https://fixture.test",
        "duplicate retains connection",
      );
      await repository.setConnection(copy.metadata.id, copy.record.revision, "https://other.test");
      check(
        (await repository.read(id)).metadata.homeAssistantUrl === "https://fixture.test",
        "copy connection changes are isolated",
      );

      const mappedRecord = api.createSeedProjectRecord(seed);
      mappedRecord.bindings = {
        "https://fixture.test": {
          draft: {
            schemaVersion: 1,
            homeId: seed.home.id,
            roomAreaIds: { room: "fixture-area" },
            entityIdsBySlotId: {},
          },
          published: {
            schemaVersion: 1,
            homeId: seed.home.id,
            roomAreaIds: {},
            entityIdsBySlotId: {},
          },
          manualRoomIds: ["room"],
          manualSlotIds: [],
        },
      };
      const mapped = await repository.create(mappedRecord, {
        name: "Mapped",
        homeAssistantUrl: "https://fixture.test",
      });
      const mappedCopy = await repository.duplicate(
        mapped.metadata.id,
        mapped.record.revision,
        "Mapped copy",
      );
      check(
        mappedCopy.record.bindings["https://fixture.test"].draft.homeId === mappedCopy.metadata.id,
        "duplicate rewrites binding profile identity",
      );
      check(
        mappedCopy.record.bindings["https://fixture.test"].draft.roomAreaIds.room ===
          "fixture-area",
        "duplicate retains private mappings",
      );
      check(
        Object.keys(mappedCopy.record.bindings["https://fixture.test"].published.roomAreaIds)
          .length === 0,
        "duplicate preserves unpublished mapping boundary",
      );
      await repository.delete(mapped.metadata.id, await repository.readRaw(mapped.metadata.id));
      await repository.delete(
        mappedCopy.metadata.id,
        await repository.readRaw(mappedCopy.metadata.id),
      );

      const countBeforeCreateFailure = (await repository.list()).length;
      const originalAdd = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === "workspaces")
          throw new DOMException("Fixture creation failure", "QuotaExceededError");
        return originalAdd.apply(this, args);
      };
      try {
        await rejects(
          () => repository.createBlank("Failed creation"),
          "create rejects metadata write failure",
        );
      } finally {
        IDBObjectStore.prototype.add = originalAdd;
      }
      check(
        (await repository.list()).length === countBeforeCreateFailure,
        "failed creation leaves no library card",
      );
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("cabane-projects-v2");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rawCount = await new Promise((resolve, reject) => {
        const request = db.transaction("home-projects").objectStore("home-projects").count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      check(
        rawCount === countBeforeCreateFailure,
        "failed creation leaves no orphan project record",
      );

      const beforeRollback = await repository.readRaw(id);
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "workspaces")
          throw new DOMException("Fixture metadata write failure", "QuotaExceededError");
        return originalPut.apply(this, args);
      };
      try {
        await rejects(
          () => repository.rename(id, blank.record.revision, "Must roll back"),
          "metadata failure rejects",
        );
      } finally {
        IDBObjectStore.prototype.put = originalPut;
      }
      check(
        (await repository.readRaw(id)) === beforeRollback,
        "metadata failure rolls back the earlier project write",
      );
      check(
        (await repository.read(id)).metadata.name === "Renamed",
        "metadata remains unchanged after abort",
      );

      const recordStore = api.createIndexedDbProjectRecordStore(indexedDB);
      await repository.delete(id, beforeRollback);
      check(
        (await recordStore.compareAndSwap(id, beforeRollback, beforeRollback)) === false,
        "stale save cannot recreate deleted record",
      );
      await rejects(
        () => repository.rename(id, blank.record.revision, "Resurrect"),
        "stale metadata mutation cannot recreate deleted home",
      );
      const remaining = (await repository.list())[0];
      await repository.delete(
        remaining.metadata.id,
        await repository.readRaw(remaining.metadata.id),
      );
      await repository.initialize(seed);
      check(
        (await repository.list()).length === 0,
        "deleting the final home leaves an empty library",
      );

      const applyTarget = await repository.createBlank("Ready to build");
      const projectRepository = api.createHomeProjectRepository(recordStore, registries);
      const readyDraft = structuredClone(seed);
      readyDraft.seedRevision = applyTarget.record.seedRevision;
      readyDraft.home = { ...readyDraft.home, id: applyTarget.metadata.id, name: "Ready to build" };
      const saved = await api.autosaveHomeProjectDraft(
        projectRepository,
        applyTarget.record,
        readyDraft,
      );
      check(
        saved.status === "saved",
        "valid draft saves into unapplied workspace: " + JSON.stringify(saved),
      );
      check(
        !(await repository.read(applyTarget.metadata.id)).metadata.hasPublished,
        "autosave never marks workspace applied",
      );
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "workspaces")
          throw new DOMException("Fixture Apply metadata failure", "QuotaExceededError");
        return originalPut.apply(this, args);
      };
      let failedApply;
      try {
        failedApply = await api.publishHomeProject(projectRepository, saved.record);
      } finally {
        IDBObjectStore.prototype.put = originalPut;
      }
      check(failedApply.status !== "published", "Apply metadata failure is reported");
      check(
        !(await repository.read(applyTarget.metadata.id)).metadata.hasPublished,
        "failed Apply never publishes metadata",
      );
      const applied = await api.publishHomeProject(projectRepository, saved.record);
      check(applied.status === "published", "valid draft applies");
      const persistedApply = await repository.read(applyTarget.metadata.id);
      check(
        persistedApply.metadata.hasPublished && persistedApply.record.publishedAt !== 0,
        "Apply persists record and metadata together",
      );

      // A second browser-origin database fixture exercises in-place adoption and corruption.
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("cabane-projects-v2");
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
      const adopted = api.createSeedProjectRecord(seed);
      adopted.draft.home.name = "Existing draft";
      adopted.revision = 7;
      await recordStore.write(seed.home.id, api.serializeHomeProjectRecord(adopted));
      await recordStore.write("damaged", "{broken");
      await repository.initialize(seed);
      const entries = await repository.list();
      check(entries.length === 2, "existing records are adopted without another demo");
      const healthy = entries.find((item) => item.metadata.id === seed.home.id);
      check(
        healthy.record.revision === 7 && healthy.record.draft.home.name === "Existing draft",
        "adoption preserves draft and revision",
      );
      check(healthy.metadata.homeAssistantUrl === null, "adoption begins disconnected");
      check(
        Boolean(entries.find((item) => item.metadata.id === "damaged").error),
        "corruption is isolated to a recovery entry",
      );
      check(
        (await repository.readRaw("damaged")) === "{broken",
        "corrupt source remains available",
      );
      const recoveryDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("cabane-projects-v2");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = recoveryDb.transaction(["home-projects", "workspaces"], "readwrite");
        const metadata = tx.objectStore("workspaces");
        metadata.put(null, "bad-settings");
        metadata.put({ ...healthy.metadata, id: "missing-record" }, "missing-record");
        metadata.put({ ...healthy.metadata, id: "wrong-identity" }, "wrong-identity");
        tx.objectStore("home-projects").put(
          api.serializeHomeProjectRecord(adopted),
          "wrong-identity",
        );
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
      recoveryDb.close();
      const recoveryEntries = await repository.list();
      check(
        Boolean(recoveryEntries.find((item) => item.metadata.id === seed.home.id).record),
        "malformed metadata does not hide healthy workspaces",
      );
      const malformed = recoveryEntries.find((item) => item.metadata.id === "bad-settings");
      check(
        Boolean(malformed.error) && !malformed.record,
        "malformed metadata becomes a recovery entry",
      );
      check(
        (await repository.read("bad-settings")).metadata.id === "bad-settings",
        "read uses storage identity for damaged metadata",
      );
      check(
        Boolean((await repository.read("wrong-identity")).error),
        "mismatched project identity becomes a recovery error",
      );
      check(
        Boolean((await repository.read("missing-record")).error),
        "missing raw record becomes a recovery error",
      );
      await repository.delete("missing-record", null);
      check(
        (await repository.read("missing-record")) === null,
        "confirmed missing-record deletion removes the recovery card",
      );
      await repository.delete("bad-settings", null);
      check(
        (await repository.read("bad-settings")) === null,
        "damaged metadata with no record can be deleted",
      );
      await rejects(
        () => repository.delete("wrong-identity", null),
        "missing-record delete cannot remove a newly present record",
      );
      return checks;
    })();
    assert.ok(result.length >= 20);
  });
});
