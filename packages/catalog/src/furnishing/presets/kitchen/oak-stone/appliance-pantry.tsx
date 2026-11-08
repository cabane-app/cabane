import { type SceneItemSize } from "@cabane/engine";
import { CabinetPanel, OakCabinetCase, OakDrawerFront, BRONZE } from "./cabinet-construction";

export const OAK_APPLIANCE_PANTRY_SIZE = [0.8, 2.3, 0.66] as const;
export function OakAppliancePantry({ size = OAK_APPLIANCE_PANTRY_SIZE }: { size?: SceneItemSize }) {
  return (
    <group
      name="oak-appliance-pantry"
      scale={[size[0] / 0.8, size[1] / 2.3, size[2] / 0.66]}
      userData={{ walkCollider: true }}
    >
      <OakCabinetCase width={0.8} height={2.3} depth={0.66} />
      <CabinetPanel name="pantry-cap" size={[0.75, 0.026, 0.66]} at={[0, 2.287, 0]} />
      <OakDrawerFront width={0.738} height={0.64} y={0.444} z={0.29} />
      <OakDrawerFront width={0.738} height={0.8} y={1.864} z={0.29} />
      <CabinetPanel
        name="oven-surround"
        size={[0.74, 0.68, 0.04]}
        at={[0, 1.114, 0.286]}
        color="#393d3a"
        rounded
      />
      <CabinetPanel
        name="oven-glass"
        size={[0.63, 0.43, 0.01]}
        at={[0, 1.063, 0.312]}
        color="#4e5d59"
        rounded
      />
      <CabinetPanel
        name="oven-control-strip"
        size={[0.63, 0.075, 0.012]}
        at={[0, 1.36, 0.312]}
        color="#55554b"
      />
      <CabinetPanel
        name="oven-handle"
        size={[0.49, 0.022, 0.018]}
        at={[0, 1.305, 0.321]}
        color={BRONZE}
      />
      {[-0.23, 0.23].map((x) => (
        <CabinetPanel
          key={x}
          name="oven-handle-post"
          size={[0.018, 0.022, 0.014]}
          at={[x, 1.305, 0.309]}
          color={BRONZE}
        />
      ))}
      <CabinetPanel
        name="oven-display"
        size={[0.1, 0.025, 0.003]}
        at={[0, 1.36, 0.32]}
        color="#a2b8ad"
      />
    </group>
  );
}
