import { CustomDiningChair } from "./dining-chair";
import { CustomDiningTable } from "./dining-table";
import { LivingRoomTablePlant } from "./table-plant";

export function CustomDiningSet({
  footprintScale = 1,
  color,
}: {
  readonly footprintScale?: number;
  readonly color?: string | undefined;
}) {
  return (
    <group
      name="coin-repas-salon-custom"
      scale={[footprintScale, 1, footprintScale]}
      userData={{ walkCollider: true }}
    >
      <CustomDiningTable />
      <LivingRoomTablePlant />
      <CustomDiningChair position={[0, 0, -0.79]} color={color} rotationY={0} />
      <CustomDiningChair position={[0, 0, 0.79]} color={color} rotationY={Math.PI} />
      <CustomDiningChair position={[-0.79, 0, 0]} color={color} rotationY={Math.PI / 2} />
      <CustomDiningChair position={[0.79, 0, 0]} color={color} rotationY={-Math.PI / 2} />
    </group>
  );
}
