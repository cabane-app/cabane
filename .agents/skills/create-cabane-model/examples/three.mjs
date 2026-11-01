import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { writeFile } from "node:fs/promises";

// GLTFExporter uses the browser FileReader API. This minimal Node adapter only
// reads exporter-created Blobs; it performs no network or application calls.
globalThis.FileReader = class {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const desk = new THREE.Group();
desk.name = "Warm oak desk";
const wood = new THREE.MeshStandardMaterial({
  color: "#bc9368",
  roughness: 0.85,
  metalness: 0,
});
const frame = new THREE.MeshStandardMaterial({
  color: "#5e705e",
  roughness: 0.75,
  metalness: 0.05,
});
function box(name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  desk.add(mesh);
}
box("Desktop", [1.2, 0.05, 0.65], [0, 0.725, 0], wood);
for (const x of [-0.52, 0.52])
  for (const z of [-0.25, 0.25]) box("Leg", [0.055, 0.7, 0.055], [x, 0.35, z], frame);
desk.updateMatrixWorld(true);
const buffer = await new GLTFExporter().parseAsync(desk, {
  binary: true,
  onlyVisible: true,
  animations: [],
});
const output = process.argv[2] ?? "desk.glb";
await writeFile(output, new Uint8Array(buffer));
console.log(`Saved ${output}: 1.20 × 0.75 × 0.65 m, Floor, Furniture.`);
