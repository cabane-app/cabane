import { Outlines, ToonMaterial, type HomeDeviceModelProps } from "@cabane/engine";
import { CatmullRomCurve3, Quaternion, Shape, Vector2, Vector3 } from "three";
import { connectedLightBulbFinish } from "./connected-light-finish";

export const OUTDOOR_WALL_LANTERN_SIZE = [0.3, 0.65, 0.46] as const;
const iron = "#303335";
const backplate = new Shape();
backplate.moveTo(-0.04, 0.35);
backplate.lineTo(-0.04, 0.61);
backplate.absarc(0, 0.61, 0.04, Math.PI, 0, true);
backplate.lineTo(0.04, 0.35);
backplate.absarc(0, 0.35, 0.04, 0, -Math.PI, true);
backplate.closePath();
const roofProfile = [
  [0, 0.51],
  [0.035, 0.51],
  [0.07, 0.496],
  [0.09, 0.477],
  [0.095, 0.45],
  [0.115, 0.42],
  [0.15, 0.39],
  [0.15, 0.38],
  [0, 0.38],
].map(([radius, y]) => new Vector2(radius * Math.SQRT2, y));
const scrolls = [
  [
    [0.56, 0.025],
    [0.61, 0.09],
    [0.6, 0.16],
    [0.56, 0.24],
    [0.54, 0.31],
  ],
  [
    [0.53, 0.08],
    [0.55, 0.12],
    [0.59, 0.1],
    [0.58, 0.065],
    [0.56, 0.075],
    [0.565, 0.09],
  ],
  [
    [0.53, 0.31],
    [0.56, 0.345],
    [0.6, 0.34],
    [0.615, 0.31],
    [0.6, 0.295],
  ],
].map((points) => new CatmullRomCurve3(points.map(([y, z]) => new Vector3(0, y, z))));
const posts = [-1, 1].flatMap((x) =>
  [-1, 1].map((z) => {
    const start = new Vector3(x * 0.075, 0.095, 0.31 + z * 0.075);
    const end = new Vector3(x * 0.125, 0.38, 0.31 + z * 0.125);
    const direction = end.clone().sub(start);
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      length: direction.length(),
      rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
    };
  }),
);

/** Traditional hanging lantern: bottom Y=0, wall contact Z=0. */
export function OutdoorWallLanternModel({ state, visualState }: HomeDeviceModelProps) {
  const finish = connectedLightBulbFinish(visualState, state);
  return (
    <group name="catalog-outdoor-wall-lantern">
      <mesh castShadow>
        <extrudeGeometry
          args={[backplate, { depth: 0.024, bevelEnabled: false, curveSegments: 12 }]}
        />
        <ToonMaterial color={iron} />
      </mesh>
      <mesh position={[0, 0.53, 0.18]} castShadow>
        <boxGeometry args={[0.018, 0.018, 0.336]} />
        <ToonMaterial color={iron} />
      </mesh>
      {scrolls.map((curve, index) => (
        <mesh key={index} castShadow>
          <tubeGeometry args={[curve, 28, 0.006, 6, false]} />
          <ToonMaterial color={iron} />
        </mesh>
      ))}
      <mesh position={[0, 0.52, 0.31]} castShadow>
        <cylinderGeometry args={[0.012, 0.017, 0.04, 12]} />
        <ToonMaterial color={iron} />
      </mesh>
      <mesh position={[0, 0, 0.31]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <latheGeometry args={[roofProfile, 4]} />
        <ToonMaterial color={iron} />
        <Outlines color="#242729" thickness={0.0007} screenspace={false} />
      </mesh>
      <mesh
        name="outdoor-lantern-glass"
        position={[0, 0.2375, 0.31]}
        rotation={[0, Math.PI / 4, 0]}
      >
        <cylinderGeometry args={[0.125 * Math.SQRT2, 0.075 * Math.SQRT2, 0.285, 4, 1, true]} />
        <ToonMaterial color="#d9e4e1" transparent opacity={0.17} depthWrite={false} side={2} />
      </mesh>
      {posts.map((post, index) => (
        <mesh
          key={index}
          name={`lantern-corner-${index}`}
          position={post.midpoint.toArray()}
          quaternion={post.rotation.toArray()}
          castShadow
        >
          <boxGeometry args={[0.012, post.length, 0.012]} />
          <ToonMaterial color={iron} />
        </mesh>
      ))}
      <mesh position={[0, 0.09, 0.31]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <cylinderGeometry args={[0.115, 0.115, 0.018, 4]} />
        <ToonMaterial color={iron} />
      </mesh>
      <mesh position={[0, 0.058, 0.31]} castShadow>
        <cylinderGeometry args={[0.074, 0.035, 0.05, 16]} />
        <ToonMaterial color={iron} />
      </mesh>
      <mesh position={[0, 0.0165, 0.31]} castShadow>
        <cylinderGeometry args={[0.008, 0.014, 0.033, 12]} />
        <ToonMaterial color={iron} />
      </mesh>
      <mesh position={[0, 0.354, 0.31]}>
        <cylinderGeometry args={[0.018, 0.018, 0.052, 12]} />
        <ToonMaterial color="#79736a" />
      </mesh>
      <mesh name="outdoor-lantern-bulb" position={[0, 0.29, 0.31]} scale={[1, 1.5, 1]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <ToonMaterial
          color={finish.color}
          emissive="#ffd28c"
          emissiveIntensity={finish.emissiveIntensity}
        />
      </mesh>
    </group>
  );
}
