import { Box3, Vector3, type BufferGeometry, type Mesh, type Object3D } from "three";
import { itemContactFootprints } from "./contact-footprints";
import {
  maxContactSpread,
  packItemContacts,
  projectItemContacts,
  type ContactPatch,
  type Footprints,
} from "./contact-geometry";
import { contactGap, createContactReceiverResolver } from "./contact-receivers";
import { contactReceiverGroup, floorContactSources, type ReceiverGroup } from "./contact-sources";

type ItemContacts = {
  root: Object3D;
  revision: string | undefined;
  receiver?: ReceiverGroup;
  footprints: Footprints;
  reach: Box3;
  patches: ContactPatch[];
};

/** A floor owns the CPU-side footprints and projections across Arrange edits. */
export class FloorContactBake {
  private readonly items = new Map<Object3D, ItemContacts>();
  private readonly ground = new Map<Mesh, { geometry: BufferGeometry; receiver: ReceiverGroup }>();
  private readonly changedModels = new Set<ItemContacts>();
  private readonly pendingProjections = new Set<ItemContacts>();
  private needsPublish = true;

  constructor(private readonly floor: Object3D) {}

  private invalidateSupports(bounds: Box3 | undefined) {
    if (!bounds || bounds.isEmpty() || this.pendingProjections.size === this.items.size) return;
    for (const item of this.items.values()) {
      if (bounds.intersectsBox(item.reach)) this.pendingProjections.add(item);
    }
  }

  *update(layout: ReadonlyMap<string, string>) {
    const sources = floorContactSources(this.floor);
    for (const [root, item] of this.items) {
      if (sources.items.has(root)) continue;
      this.items.delete(root);
      this.changedModels.delete(item);
      this.pendingProjections.delete(item);
      this.invalidateSupports(item.receiver?.bounds);
      this.needsPublish = true;
    }
    for (const [root, id] of sources.items) {
      const revision = layout.get(id);
      let item = this.items.get(root);
      if (item && item.revision === revision) continue;
      if (!item) {
        item = { root, revision, footprints: [], reach: new Box3(), patches: [] };
        this.items.set(root, item);
      }
      item.revision = revision;
      this.changedModels.add(item);
      this.pendingProjections.add(item);
      this.needsPublish = true;
    }
    for (const [mesh, { geometry, receiver }] of this.ground) {
      if (sources.ground.has(mesh) && mesh.geometry === geometry) continue;
      this.ground.delete(mesh);
      this.invalidateSupports(receiver.bounds);
      this.needsPublish = true;
    }
    for (const mesh of sources.ground) {
      if (this.ground.has(mesh)) continue;
      const receiver = contactReceiverGroup(this.floor, mesh, false);
      this.ground.set(mesh, { geometry: mesh.geometry, receiver });
      this.invalidateSupports(receiver.bounds);
      this.needsPublish = true;
      yield;
    }
    if (!this.needsPublish) return null;

    // Keep the queues across yields. A newer drag can supersede this iterator
    // before the next frame, including between a support move and its projections.
    for (const item of this.changedModels) {
      this.invalidateSupports(item.receiver?.bounds);
      item.receiver = contactReceiverGroup(this.floor, item.root, true);
      item.footprints =
        item.root.userData.itemContactCaster === true
          ? itemContactFootprints(item.root, this.floor)
          : [];
      item.reach.makeEmpty();
      const point = new Vector3();
      for (const { bottomY, polygon } of item.footprints)
        for (const [x, z] of polygon) item.reach.expandByPoint(point.set(x, bottomY, z));
      item.reach.expandByScalar(Math.max(maxContactSpread, contactGap));
      this.invalidateSupports(item.receiver.bounds);
      this.changedModels.delete(item);
      yield;
    }

    const groups = Array.from(this.ground.values(), (ground) => ground.receiver);
    for (const item of this.items.values()) if (item.receiver) groups.push(item.receiver);
    const resolve = createContactReceiverResolver(groups);
    for (const item of this.pendingProjections) {
      item.patches = projectItemContacts(item.root, item.footprints, resolve);
      this.pendingProjections.delete(item);
      yield;
    }
    this.needsPublish = false;
    return packItemContacts(Array.from(this.items.values(), (item) => item.patches));
  }
}
