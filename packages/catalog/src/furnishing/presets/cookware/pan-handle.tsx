import { RoundedFurniturePanel } from "../construction";

/** The metal tang overlaps both the vessel wall and the rounded heatproof grip. */
export function PanHandle({ start, end, height }: { start: number; end: number; height: number }) {
  return (
    <group name="pan-handle">
      <RoundedFurniturePanel
        name="handle-tang"
        size={[0.035, 0.012, 0.021]}
        position={[start + 0.0125, height, 0]}
        radius={0.003}
        color="#999f99"
        outline={false}
      />
      <RoundedFurniturePanel
        name="heatproof-grip"
        size={[end - start - 0.02, 0.025, 0.033]}
        position={[(start + 0.02 + end) / 2, height, 0]}
        radius={0.008}
        color="#343d3a"
        outlineColor="#242b28"
      />
    </group>
  );
}
