import { BoxGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Outlines, ToonMaterial } from "@cabane/engine";
import type { HomeDeviceModelProps } from "@cabane/engine";
import { deriveClimateAirflowMode } from "../../climate-airflow";
import { palette, StatusBeacon } from "../../visuals/device-visual-state";
import { AirflowWaves } from "../../visuals/airflow-waves";

const cabinet = new RoundedBoxGeometry(0.86, 0.278, 0.171, 1, 0.036);
const accessFascia = new RoundedBoxGeometry(0.81, 0.138, 0.038, 1, 0.017);
const topIntake = mergeGeometries(
  [-0.18, 0.18].flatMap((x) =>
    [0.046, 0.064, 0.082].map((z) => new BoxGeometry(0.339, 0.003, 0.008).translate(x, 0.2785, z)),
  ),
);
const outlet = new RoundedBoxGeometry(0.726, 0.062, 0.026, 1, 0.012);
const louvers = mergeGeometries(
  [-0.176, 0.176].flatMap((x) =>
    [-0.012, 0.009].map((y) => new BoxGeometry(0.344, 0.006, 0.033).translate(x, y, 0)),
  ),
);

export function IndoorAcModel({ state, visualState, reducedMotion }: HomeDeviceModelProps) {
  const active = visualState === "connected-active";
  const airflowMode = active ? deriveClimateAirflowMode(state) : null;
  return (
    <group name="catalog-indoor-ac">
      <mesh geometry={cabinet} position={[0, 0.139, 0.0845]} castShadow receiveShadow>
        <ToonMaterial color={palette.body} />
        <Outlines color={palette.charcoal} thickness={0.0015} screenspace={false} />
      </mesh>
      <mesh geometry={accessFascia} position={[0, 0.172, 0.158]}>
        <ToonMaterial color="#ede8de" />
      </mesh>
      <mesh geometry={topIntake}>
        <ToonMaterial color="#959e94" />
      </mesh>
      <mesh geometry={outlet} position={[0, 0.065, 0.165]}>
        <ToonMaterial color={palette.charcoal} />
      </mesh>
      <mesh
        geometry={louvers}
        position={[0, 0.065, active ? 0.184 : 0.187]}
        rotation={[active ? -0.32 : -0.08, 0, 0]}
      >
        <ToonMaterial color={palette.bodyDark} />
      </mesh>
      <StatusBeacon visualState={visualState} position={[0.32, 0.16, 0.175]} />
      {airflowMode && (
        <AirflowWaves mode={airflowMode} width={0.84} reducedMotion={reducedMotion} />
      )}
    </group>
  );
}
