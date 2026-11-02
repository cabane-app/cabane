import {
  createModelAssetRepository,
  createCabaneArchive,
  documentModelReferences,
  downloadCabaneBytes,
} from "@cabane/engine";

/** Complete workspace files include verified GLBs, including staged draft imports. */
export async function downloadWorkspaceArchive(json: string, filename: string): Promise<void> {
  const references = documentModelReferences(json);
  const assets = references.length
    ? await createModelAssetRepository(window.indexedDB).verify(references)
    : [];
  downloadCabaneBytes(createCabaneArchive(json, assets), filename, "application/zip");
}
