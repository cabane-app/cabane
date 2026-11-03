import { RoundedFurniturePanel as Panel } from "../construction/rounded-furniture-panel";
import { ChairSupport } from "./chair-support";

/** Tripp Trapp-style timber frame, in its source 46 × 79 × 49 cm envelope. */
export function StokkeChair() {
  return (
    <group scale={[0.56 / 0.46, 0.9 / 0.79, 0.6 / 0.49]}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Panel
            name="timber-runner"
            size={[0.04, 0.035, 0.49]}
            position={[side * 0.21, 0.0175, 0]}
            color="#c69e6c"
          />
          <ChairSupport
            name={`timber-upright-${side}`}
            start={[side * 0.21, 0.025, 0.155]}
            end={[side * 0.21, 0.747, -0.165]}
            width={0.032}
            depth={0.052}
            color="#d6b486"
          />
        </group>
      ))}
      <Panel
        size={[0.41, 0.025, 0.28]}
        position={[0, 0.535, 0.005]}
        color="#dfbd8f"
        radius={0.012}
      />
      <Panel
        size={[0.41, 0.025, 0.32]}
        position={[0, 0.325, 0.065]}
        color="#dfbd8f"
        radius={0.012}
      />
      {[0.69, 0.76].map((y) => (
        <Panel
          key={y}
          size={[0.42, 0.06, 0.025]}
          position={[0, y, -0.163]}
          color="#d7b586"
          radius={0.01}
        />
      ))}
      <Panel size={[0.4, 0.045, 0.03]} position={[0, 0.12, 0.11]} color="#ba9466" />
      {/* Baby-set side rails connect the back to the supported tray. */}
      {[-0.15, 0.15].map((x) => (
        <Panel
          key={x}
          size={[0.035, 0.12, 0.25]}
          position={[x, 0.635, -0.015]}
          color="#e7e4db"
          radius={0.016}
        />
      ))}
      <Panel
        size={[0.045, 0.14, 0.035]}
        position={[0, 0.6, 0.115]}
        color="#e7e4db"
        radius={0.015}
      />
      <Panel
        size={[0.43, 0.025, 0.25]}
        position={[0, 0.69, 0.112]}
        color="#f0ede5"
        radius={0.012}
      />
      <Panel
        size={[0.39, 0.007, 0.21]}
        position={[0, 0.704, 0.112]}
        color="#deddd5"
        radius={0.003}
        outline={false}
      />
    </group>
  );
}
