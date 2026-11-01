import { isAuxiliaryEntitySlot } from "../entity-slot-roles";
import { roomsForFloor } from "../outdoor-platforms/platform-rooms";
import type { DeviceModelDefinition, EntityBindingSlotSpec } from "../types";
import type { DeviceItemSpec, HomeProject } from "./types";
import { addProjectIssue, type HomeProjectIssue } from "./validation-types";

const validateEntitySlotSemantics = (
  slot: EntityBindingSlotSpec,
  path: string,
  issues: HomeProjectIssue[],
) => {
  if (slot.compatibleDomains.length === 0) {
    addProjectIssue(
      issues,
      "project.slot-domains-empty",
      `${path}.compatibleDomains`,
      "A binding slot requires at least one compatible domain.",
    );
  }
  if (new Set(slot.compatibleDomains).size !== slot.compatibleDomains.length) {
    addProjectIssue(
      issues,
      "project.slot-domain-duplicate",
      `${path}.compatibleDomains`,
      "Compatible slot domains must be unique.",
    );
  }
};

export const validateProfileReferencesAndSlots = (
  project: HomeProject,
  issues: HomeProjectIssue[],
) => {
  const roomIds = new Set(project.floors.flatMap(roomsForFloor).map((room) => room.id));
  for (const [roomId, profile] of Object.entries(project.roomProfiles)) {
    if (!roomIds.has(roomId)) {
      addProjectIssue(
        issues,
        "project.room-profile-missing",
        `roomProfiles.${roomId}`,
        `Room “${roomId}” does not exist.`,
      );
    }
    profile.dashboardSlots.forEach((slot, index) =>
      validateEntitySlotSemantics(slot, `roomProfiles.${roomId}.dashboardSlots[${index}]`, issues),
    );
  }

  const openings = new Map(
    project.floors.flatMap((floor) => floor.openings).map((opening) => [opening.id, opening]),
  );
  for (const [openingId, profile] of Object.entries(project.openingProfiles)) {
    const opening = openings.get(openingId);
    if (!opening) {
      addProjectIssue(
        issues,
        "project.opening-profile-missing",
        `openingProfiles.${openingId}`,
        `Opening “${openingId}” does not exist.`,
      );
    } else if (opening.kind === "passage" && profile.contactSlot) {
      addProjectIssue(
        issues,
        "project.passage-contact",
        `openingProfiles.${openingId}.contactSlot`,
        "Passages cannot have an opening contact slot.",
      );
    }
    if (profile.coverSlot && (opening?.kind !== "door" || opening.operation !== "roll-up")) {
      addProjectIssue(
        issues,
        "project.opening-cover",
        `openingProfiles.${openingId}.coverSlot`,
        "Only roll-up doors support a cover slot.",
      );
    }
    if (profile.contactSlot?.compatibleDeviceClasses.length === 0) {
      addProjectIssue(
        issues,
        "project.contact-classes-empty",
        `openingProfiles.${openingId}.contactSlot.compatibleDeviceClasses`,
        "An opening contact requires at least one compatible device class.",
      );
    }
  }

  project.sceneItems.forEach((item, itemIndex) => {
    if (item.kind !== "device") {
      (item.entitySlots ?? []).forEach((slot, slotIndex) => {
        const path = `sceneItems[${itemIndex}].entitySlots[${slotIndex}]`;
        validateEntitySlotSemantics(slot, path, issues);
        if (!isAuxiliaryEntitySlot(slot))
          addProjectIssue(
            issues,
            "project.furnishing-slot",
            path,
            "Furniture attachments must be optional manual secondary sensor or binary sensor slots.",
          );
      });
      return;
    }
    if (item.entitySlots.length === 0) {
      addProjectIssue(
        issues,
        "project.device-slots-empty",
        `sceneItems[${itemIndex}].entitySlots`,
        "A device scene item requires at least one typed entity slot.",
      );
    }
    // Device composition and binding resolution both select the primary state;
    // exactly one primary slot keeps that selection deterministic.
    const primaryCount = item.entitySlots.filter((slot) => slot.deviceRole === "primary").length;
    if (primaryCount !== 1) {
      addProjectIssue(
        issues,
        "project.device-primary-slot",
        `sceneItems[${itemIndex}].entitySlots`,
        "A device scene item requires exactly one primary entity slot.",
      );
    }
    item.entitySlots.forEach((slot, slotIndex) =>
      validateEntitySlotSemantics(
        slot,
        `sceneItems[${itemIndex}].entitySlots[${slotIndex}]`,
        issues,
      ),
    );
  });
};

export const validateDeviceSlotsAgainstModel = (
  item: DeviceItemSpec,
  definition: DeviceModelDefinition,
  index: number,
  issues: HomeProjectIssue[],
) => {
  item.entitySlots.forEach((slot, slotIndex) => {
    if (isAuxiliaryEntitySlot(slot)) return;
    slot.compatibleDomains.forEach((domain) => {
      if (!definition.supportedDomains.includes(domain)) {
        addProjectIssue(
          issues,
          "project.model-domain",
          `sceneItems[${index}].entitySlots[${slotIndex}].compatibleDomains`,
          `Model “${item.modelId}” does not support the “${domain}” domain.`,
        );
      }
      const allowedClasses = definition.supportedDeviceClasses?.[domain];
      if (
        allowedClasses &&
        slot.compatibleDeviceClasses?.some((value) => !allowedClasses.includes(value))
      ) {
        addProjectIssue(
          issues,
          "project.model-device-class",
          `sceneItems[${index}].entitySlots[${slotIndex}].compatibleDeviceClasses`,
          `Model “${item.modelId}” does not support every requested device class.`,
        );
      }
    });
  });
  if (
    definition.liveMedia?.kind === "camera-stream" &&
    (!definition.supportedDomains.includes("media_player") ||
      item.entitySlots.some((slot) => slot.compatibleDomains.includes("camera")))
  ) {
    const controlSlots = item.entitySlots.filter((slot) => !isAuxiliaryEntitySlot(slot));
    const cameraSlot = controlSlots[0];
    if (
      controlSlots.length !== 1 ||
      cameraSlot?.deviceRole !== definition.liveMedia.slotRole ||
      cameraSlot?.required !== true ||
      !cameraSlot?.compatibleDomains.length ||
      cameraSlot.compatibleDomains.some(
        (domain) =>
          domain !== "camera" &&
          !(
            ["media_player", "switch"].includes(domain) &&
            definition.supportedDomains.includes(domain)
          ),
      )
    ) {
      addProjectIssue(
        issues,
        "project.camera-stream-slot",
        `sceneItems[${index}].entitySlots`,
        "A camera-stream device requires one required primary slot using camera or a supported media-player alternative.",
      );
    }
  }
};
