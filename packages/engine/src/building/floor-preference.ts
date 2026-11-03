/** A browser preference only; omitted keys keep fixtures and previews ephemeral. */
export function readFloorPreference(storageKey?: string): string {
  if (!storageKey) return "";
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

export function writeFloorPreference(storageKey: string | undefined, floorId: string): void {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, floorId);
  } catch {
    // Blocked or full storage must not prevent navigation.
  }
}
