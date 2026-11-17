import { ToonMaterial } from "@cabane/engine";
import { CatmullRomCurve3, Vector3 } from "three";

const hose = new CatmullRomCurve3([
  new Vector3(-0.097, 0.986, -0.12),
  new Vector3(-0.099, 0.73, -0.132),
  new Vector3(-0.137, 0.56, -0.105),
  new Vector3(-0.18, 0.51, -0.025),
  new Vector3(-0.215, 0.58, 0.105),
  new Vector3(-0.232, 0.99, 0.124),
  new Vector3(-0.226, 1.395, 0.1),
]);
const holder = new CatmullRomCurve3([
  new Vector3(-0.054, 1.53, 0),
  new Vector3(-0.09, 1.53, 0.037),
  new Vector3(-0.188, 1.53, 0.098),
]);
export function ShowerHose() {
  return (
    <>
      <mesh name="hand-shower-hose" castShadow>
        <tubeGeometry args={[hose, 40, 0.008, 8, false]} />
        <ToonMaterial color="#747875" />
      </mesh>
      <mesh name="riser-mounted-cradle" castShadow>
        <tubeGeometry args={[holder, 6, 0.017, 10, false]} />
        <ToonMaterial color="#595e59" />
      </mesh>
    </>
  );
}
