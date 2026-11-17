import { useId } from "react";
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import {
  setAllGraphicsFeatures,
  setGraphicsFeatures,
  useGraphicsFeatures,
  type GraphicsFeature,
} from "@cabane/engine";
import "./graphics-panel.css";

const controls: readonly [GraphicsFeature, string][] = [
  ["lighting", "Lighting & reflections"],
  ["contact", "Contact shadows"],
  ["finishes", "Surface finishes"],
  ["joinery", "Doors, glazing & wall trim"],
  ["grounds", "Grounds & plinth"],
  ["framing", "Camera framing"],
];

export default function GraphicsPanel() {
  const state = useGraphicsFeatures();
  const id = useId();
  return (
    <div className="graphics-debug">
      <button
        type="button"
        className="graphics-debug__trigger"
        popoverTarget={id}
        aria-haspopup="dialog"
      >
        <IconAdjustmentsHorizontal size={16} stroke={1.6} aria-hidden />
        Graphics
      </button>
      <section
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Graphics comparison"
        className="graphics-debug__panel"
      >
        <header>
          <h2>Graphics</h2>
          <button
            type="button"
            aria-label="Close graphics comparison"
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            <IconX size={16} stroke={1.5} aria-hidden />
          </button>
        </header>
        <div className="graphics-debug__presets" role="group" aria-label="Graphics preset">
          {[false, true].map((enabled) => (
            <button
              key={String(enabled)}
              type="button"
              aria-pressed={controls.every(([key]) => state[key] === enabled)}
              onClick={() => setAllGraphicsFeatures(enabled)}
            >
              {enabled ? "Updated" : "Original"}
            </button>
          ))}
        </div>
        <div className="graphics-debug__features">
          {controls.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                role="switch"
                checked={state[key]}
                onChange={(event) => setGraphicsFeatures({ [key]: event.currentTarget.checked })}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
