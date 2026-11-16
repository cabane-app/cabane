import { VanityRaisedPanels } from "./vanity-raised-panels";
import { VanitySideJoinery } from "./vanity-side-joinery";
import { ToonMaterial, type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel } from "../construction";
import { VanityDoor } from "./vanity-door";
import { VesselBasin } from "./vessel-basin";
import { VesselMixer } from "./vessel-mixer";

export const DARK_OAK_VESSEL_VANITY_SIZE = [0.8, 1.23, 0.52] as const;

export function DarkOakVesselVanity({
  size = DARK_OAK_VESSEL_VANITY_SIZE,
}: {
  size?: SceneItemSize;
}) {
  return (
    <group
      name="dark-oak-vessel-vanity"
      scale={[size[0] / 0.8, size[1] / 1.23, size[2] / 0.52]}
      userData={{ walkCollider: true }}
    >
      {[-0.338, 0.338].flatMap((x) =>
        [-0.193, 0.193].map((z) => (
          <mesh key={x + "-" + z} position={[x, 0.062, z]} castShadow>
            <cylinderGeometry args={[0.051, 0.036, 0.124, 4, 1, false, Math.PI / 4]} />
            <ToonMaterial color="#32251f" />
          </mesh>
        )),
      )}
      <RoundedFurniturePanel
        size={[0.767, 0.703, 0.46]}
        position={[0, 0.4615, -0.011]}
        color="#3b2922"
        radius={0.009}
        outline={false}
      />
      <VanitySideJoinery />
      <VanityRaisedPanels />
      {[-0.189, 0.189].map((x) => (
        <group key={x} name="dark-oak-vanity-door" position={[x, 0.466, 0.219]}>
          <VanityDoor color={x < 0 ? "#50372d" : "#493329"} />
          <group position={[x < 0 ? 0.154 : -0.154, 0.054, 0]}>
            {[-0.07, 0.07].map((y) => (
              <mesh key={y} position={[0, y, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.006, 0.008, 0.025, 10]} />
                <ToonMaterial color="#292a26" />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.035]} castShadow>
              <cylinderGeometry args={[0.006, 0.006, 0.157, 12]} />
              <ToonMaterial color="#202422" />
            </mesh>
          </group>
        </group>
      ))}
      <RoundedFurniturePanel
        size={[0.8, 0.048, 0.52]}
        position={[0, 0.836, 0]}
        color="#50372c"
        radius={0.008}
        outlineColor="#3c2d24"
      />
      <group position={[-0.04, 0.86, 0.015]} scale={[0.9583, 0.8, 0.9583]}>
        <VesselBasin color="#eee9dd" />
      </group>
      <group
        name="vanity-matte-black-faucet"
        position={[0.25, 0.86, -0.09]}
        scale={[1.16, 0.37 / 0.36, 1]}
      >
        <VesselMixer color="#202422" trim="#373d39" />
      </group>
    </group>
  );
}
