import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import { ToonMaterial } from "@cabane/engine";
import { oakGrainTexture } from "../../construction/oak-grain-texture";
import { PINE } from "./cabin-bed-finish";

export const frameSides = [-0.567, 0.556] as const;
export const eaveZ = 1.172;
export const eaveHeight = 1.092;
export const ridgeHeight = 1.619;
const timberWidth = 0.06;
export const roofHeight = (z: number) =>
  ridgeHeight - ((ridgeHeight - eaveHeight) * Math.abs(z)) / eaveZ;

type Profile = [number, number][];

// Four-sided board with plumb ridge cuts and diagonal eave joints. Grain follows its long axis.
function profileBoard(profile: Profile, alongRoof: boolean) {
  const positions: number[] = [],
    uvs: number[] = [];
  const corners = [-0.03, 0.03].flatMap((x) => profile.map(([z, y]) => [x, y, z]));
  const faces = [
    [3, 2, 1, 0],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  for (const face of faces) {
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = corners[face[index]];
      positions.push(x, y, z);
      uvs.push((alongRoof ? y - roofHeight(z) : z) * 8 + x * 7, (alongRoof ? z : y) * 1.4);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function gableBoards(sign: number) {
  // Counterclockwise profile when viewed along +X (the horizontal drawing axis is -Z).
  const outer = sign * eaveZ,
    inner = sign * (eaveZ - timberWidth);
  const under = roofHeight(inner) - 0.066;
  const post: Profile = [
    [outer, 0],
    [inner, 0],
    [inner, under],
    [outer, eaveHeight],
  ];
  const rafter: Profile = [
    [outer, eaveHeight],
    [inner, under],
    [0, ridgeHeight - 0.066],
    [0, ridgeHeight],
  ];
  if (sign < 0) {
    post.reverse();
    rafter.reverse();
  }
  return [profileBoard(post, false), profileBoard(rafter, true)];
}
const gables = [-1, 1].map(gableBoards);

function Rail({
  x,
  y,
  z,
  length,
  width,
  height,
  across = false,
}: {
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  across?: boolean;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, across ? Math.PI / 2 : 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, length, height]} />
        <ToonMaterial color={PINE} map={oakGrainTexture} />
      </mesh>
    </group>
  );
}

function guard(start: number, end: number, count: number) {
  const slats = Array.from({ length: count }, (_, i) => {
    const z = start + 0.016 + (i * (end - start - 0.032)) / (count - 1);
    return new BoxGeometry(0.024, 0.23, 0.027).translate(0, 0.413, z);
  });
  return { start, end, slats: mergeGeometries(slats) };
}
const rearGuard = guard(-eaveZ + timberWidth, eaveZ - timberWidth, 16);
const pillowGuard = guard(-eaveZ + timberWidth, -0.12, 8);

function SlattedGuard({ start, end, slats }: ReturnType<typeof guard>) {
  return (
    <group name="pine-slat-guard">
      <Rail
        x={0}
        y={0.548}
        z={(start + end) / 2}
        length={end - start}
        width={0.043}
        height={0.045}
      />
      <mesh name="pine-spindles" geometry={slats} castShadow receiveShadow>
        <ToonMaterial color={PINE} map={oakGrainTexture} />
      </mesh>
    </group>
  );
}

export function TimberFrame() {
  return (
    <>
      {frameSides.map((x, i) => (
        <group key={x} position={[x, 0, 0]} name="pine-gable">
          {gables.flatMap(([post, rafter], j) => [
            <mesh key={"post" + j} name="pine-upright" geometry={post} castShadow receiveShadow>
              <ToonMaterial color={PINE} map={oakGrainTexture} />
            </mesh>,
            <mesh
              key={"rafter" + j}
              name="pitched-rafter"
              geometry={rafter}
              castShadow
              receiveShadow
            >
              <ToonMaterial color={PINE} map={oakGrainTexture} />
            </mesh>,
          ])}
          <Rail
            x={0}
            y={0.232}
            z={0}
            length={2 * (eaveZ - timberWidth)}
            width={0.052}
            height={0.149}
          />
          <SlattedGuard {...(i === 0 ? rearGuard : pillowGuard)} />
        </group>
      ))}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <Rail
            x={-0.0055}
            y={eaveHeight - 0.038}
            z={sign * (eaveZ - 0.03)}
            length={1.063}
            width={0.052}
            height={0.052}
            across
          />
          <Rail
            x={-0.0055}
            y={0.232}
            z={sign * (eaveZ - 0.03)}
            length={1.063}
            width={0.05}
            height={0.149}
            across
          />
        </group>
      ))}
      <Rail
        x={-0.0055}
        y={ridgeHeight - 0.036}
        z={0}
        length={1.063}
        width={0.06}
        height={0.057}
        across
      />
      <Rail x={-0.0055} y={0.256} z={0} length={2.226} width={1.077} height={0.045} />
    </>
  );
}
