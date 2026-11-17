import { VesselBasin } from "./vessel-basin";
import { VesselMixer } from "./vessel-mixer";

export function VesselSinkAndFaucet() {
  return (
    <group name="vessel-sink-and-faucet">
      <VesselBasin color="#eee6d5" />
      <group position={[0.197, 0, -0.187]} rotation={[0, Math.PI / 4, 0]}>
        <VesselMixer color="#aeb5b2" trim="#818c88" />
      </group>
    </group>
  );
}
