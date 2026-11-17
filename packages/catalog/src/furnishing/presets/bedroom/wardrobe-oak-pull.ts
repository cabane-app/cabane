import { CylinderGeometry, LatheGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const grip = new LatheGeometry(
  [
    new Vector2(0, -0.198),
    new Vector2(0.008, -0.196),
    new Vector2(0.012, -0.184),
    new Vector2(0.014, 0),
    new Vector2(0.012, 0.184),
    new Vector2(0.008, 0.196),
    new Vector2(0, 0.198),
  ],
  12,
);
grip.scale(1, 1, 0.8);
grip.translate(0, 1.055, 0.2888);
const posts = [0.891, 1.219].map((y) => {
  const pin = new CylinderGeometry(0.01, 0.012, 0.031, 10);
  pin.rotateX(Math.PI / 2);
  return pin.translate(0, y, 0.271);
});
export const wardrobeOakPull = mergeGeometries([grip, ...posts]);
grip.dispose();
posts.forEach((post) => post.dispose());
