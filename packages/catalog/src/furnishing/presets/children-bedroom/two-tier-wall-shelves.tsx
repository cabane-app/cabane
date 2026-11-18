import { ToonMaterial } from "@cabane/engine";
import { LatheGeometry, Vector2 } from "three";
import { CabinetPiece, cabinetBoard, joinCabinetParts } from "../construction/cabinet-joinery";
import { oakGrainTexture } from "../construction/oak-grain-texture";
import { shelfBoards } from "./wall-shelf-boards";

const tiers = [
  [0, 0],
  [0.34, 0.28],
] as const;
const boards = shelfBoards(tiers);
// Upturned brass tabs support the shelves at the wall and serve as book stops.
const tabs = joinCabinetParts(
  tiers.map(([y, z]) => cabinetBoard(0.018, 0.108, 0.24, -0.141, y + 0.07, z, 0.006)),
);

// Turned ceramic keepsakes. A broad belly tapers into a short neck and recessed mouth.
const keepsake = new LatheGeometry(
  [
    [0, 0],
    [0.045, 0],
    [0.083, 0.037],
    [0.095, 0.08],
    [0.091, 0.112],
    [0.072, 0.14],
    [0.037, 0.165],
    [0.042, 0.175],
    [0.041, 0.183],
    [0.031, 0.183],
    [0.03, 0.159],
    [0, 0.151],
  ].map(([r, y]) => new Vector2(r, y)),
  12,
);

export function TwoTierWallShelves() {
  return (
    <group name="etagere-murale-bedroom-two-photo">
      <CabinetPiece geometry={boards} color="#bd8960" map={oakGrainTexture} outline="#826246" />
      <CabinetPiece name="two-tier-wall-tabs" geometry={tabs} color="#9f8466" />
      {tiers.map(([y, z], i) => (
        <mesh
          key={y}
          geometry={keepsake}
          position={[0.08, y + 0.022, z + (i === 0 ? -0.08 : 0.08)]}
          castShadow
        >
          <ToonMaterial color={i === 0 ? "#eee1d5" : "#d3a89c"} />
        </mesh>
      ))}
    </group>
  );
}
