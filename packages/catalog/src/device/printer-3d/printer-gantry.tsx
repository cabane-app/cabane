import { Outlines, ToonMaterial } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../../furnishing/presets/construction/rounded-furniture-panel";

/** Connected gantry, parked extruder and top-mounted filament spool. */
export function PrinterGantry() {
  return (
    <group name="printer-gantry">
      {[-0.205, 0.205].map((x) => (
        <group key={x}>
          <Panel
            size={[0.03, 0.33, 0.036]}
            position={[x, 0.255, -0.065]}
            color="#4d5b57"
            radius={0.003}
            outlineColor="#394641"
          />
          <mesh position={[x, 0.255, -0.042]}>
            <cylinderGeometry args={[0.004, 0.004, 0.3, 8]} />
            <ToonMaterial color="#a6b3ac" />
          </mesh>
        </group>
      ))}
      <Panel
        size={[0.44, 0.035, 0.045]}
        position={[0, 0.4275, -0.065]}
        color="#4d5b57"
        radius={0.004}
        outlineColor="#394641"
      />
      <Panel
        size={[0.42, 0.024, 0.028]}
        position={[0, 0.292, -0.038]}
        color="#8a9b94"
        radius={0.002}
        outline={false}
      />
      <Panel
        name="printer-extruder"
        size={[0.068, 0.063, 0.058]}
        position={[-0.055, 0.282, -0.003]}
        color="#cb7956"
        radius={0.007}
        outlineColor="#835340"
      />
      <mesh position={[-0.055, 0.243, -0.003]}>
        <cylinderGeometry args={[0.012, 0.004, 0.018, 8]} />
        <ToonMaterial color="#beaa72" />
      </mesh>
      <mesh position={[-0.055, 0.284, 0.028]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.004, 12]} />
        <ToonMaterial color="#46534e" />
      </mesh>
      {/* Bracket joins the crossbar and spool axle; the reel rotates about X. */}
      <Panel
        size={[0.014, 0.085, 0.022]}
        position={[-0.06, 0.4775, -0.065]}
        color="#586760"
        radius={0.003}
        outline={false}
      />
      <mesh position={[0, 0.51, -0.065]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.14, 12]} />
        <ToonMaterial color="#78867f" />
      </mesh>
      <mesh position={[0, 0.51, -0.065]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.078, 0.078, 0.074, 24]} />
        <ToonMaterial color="#bca47d" />
      </mesh>
      {[-0.042, 0.042].map((x) => (
        <mesh key={x} position={[x, 0.51, -0.065]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.01, 24]} />
          <ToonMaterial color="#d7dcd8" />
          <Outlines color="#69736f" thickness={0.0015} screenspace={false} />
        </mesh>
      ))}
    </group>
  );
}
