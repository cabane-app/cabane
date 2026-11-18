import { Outlines, ToonMaterial } from "@cabane/engine";
import { type BufferGeometry, type Texture } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function cabinetBoard(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  bevel = 0.005,
) {
  return new RoundedBoxGeometry(width, height, depth, 1, bevel).translate(x, y, z);
}

/** U crosses the grain; V follows the board length along X. */
export function horizontalTimber(board: BufferGeometry) {
  const position = board.getAttribute("position");
  const normal = board.getAttribute("normal");
  const uv = board.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const across = Math.abs(normal.getY(i)) > 0.5 ? position.getZ(i) : position.getY(i);
    uv.setXY(i, across / 0.38, position.getX(i) / 1.3);
  }
  return board;
}

export function joinCabinetParts(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}

/** Module-owned geometry is shared by every instance of a cabinet. */
export function CabinetPiece({
  geometry,
  color,
  outline,
  name,
  map,
}: {
  geometry: BufferGeometry;
  color: string;
  outline?: string;
  name?: string;
  map?: Texture;
}) {
  return (
    <mesh {...(name ? { name } : {})} geometry={geometry} castShadow receiveShadow>
      <ToonMaterial color={color} {...(map ? { map } : {})} />
      {outline && <Outlines color={outline} thickness={0.0015} screenspace={false} />}
    </mesh>
  );
}
