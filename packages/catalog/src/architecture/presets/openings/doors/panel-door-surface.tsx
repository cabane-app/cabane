import { useEffect, useMemo } from "react";
import { JoineryMaterial, type DoorFinish } from "@cabane/engine";
import { panelLeafGeometry } from "./panel-leaf-geometry";

export function PanelDoorSurface({
  width,
  height,
  color,
  finish,
}: {
  width: number;
  height: number;
  color: string;
  finish: DoorFinish;
}) {
  const geometry = useMemo(() => panelLeafGeometry(width, height), [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="opening-panel-leaf" geometry={geometry} castShadow receiveShadow>
      <JoineryMaterial color={color} vertexColors finish={finish === "wood" ? "wood" : "paint"} />
    </mesh>
  );
}
