import { ToonMaterial } from "@cabane/engine";
import { BoxGeometry, CylinderGeometry, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const frame = [];
for (const side of [-1, 1]) {
  frame.push(new BoxGeometry(0.33, 0.028, 0.024).translate(0, 0.1, side * 0.14));
  frame.push(new BoxGeometry(0.024, 0.028, 0.28).translate(side * 0.165, 0.1, 0));
  for (const end of [-1, 1]) {
    const top = new Vector3(side * 0.165, 0.12, end * 0.14);
    const base = new Vector3(side * 0.182, 0.0018, end * 0.154);
    const axis = top.clone().sub(base);
    const leg = new CylinderGeometry(0.028, 0.015, axis.length(), 8);
    leg.applyQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()),
    );
    const mid = top.add(base).multiplyScalar(0.5);
    frame.push(leg.translate(mid.x, mid.y, mid.z));
  }
}
const underframe = mergeGeometries(frame);
underframe.computeBoundingBox();
underframe.translate(0, -underframe.boundingBox!.min.y, 0);
frame.forEach((part) => part.dispose());

export function NightstandBase() {
  return (
    <mesh
      name="nightstand-apron-and-splayed-legs"
      geometry={underframe}
      dispose={null}
      castShadow
      receiveShadow
    >
      <ToonMaterial color="#b99262" />
    </mesh>
  );
}
