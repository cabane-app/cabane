import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { StatusBeacon } from "../../../visuals/device-visual-state";
import {
  batchVehicleSurfaces,
  VehicleBodywork,
  vehicleFinish as finish,
  vehiclePanel,
  vehicleSeam,
  wheelArchBody,
} from "../vehicle-bodywork";
import { vehicleCabin } from "../vehicle-cabin";
import { vehicleSideTrim } from "../vehicle-trim";
import { vehicleWheels } from "../vehicle-wheels";

/** Generic family passenger van, including mirrors, with its nose facing +Z. */
export const MINI_VAN_SIZE = [2.16, 1.86, 4.9] as const;
export const MINI_VAN_DEFAULT_COLOR = "#8daba4";
const paint = MINI_VAN_DEFAULT_COLOR;
const axles = [-1.53, 1.5] as const;
const body = batchVehicleSurfaces(
  [
    wheelArchBody({
      halfLength: 2.38,
      halfWidth: 0.91,
      sill: 0.3,
      axles,
      tireRadius: 0.34,
      color: paint,
      shoulder: [
        [2.38, 0.86],
        [1.98, 1.02],
        [1.25, 1.08],
        [-2.1, 1.08],
        [-2.38, 0.98],
      ],
    }),
    ...vehicleCabin({
      rearBase: -2.29,
      rearTop: -2.06,
      frontTop: 0.67,
      frontBase: 1.44,
      belt: 1.04,
      roof: 1.86,
      halfWidth: 0.85,
      split: 0.08,
      color: paint,
    }),
    ...vehicleSideTrim({
      halfWidth: 0.91,
      mirrorWidth: 2.16,
      belt: 1.04,
      frontDoor: 1.13,
      rearDoor: 0.08,
      rearEdge: -1.22,
      axles,
      tireRadius: 0.34,
      color: paint,
    }),
    // Short bonnet and broad bumpers distinguish the passenger van from a tall car.
    vehiclePanel([1.75, 0.21, 0.144], [0, 0.48, 2.37], paint, 0.055),
    vehiclePanel([1.22, 0.16, 0.025], [0, 0.59, 2.423], finish.recess, 0.025),
    vehiclePanel([0.8, 0.085, 0.04], [0, 0.83, 2.38], finish.trim, 0.025),
    vehiclePanel([0.44, 0.12, 0.014], [0, 0.55, 2.443], finish.alloy, 0.006),
    vehiclePanel([1.76, 0.2, 0.16], [0, 0.46, -2.37], paint, 0.05),
    vehiclePanel([1.6, 0.045, 0.12], [0, 0.565, -2.36], finish.trim, 0.012),
    vehiclePanel([0.46, 0.12, 0.02], [0, 0.86, -2.386], finish.alloy, 0.008),
    vehiclePanel([0.25, 0.035, 0.035], [0, 1.0, -2.38], finish.trim, 0.01),
    ...[-1, 1].flatMap((side) => [
      vehiclePanel([0.44, 0.17, 0.065], [side * 0.6, 0.865, 2.365], finish.trim, 0.04),
      vehiclePanel([0.38, 0.105, 0.026], [side * 0.6, 0.87, 2.402], finish.lens, 0.025),
      vehiclePanel([0.16, 0.37, 0.05], [side * 0.71, 0.99, -2.373], finish.red, 0.028),
      vehiclePanel([0.12, 0.045, 0.016], [side * 0.71, 0.94, -2.405], finish.lens, 0.006),
      // Sliding door track and a narrow pillar separate the third-row quarter window.
      vehiclePanel([0.018, 0.026, 1.05], [side * 0.941, 0.985, -1.45], finish.trim, 0.006),
      vehicleSeam(
        [
          [side * 0.861, 1.115, -1.25],
          [side * 0.718, 1.745, -1.25],
        ],
        finish.trim,
        0.025,
      ),
      vehicleSeam(
        [
          [side * 0.941, 0.39, -1.16],
          [side * 0.941, 0.39, -0.6],
          [side * 0.941, 0.39, 0.04],
        ],
        finish.trim,
        0.004,
      ),
    ]),
  ],
  "mini-van-body",
);
const wheels = vehicleWheels({ radius: 0.34, track: 1.72, axles, spokes: 8 });

const paintedBody = body.filter((batch) => batch.color === paint);
const fixedBody = body.filter((batch) => batch.color !== paint);

export function MiniVanModel({ visualState, color = paint }: HomeDeviceModelProps) {
  return (
    <group name="catalog-mini-van" userData={{ walkCollider: true }}>
      <group dispose={null}>
        {paintedBody.map(({ name, geometry }) => (
          <mesh key={name} name={name} geometry={geometry} castShadow receiveShadow>
            <ToonMaterial color={color} />
            <Outlines color="#28353b" thickness={0.0015} screenspace={false} />
          </mesh>
        ))}
      </group>
      <VehicleBodywork batches={fixedBody} />
      <VehicleBodywork batches={wheels} />
      <StatusBeacon visualState={visualState} position={[0, 0.83, 2.41]} scale={0.4} />
    </group>
  );
}
