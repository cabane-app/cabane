import { RoundedBox, JoineryMaterial, type DoorFinish } from "@cabane/engine";
/** Flat built-in door, with a horizontal pull mounted directly to its front. */
export function FlushDoorLeaf({
  width,
  height,
  finish,
  color,
  handleSide = 1,
  knob = false,
}: {
  width: number;
  height: number;
  finish: DoorFinish;
  color?: string;
  handleSide?: -1 | 1;
  knob?: boolean;
}) {
  const pullWidth = Math.min(0.36, width * 0.65);
  return (
    <group name="flush-door-leaf">
      <RoundedBox args={[width, height, 0.02]} radius={0.002} smoothness={2} castShadow>
        <JoineryMaterial
          finish={finish === "wood" ? "wood" : "paint"}
          color={color ?? (finish === "white" ? "#e9e8e2" : "#b89a73")}
        />
      </RoundedBox>
      {knob ? (
        <group
          name="flush-door-knob"
          position={[
            handleSide * (width / 2 - Math.min(0.04, width * 0.2)),
            Math.min(1.05, height * 0.45) - height / 2,
            0,
          ]}
        >
          <mesh position={[0, 0, 0.016]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.012, 12]} />
            <JoineryMaterial finish="metal" color="#292c29" />
          </mesh>
          <mesh position={[0, 0, 0.028]}>
            <sphereGeometry args={[0.012, 16, 10]} />
            <JoineryMaterial finish="metal" color="#292c29" />
          </mesh>
        </group>
      ) : (
        <group name="flush-door-pull" position={[0, Math.min(1.05, height * 0.45) - height / 2, 0]}>
          {[-pullWidth * 0.4, pullWidth * 0.4].map((x) => (
            <mesh key={x} position={[x, 0, 0.0225]}>
              <boxGeometry args={[0.012, 0.012, 0.025]} />
              <JoineryMaterial finish="metal" color="#292c29" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.044]}>
            <boxGeometry args={[pullWidth, 0.012, 0.018]} />
            <JoineryMaterial finish="metal" color="#292c29" />
          </mesh>
        </group>
      )}
    </group>
  );
}
