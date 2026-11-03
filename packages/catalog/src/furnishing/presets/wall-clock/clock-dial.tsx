import { ToonMaterial } from "@cabane/engine";

/** Raised index marks and static hands, with no glass or animated time source. */
export function ClockDial() {
  return (
    <group name="clock-dial">
      <mesh position={[0, 0, 0.029]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[0.132, 0.132, 0.002, 64]} />
        <ToonMaterial color="#f4f0e5" />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index * Math.PI) / 6;
        return (
          <mesh
            key={index}
            position={[Math.sin(angle) * 0.113, Math.cos(angle) * 0.113, 0.0315]}
            rotation={[0, 0, -angle]}
          >
            <boxGeometry args={[index % 3 === 0 ? 0.006 : 0.004, 0.016, 0.003]} />
            <ToonMaterial color="#55574f" />
          </mesh>
        );
      })}
      <group rotation={[0, 0, (Math.PI * 11) / 36]}>
        <mesh position={[0, 0.031, 0.035]}>
          <boxGeometry args={[0.01, 0.074, 0.004]} />
          <ToonMaterial color="#393d38" />
        </mesh>
      </group>
      <group rotation={[0, 0, -Math.PI / 3]}>
        <mesh position={[0, 0.045, 0.039]}>
          <boxGeometry args={[0.007, 0.102, 0.004]} />
          <ToonMaterial color="#393d38" />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.0375]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.015, 24]} />
        <ToonMaterial color="#393d38" />
      </mesh>
    </group>
  );
}
