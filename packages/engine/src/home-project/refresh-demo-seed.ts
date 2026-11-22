import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { serializeHomeProject } from "./serialization";
import { PROJECT_STORE, STATE_STORE } from "./project-database";
import { createSeedProjectRecord, serializeHomeProjectRecord } from "./project-record-codec";
import type { HomeProjectRecord } from "./project-record-contract";
import type { HomeProject } from "./types";

function isOriginalDemo(record: HomeProjectRecord, publishedDigest?: string | null) {
  if (record.revision === 0) return true;
  if (!publishedDigest || Object.keys(record.bindings).length) return false;
  const published = serializeHomeProject(record.published);
  return (
    serializeHomeProject(record.draft) === published &&
    bytesToHex(sha256(new TextEncoder().encode(published))) === publishedDigest
  );
}

export function refreshDemoSeed(
  tx: IDBTransaction,
  request: <R>(pending: IDBRequest<R>, onSuccess: (value: R) => void) => void,
  seed: HomeProject,
  previousDemoSeeds: Readonly<Record<string, string | null>>,
  parse: (raw: unknown) => HomeProjectRecord,
) {
  const state = tx.objectStore(STATE_STORE);
  const key = `demo-seed-checked:${seed.seedRevision}`;
  request(state.get(key), (checked) => {
    if (checked) return;
    const records = tx.objectStore(PROJECT_STORE);
    request(records.get(seed.home.id), (raw) => {
      let record: HomeProjectRecord;
      try {
        record = parse(raw);
      } catch {
        return;
      }
      if (
        record.homeId === seed.home.id &&
        Object.hasOwn(previousDemoSeeds, record.seedRevision) &&
        isOriginalDemo(record, previousDemoSeeds[record.seedRevision])
      ) {
        const updated = createSeedProjectRecord(seed);
        updated.revision = record.revision + 1;
        records.put(serializeHomeProjectRecord(updated), seed.home.id);
      }
      state.put(true, key);
    });
  });
}
