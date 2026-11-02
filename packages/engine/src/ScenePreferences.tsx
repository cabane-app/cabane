import { useState } from "react";
import { useSceneStyle, setSceneStyle } from "./scene-style";
import { useMeasurementUnits, setMeasurementUnits } from "./measurement-units";
import {
  loadInvertYAxis,
  saveInvertYAxis,
  loadLightingMode,
  saveLightingMode,
} from "./walk-preferences";
import {
  overlayOptions,
  loadOverlayPreferences,
  saveOverlayPreferences,
} from "./room-status/overlay-preferences";
import { WeatherPreferences } from "./weather/WeatherPreferences";
import { useWeatherController } from "./weather/useWeatherController";
import { useHomeAssistantRuntime } from "./HomeAssistantRuntime";
import { createEmptyRuntimeBindingProfile } from "./runtime-binding-profile";
import type { RuntimeBindingProfile } from "./types";
import type { WeatherSource } from "./weather/weather-state";
import "./walk-preferences.css";

export function ScenePreferences({
  section,
  profile,
  onWeatherSourceChange,
}: {
  section: "orbital-view" | "editor" | "explore";
  profile?: RuntimeBindingProfile;
  onWeatherSourceChange?: ((source: WeatherSource) => Promise<void>) | undefined;
}) {
  const units = useMeasurementUnits();
  const sceneStyle = useSceneStyle();
  const [overlayPreferences, setOverlayPreferences] = useState(loadOverlayPreferences);
  const [inverted, setInverted] = useState(loadInvertYAxis);
  const [lightingMode, setLightingMode] = useState(loadLightingMode);
  const onOverlayPreferencesChange = (value: typeof overlayPreferences) => {
    setOverlayPreferences(value);
    saveOverlayPreferences(value);
  };
  const onChange = (value: boolean) => {
    setInverted(value);
    saveInvertYAxis(value);
  };
  const onLightingModeChange = (value: typeof lightingMode) => {
    setLightingMode(value);
    saveLightingMode(value);
  };
  const runtime = useHomeAssistantRuntime();
  const weather = useWeatherController(
    runtime,
    {
      profile: profile ?? createEmptyRuntimeBindingProfile("settings"),
      loaded: true,
      hasStoredProfile: Boolean(profile),
      save: () => undefined,
      saveWeatherSource: onWeatherSourceChange,
    },
    0,
    false,
  );
  return (
    <div className="scene-preferences">
      {section === "orbital-view" && (
        <>
          <div className="walk-preferences__group">
            <h3>Visual style</h3>
            <fieldset className="walk-preferences__choices">
              <legend>3D home appearance</legend>
              {(
                [
                  ["default", "Default"],
                  ["sims", "Sims"],
                ] as const
              ).map(([style, label]) => (
                <label key={style}>
                  <input
                    type="radio"
                    name="scene-style"
                    value={style}
                    checked={sceneStyle === style}
                    onChange={() => setSceneStyle(style)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <p className="walk-preferences__hint">
              Sims uses faceted models, a richer palette and stronger lighting. Saved on this
              device.
            </p>
          </div>
          <div className="walk-preferences__group">
            <h3>Room overlays</h3>
            <p className="walk-preferences__hint">
              Choose what appears below room names in overview. Available readings only.
            </p>
            {overlayOptions.map(([key, label]) => (
              <label className="walk-preferences__row walk-preferences__row--compact" key={key}>
                <span>
                  <strong>{label}</strong>
                </span>
                <input
                  type="checkbox"
                  checked={overlayPreferences[key]}
                  onChange={(event) =>
                    onOverlayPreferencesChange({
                      ...overlayPreferences,
                      [key]: event.target.checked,
                    })
                  }
                />
                <span className="walk-preferences__switch" aria-hidden="true" />
              </label>
            ))}
          </div>
          <div className="walk-preferences__group">
            <h3>Lighting</h3>
            <fieldset className="walk-preferences__choices">
              <legend>Time of day</legend>
              {(
                [
                  ["day", "Always day"],
                  ["night", "Always night"],
                  ["live", "Auto"],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name="walk-lighting-mode"
                    value={mode}
                    checked={lightingMode === mode}
                    onChange={() => onLightingModeChange(mode)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <p className="walk-preferences__hint">
              Exterior lighting. Auto follows Home Assistant, then your local time.
            </p>
          </div>
          <WeatherPreferences weather={weather} />
        </>
      )}
      {section === "editor" && (
        <>
          <div className="walk-preferences__group">
            <h3>Units</h3>
            <fieldset className="walk-preferences__choices">
              <legend>Length and area</legend>
              {(
                [
                  ["metric", "Metric (m, m²)"],
                  ["imperial", "Imperial (ft, ft²)"],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="measurement-units"
                    value={value}
                    checked={units === value}
                    onChange={() => setMeasurementUnits(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <p className="walk-preferences__hint">
              Applies to editor measurements. You can also enter lengths such as 90 cm or 5' 6".
            </p>
          </div>
        </>
      )}
      {section === "explore" && (
        <>
          <div className="walk-preferences__group">
            <h3>Look controls</h3>
            <label className="walk-preferences__row">
              <span>
                <strong>Invert Y axis</strong>
                <small>Move down to look up while walking or exploring.</small>
              </span>
              <input
                type="checkbox"
                checked={inverted}
                onChange={(event) => onChange(event.target.checked)}
              />
              <span className="walk-preferences__switch" aria-hidden="true" />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
