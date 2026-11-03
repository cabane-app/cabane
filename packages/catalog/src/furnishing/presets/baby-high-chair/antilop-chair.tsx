import { RoundedFurniturePanel as Panel } from "../construction/rounded-furniture-panel";
import { ChairSupport } from "./chair-support";

/** Current white/white ANTILOP: 56 × 90 × 60 cm; no aftermarket footrest. */
export function AntilopChair() {
  return (
    <group>
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((front) => (
          <group key={`${side}-${front}`}>
            <Panel
              name="leg-foot"
              size={[0.04, 0.025, 0.04]}
              position={[side * 0.26, 0.0125, front * 0.28]}
              color="#e4e1d8"
              radius={0.01}
              outline={false}
            />
            <ChairSupport
              name={`antilop-leg-${side}-${front}`}
              start={[side * 0.26, 0.018, front * 0.28]}
              end={[side * 0.135, 0.535, front * 0.115]}
              width={0.025}
              color="#e6e5df"
              round
            />
          </group>
        )),
      )}
      <Panel
        name="seat"
        size={[0.3, 0.035, 0.29]}
        position={[0, 0.5225, -0.025]}
        color="#f3f1e9"
        radius={0.017}
      />
      <Panel
        name="shell-back"
        size={[0.33, 0.38, 0.035]}
        position={[0, 0.71, -0.1625]}
        color="#f3f1e9"
        radius={0.016}
      />
      {[-0.16, 0.16].map((x) => (
        <Panel
          key={x}
          size={[0.035, 0.2, 0.29]}
          position={[x, 0.625, -0.025]}
          color="#f3f1e9"
          radius={0.017}
        />
      ))}
      <Panel
        name="crotch-support"
        size={[0.045, 0.2, 0.035]}
        position={[0, 0.62, 0.1]}
        color="#e5e3db"
        radius={0.016}
      />
      <Panel
        name="tray"
        size={[0.42, 0.035, 0.34]}
        position={[0, 0.725, 0.105]}
        color="#f3f1e9"
        radius={0.017}
      />
      <Panel
        size={[0.38, 0.008, 0.3]}
        position={[0, 0.744, 0.105]}
        color="#e4e3da"
        radius={0.003}
        outline={false}
      />
      <Panel
        name="harness-buckle"
        size={[0.04, 0.035, 0.012]}
        position={[0, 0.565, 0.122]}
        color="#9f9c93"
        radius={0.004}
        outline={false}
      />
    </group>
  );
}
