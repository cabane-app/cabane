import { type SceneItemSize } from "@cabane/engine";
import { RoundedFurniturePanel as Panel } from "../construction";
import { StrollerCanopy, StrollerTube as Tube, StrollerWheel } from "./parts";

export const STROLLER_SIZE: SceneItemSize = [0.602, 1.05, 0.92];

/** Generic open pushchair; four grounded wheels, fabric seat and open basket. */
export function Stroller({
  size = STROLLER_SIZE,
  color = "#8c9d96",
}: {
  size?: SceneItemSize;
  color?: string;
}) {
  return (
    <group
      scale={[size[0] / STROLLER_SIZE[0], size[1] / STROLLER_SIZE[1], size[2] / STROLLER_SIZE[2]]}
      userData={{ walkCollider: true }}
    >
      {[-1, 1].map((side) => (
        <group key={side}>
          <StrollerWheel x={side * 0.275} z={-0.34} radius={0.12} />
          <StrollerWheel x={side * 0.235} z={0.36} radius={0.1} />
          <Tube start={[side * 0.25, 0.12, -0.34]} end={[side * 0.21, 0.65, 0.08]} />
          <Tube start={[side * 0.21, 0.1, 0.36]} end={[side * 0.23, 1.032, -0.442]} />
          <Tube start={[side * 0.21, 0.65, 0.08]} end={[side * 0.21, 0.865, -0.27]} />
          <Tube start={[side * 0.21, 0.46, 0.04]} end={[side * 0.21, 0.3, 0.28]} />
          <Tube start={[side * 0.24, 0.245, -0.24]} end={[side * 0.185, 0.245, -0.2]} />
          <Tube start={[side * 0.214, 0.245, 0.235]} end={[side * 0.185, 0.245, 0.2]} />
          <Panel
            size={[0.025, 0.12, 0.46]}
            position={[side * 0.185, 0.245, -0.015]}
            color="#535f5c"
            outline={false}
          />
          <Panel
            size={[0.035, 0.15, 0.3]}
            position={[side * 0.195, 0.54, -0.04]}
            color={color}
            outline={false}
          />
        </group>
      ))}
      <Tube start={[-0.275, 0.12, -0.34]} end={[0.275, 0.12, -0.34]} />
      <Tube start={[-0.235, 0.1, 0.36]} end={[0.235, 0.1, 0.36]} />
      <Tube
        start={[-0.23, 1.032, -0.442]}
        end={[0.23, 1.032, -0.442]}
        radius={0.018}
        color="#3e4948"
      />
      <Tube start={[-0.21, 0.46, 0.04]} end={[0.21, 0.46, 0.04]} />
      <Tube start={[-0.21, 0.3, 0.28]} end={[0.21, 0.3, 0.28]} radius={0.025} color="#3e4948" />
      <Tube start={[-0.21, 0.65, 0.08]} end={[0.21, 0.65, 0.08]} radius={0.018} color="#3e4948" />
      <Panel
        size={[0.39, 0.035, 0.46]}
        position={[0, 0.19, -0.015]}
        color="#535f5c"
        outline={false}
      />
      {[-0.2325, 0.2025].map((z) => (
        <Panel
          key={z}
          size={[0.345, 0.12, 0.025]}
          position={[0, 0.245, z]}
          color="#535f5c"
          outline={false}
        />
      ))}
      <Panel
        size={[0.38, 0.055, 0.35]}
        position={[0, 0.485, -0.025]}
        color={color}
        outlineColor="#576b63"
        radius={0.018}
      />
      <Panel
        size={[0.38, 0.34, 0.055]}
        position={[0, 0.64, -0.205]}
        rotation={[0.2, 0, 0]}
        color={color}
        outlineColor="#576b63"
        radius={0.018}
      />
      <StrollerCanopy color={color} />
    </group>
  );
}
