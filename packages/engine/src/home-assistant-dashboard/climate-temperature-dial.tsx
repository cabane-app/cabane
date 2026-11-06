import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DOMAttributes,
  type PointerEvent,
} from "react";

import {
  canceledClimateRangeEdit,
  climateTemperatureRangeCall,
  type ClimateRangeTarget,
  type ClimateTemperaturePair,
  type SupportedServiceCall,
} from "../home-assistant-controls";
import type { EntityStateSnapshot } from "../types";

const endpoints = { low: "Heating", high: "Cooling" } as const;
type Endpoint = keyof typeof endpoints;
type TargetPair = ClimateTemperaturePair;

const dialCenter = 100;
const dialRadius = 76;
const dialStartAngle = (3 * Math.PI) / 4;
const dialSweep = (3 * Math.PI) / 2;
const dialArcLength = 75;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const dialProgress = (value: number, min: number, max: number) =>
  clamp((value - min) / Math.max(Number.EPSILON, max - min), 0, 1);

const dialPoint = (progress: number) => {
  const angle = dialStartAngle + progress * dialSweep;
  return {
    cx: dialCenter + Math.cos(angle) * dialRadius,
    cy: dialCenter + Math.sin(angle) * dialRadius,
  };
};

function DialArc({ from, to, endpoint }: { from: number; to: number; endpoint?: Endpoint }) {
  const length = (to - from) * dialArcLength;
  return (
    <circle
      className={endpoint ? "vtherm-dial__range" : "vtherm-dial__value"}
      data-endpoint={endpoint}
      cx={dialCenter}
      cy={dialCenter}
      r={dialRadius}
      pathLength="100"
      strokeDasharray={`${length} ${100 - length}`}
      strokeDashoffset={-from * dialArcLength}
    />
  );
}

type DialPointerEvent = PointerEvent<HTMLDivElement>;
type DialThumbs = Pick<
  DOMAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture"
> & {
  disabled: boolean;
};

type TemperatureDialProps = {
  min: number;
  max: number;
  current: number;
  target: number | TargetPair;
  selected?: Endpoint;
  thumbs?: DialThumbs | undefined;
};

export function ClimateTemperatureDial({
  min,
  max,
  current,
  target,
  selected,
  thumbs,
}: TemperatureDialProps) {
  const currentProgress = Number.isFinite(current) ? dialProgress(current, min, max) : null;
  const scalarProgress = typeof target === "number" ? dialProgress(target, min, max) : null;
  const range =
    typeof target === "number"
      ? null
      : { low: dialProgress(target.low, min, max), high: dialProgress(target.high, min, max) };
  const opposite = selected === "high" ? "low" : "high";
  const markerOrder = [opposite, selected ?? "low"] as const;
  const reference = currentProgress ?? scalarProgress;

  return (
    <div className="vtherm-dial" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <circle
          className="vtherm-dial__track"
          cx={dialCenter}
          cy={dialCenter}
          r={dialRadius}
          pathLength="100"
        />
        {scalarProgress !== null && reference !== null && (
          <DialArc
            from={Math.min(scalarProgress, reference)}
            to={Math.max(scalarProgress, reference)}
          />
        )}
        {range && (
          <>
            <DialArc from={0} to={range.low} endpoint="low" />
            <DialArc from={range.high} to={1} endpoint="high" />
          </>
        )}
        {currentProgress !== null && (
          <circle
            className="vtherm-dial__marker vtherm-dial__marker--current"
            {...dialPoint(currentProgress)}
            r="4"
          />
        )}
        {scalarProgress !== null && (
          <circle
            className="vtherm-dial__marker vtherm-dial__marker--target"
            {...dialPoint(scalarProgress)}
            r="5"
          />
        )}
        {range &&
          markerOrder.map((endpoint) => (
            <circle
              key={endpoint}
              className="vtherm-dial__marker vtherm-dial__marker--range"
              data-endpoint={endpoint}
              data-selected={endpoint === selected}
              {...dialPoint(range[endpoint])}
              r="6"
            />
          ))}
      </svg>
      {range &&
        thumbs &&
        (["low", "high"] as const).map((endpoint) => {
          const { cx, cy } = dialPoint(range[endpoint]);
          const { disabled, ...pointerEvents } = thumbs;
          return (
            <div
              key={endpoint}
              className="vtherm-dial__thumb"
              data-endpoint={endpoint}
              data-selected={endpoint === selected}
              data-disabled={disabled}
              style={{ left: `${cx / 2}%`, top: `${cy / 2}%` }}
              {...pointerEvents}
            />
          );
        })}
    </div>
  );
}

function steppedTarget(
  pair: TargetPair,
  endpoint: Endpoint,
  steps: number,
  { min, max, step }: ClimateRangeTarget,
) {
  const value = pair[endpoint];
  const lower = endpoint === "low" ? min : pair.low;
  const upper = endpoint === "low" ? pair.high : max;
  const minimumSteps = Math.ceil(Number(((lower - value) / step).toFixed(6)));
  const maximumSteps = Math.floor(Number(((upper - value) / step).toFixed(6)));
  const delta = clamp(steps, minimumSteps, maximumSteps);
  return delta === 0 ? value : clamp(Number((value + delta * step).toFixed(6)), lower, upper);
}

type DragPreview = {
  basis: TargetPair;
  endpoint: Endpoint;
  temperature: number;
};

type RangeDrag = DragPreview & {
  pointerId: number;
  angle: number;
  progress: number;
  startX: number;
  startY: number;
  moved: boolean;
};

const pointAtPointer = (event: DialPointerEvent) => {
  const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
  if (!bounds?.width || !bounds.height) return null;
  const x = ((event.clientX - bounds.left) / bounds.width) * 2 * dialCenter;
  const y = ((event.clientY - bounds.top) / bounds.height) * 2 * dialCenter;
  return { x, y, angle: Math.atan2(y - dialCenter, x - dialCenter) };
};

type EndpointEdit = {
  value: number;
  baseline: number;
  revision: string | undefined;
  pending: boolean;
};
const emptyEdits: Record<Endpoint, EndpointEdit | null> = { low: null, high: null };

function useRangeCommand(
  entity: EntityStateSnapshot,
  target: ClimateRangeTarget,
  enabled: boolean,
  onCallService: (call: SupportedServiceCall) => Promise<unknown>,
) {
  const { low, high } = target;
  const revision = entity.lastUpdated ?? entity.lastConfirmedAt;
  const [edits, setEdits] = useState(emptyEdits);
  const [error, setError] = useState(false);
  const latest = useRef<EndpointEdit | null>(null);
  const retainEdit = (edit: EndpointEdit | null, baseline: number) =>
    enabled && edit && (edit.pending || (edit.baseline === baseline && edit.revision === revision))
      ? edit
      : null;
  const lowEdit = retainEdit(edits.low, low);
  const highEdit = retainEdit(edits.high, high);
  useLayoutEffect(() => {
    if (lowEdit !== edits.low || highEdit !== edits.high)
      setEdits({ low: lowEdit, high: highEdit });
    if (!enabled) {
      latest.current = null;
      setError(false);
    }
  }, [edits, enabled, highEdit, lowEdit]);

  const optimisticLow = lowEdit?.value ?? low;
  const optimisticHigh = highEdit?.value ?? high;
  const shownLow = optimisticLow <= optimisticHigh ? optimisticLow : low;
  const shownHigh = optimisticLow <= optimisticHigh ? optimisticHigh : high;
  const value = useMemo(() => ({ low: shownLow, high: shownHigh }), [shownLow, shownHigh]);

  const run = async (endpoint: Endpoint, temperature: number) => {
    if (!enabled || temperature === value[endpoint]) return;
    const edit = { value: temperature, baseline: target[endpoint], revision, pending: true };
    latest.current = edit;
    setEdits((current) => ({ ...current, [endpoint]: edit }));
    setError(false);
    const settle = (next: EndpointEdit | null) =>
      setEdits((current) =>
        current[endpoint] === edit ? { ...current, [endpoint]: next } : current,
      );
    try {
      const pair = { ...value, [endpoint]: temperature };
      const result = await onCallService(
        climateTemperatureRangeCall(entity, target, pair, endpoint),
      );
      settle(result === canceledClimateRangeEdit ? null : { ...edit, pending: false });
    } catch {
      settle(null);
      if (latest.current === edit) setError(true);
    }
  };
  return { value, run, pending: Boolean(lowEdit?.pending || highEdit?.pending), error };
}

export function ClimateRangeDial({
  entity,
  label,
  unit,
  current,
  target,
  enabled,
  onCallService,
}: {
  entity: EntityStateSnapshot;
  label: string;
  unit: string;
  current: number;
  target: ClimateRangeTarget;
  enabled: boolean;
  onCallService: (call: SupportedServiceCall) => Promise<unknown>;
}) {
  const { min, max, step } = target;
  const command = useRangeCommand(entity, target, enabled, onCallService);
  const [selection, setSelection] = useState<Endpoint | null>(null);
  const selected = selection ?? (entity.state === "cool" ? "high" : "low");
  const drag = useRef<RangeDrag | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  useLayoutEffect(() => {
    const gesture = drag.current;
    if (gesture && (!enabled || gesture.basis !== command.value)) {
      drag.current = null;
      setPreview(null);
    }
  }, [command.value, enabled]);
  const previewIsCurrent = (candidate: DragPreview) => enabled && candidate.basis === command.value;
  const activePreview = preview && previewIsCurrent(preview) ? preview : null;
  const displayedPair = activePreview
    ? { ...command.value, [activePreview.endpoint]: activePreview.temperature }
    : command.value;
  const selectedLabel = `${label} ${endpoints[selected].toLowerCase()} target temperature`;

  const readDrag = (event: DialPointerEvent) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !previewIsCurrent(gesture))
      return null;
    const point = pointAtPointer(event);
    if (!point) return null;
    if (
      !gesture.moved &&
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 4
    ) {
      return null;
    }
    gesture.moved = true;
    const turn = point.angle - gesture.angle;
    gesture.angle = point.angle;
    // Unwrap the pointer angle at the left edge so the dial never jumps across the seam.
    gesture.progress = clamp(
      gesture.progress + Math.atan2(Math.sin(turn), Math.cos(turn)) / dialSweep,
      0,
      1,
    );
    const desired = min + gesture.progress * (max - min);
    const steps = Math.round((desired - gesture.basis[gesture.endpoint]) / step);
    return {
      basis: gesture.basis,
      endpoint: gesture.endpoint,
      temperature: steppedTarget(gesture.basis, gesture.endpoint, steps, target),
    };
  };
  const cancelDrag = (event: DialPointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setPreview(null);
  };
  const thumbs: DialThumbs = {
    disabled: !enabled,
    onPointerDown(event) {
      if (!enabled || event.button !== 0 || drag.current) return;
      const point = pointAtPointer(event);
      if (!point) return;
      const distanceTo = (endpoint: Endpoint) => {
        const { cx, cy } = dialPoint(dialProgress(command.value[endpoint], min, max));
        return Math.hypot(point.x - cx, point.y - cy);
      };
      // When touch targets overlap, start from the closest visible marker.
      const distanceToLow = distanceTo("low");
      const distanceToHigh = distanceTo("high");
      const endpoint =
        distanceToLow === distanceToHigh
          ? selected
          : distanceToLow < distanceToHigh
            ? "low"
            : "high";
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelection(endpoint);
      const initial = {
        basis: command.value,
        endpoint,
        temperature: command.value[endpoint],
      };
      drag.current = {
        ...initial,
        pointerId: event.pointerId,
        angle: point.angle,
        progress: dialProgress(initial.temperature, min, max),
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      setPreview(initial);
    },
    onPointerMove(event) {
      const next = readDrag(event);
      if (next) setPreview(next);
    },
    onPointerUp(event) {
      const next = readDrag(event);
      cancelDrag(event);
      if (next) void command.run(next.endpoint, next.temperature);
    },
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag,
  };

  return (
    <>
      <ClimateTemperatureDial
        min={min}
        max={max}
        current={current}
        target={displayedPair}
        selected={selected}
        thumbs={thumbs}
      />
      <div className="vtherm-temperature vtherm-temperature--range">
        <div
          className="climate-range__targets"
          role="group"
          aria-label="Temperature target to adjust"
        >
          {(["low", "high"] as const).map((endpoint) => (
            <button
              key={endpoint}
              type="button"
              className="climate-range__target"
              data-endpoint={endpoint}
              aria-label={`Select ${label} ${endpoints[endpoint].toLowerCase()} target, ${displayedPair[endpoint]} ${unit}`}
              aria-pressed={selected === endpoint}
              disabled={!enabled}
              onClick={() => setSelection(endpoint)}
            >
              <span className="climate-range__label">{endpoints[endpoint]}</span>
              <span className="climate-range__value">
                {displayedPair[endpoint]} <small>{unit}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="temperature-stepper" data-pending={command.pending ? "true" : "false"}>
          {([-1, 1] as const).map((direction) => {
            const next = steppedTarget(command.value, selected, direction, target);
            return (
              <button
                key={direction}
                type="button"
                aria-label={`${direction < 0 ? "Decrease" : "Increase"} ${selectedLabel}`}
                disabled={!enabled || Boolean(activePreview) || next === command.value[selected]}
                onClick={() => void command.run(selected, next)}
              >
                {direction < 0 ? "−" : "+"}
              </button>
            );
          })}
          {command.error && (
            <p role="alert" aria-live="assertive">
              Couldn’t update {label} target temperature range. Try again.
            </p>
          )}
        </div>
        <output className="visually-hidden" aria-live="polite">
          {endpoints[selected]} target {command.value[selected]} {unit}
        </output>
      </div>
    </>
  );
}
