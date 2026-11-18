import { LatheGeometry, TubeGeometry, Curve, Vector2, Vector3 } from "three";
import { CabinetPiece, joinCabinetParts } from "../construction/cabinet-joinery";
import { tintableFinishTexture } from "../../../materials/tintable-finish-texture";

// Wide reeds pass over and under their neighbours. The darker edges separate
// strips while slight lengthwise ridges follow the fibres of each reed.
const rushWeave = tintableFinishTexture(128, "children-basket-rush", (u, v) => {
  const x = u * 4,
    y = v * 4;
  const warp = (Math.floor(x) + Math.floor(y)) % 2 === 0;
  const across = warp ? x : y,
    along = warp ? y : x;
  const crown = Math.sin(Math.PI * (across % 1)) ** 0.5;
  const fibre = Math.cos(8 * Math.PI * across);
  return 0.77 + 0.16 * crown + 0.035 * Math.sin(Math.PI * (along % 1)) + 0.012 * fibre;
});

function turned(profile: number[][]) {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    40,
  );
}

const body = turned([
  [0, 0],
  [0.301, 0],
  [0.326, 0.006],
  [0.338, 0.021],
  [0.34, 0.046],
  [0.336, 0.113],
  [0.321, 0.25],
  [0.299, 0.403],
  [0.296, 0.449],
  [0.28, 0.449],
  [0.281, 0.417],
  [0.309, 0.207],
  [0.321, 0.061],
  [0.315, 0.036],
  [0.302, 0.03],
  [0, 0.03],
]);
const uv = body.getAttribute("uv");
const vertices = body.getAttribute("position");
for (let i = 0; i < uv.count; i++) {
  uv.setXY(i, uv.getX(i) * 22, vertices.getY(i) * 11.5);
}

const rim = turned([
  [0.29, 0.428],
  [0.3, 0.432],
  [0.304, 0.441],
  [0.303, 0.449],
  [0.297, 0.455],
  [0.287, 0.457],
  [0.28, 0.454],
  [0.276, 0.445],
  [0.278, 0.435],
  [0.286, 0.429],
  [0.29, 0.428],
]);

// Bent rush loops follow the circular wall and embed their ends in the binding.
class CarryLoop extends Curve<Vector3> {
  constructor(private side: number) {
    super();
  }
  override getPoint(t: number, target = new Vector3()) {
    const angle = Math.PI * t;
    const x = 0.082 * Math.cos(angle);
    return target.set(x, 0.44 + 0.064 * Math.sin(angle), this.side * Math.sqrt(0.29 ** 2 - x ** 2));
  }
}
const handles = joinCabinetParts(
  [-1, 1].map((side) => new TubeGeometry(new CarryLoop(side), 22, 0.008, 8, false)),
);

export function ChildrenBedroomWovenFloorBasket() {
  return (
    <group name="panier-de-sol-tresse-photo">
      <CabinetPiece
        name="basket-hollow-shell"
        geometry={body}
        color="#bd976f"
        map={rushWeave}
        outline="#897059"
      />
      <CabinetPiece geometry={rim} color="#c69f74" />
      <CabinetPiece geometry={handles} color="#b48b62" />
    </group>
  );
}
