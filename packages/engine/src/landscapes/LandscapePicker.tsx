import { useId } from "react";
import { landscapes, chooseLandscape, useLandscape, type Landscape } from "./landscape-preference";
import "./landscape-picker.css";

export function LandscapePicker({ home }: { home: string }) {
  const selected = useLandscape(home);
  const group = useId();
  return (
    <fieldset className="landscape-picker">
      <legend>Landscape</legend>
      <div className="landscape-picker__choices">
        {(Object.keys(landscapes) as Landscape[]).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={group}
              value={value}
              checked={selected === value}
              onChange={() => chooseLandscape(home, value)}
            />
            <span className="landscape-picker__tile">
              <span
                className={`landscape-picker__image landscape-picker__image--${value}`}
                aria-hidden="true"
              />
              <span>{landscapes[value]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
