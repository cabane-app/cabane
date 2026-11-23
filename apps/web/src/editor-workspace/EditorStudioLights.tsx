import { useGraphicsFeature } from "@cabane/engine";

export function EditorStudioLights() {
  const daylight = useGraphicsFeature("lighting");
  return (
    <>
      <hemisphereLight args={["#ecf4ff", "#768b93", 0.95]} />
      <directionalLight
        position={daylight ? [-8, 12, 7] : [7, 12, 8]}
        color="#fff0d7"
        intensity={1.8}
        castShadow={false}
      />
    </>
  );
}
