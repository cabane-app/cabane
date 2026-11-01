/** Optional read-only attachments are separate from primary state and commands. */
export const isAuxiliaryEntitySlot = (slot: {
  deviceRole?: unknown;
  required?: unknown;
  autoMap?: unknown;
  compatibleDomains?: unknown;
}) =>
  slot.deviceRole === "secondary" &&
  slot.required === false &&
  slot.autoMap === "manual" &&
  Array.isArray(slot.compatibleDomains) &&
  slot.compatibleDomains.length > 0 &&
  slot.compatibleDomains.every(
    (domain: unknown) => domain === "sensor" || domain === "binary_sensor",
  );
