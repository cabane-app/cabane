import type { EntityId, EntityStateSnapshot } from "./types";
import {
  canceledClimateRangeEdit,
  climateRangeForContext,
  resolveClimateRangeCall,
  type SupportedServiceCall,
} from "./home-assistant-controls";

export const VALUE_DEBOUNCE_MS = 500;
export const DEVICE_THROTTLE_MS = 2_000;
export const CONTINUOUS_VALUE_THROTTLE_MS = 250;
const CLIMATE_CONFIRMATION_MS = 10_000;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;
type ClimateRangeWrite = NonNullable<ReturnType<typeof resolveClimateRangeCall>>;
type ClimateConfirmationResult = "reported" | "canceled" | "timed-out";

interface ClimateConfirmation {
  entityId: EntityId;
  observe: (entity: EntityStateSnapshot | undefined) => void;
  wait: () => Promise<ClimateConfirmationResult>;
  cancel: () => void;
}

interface PendingWaiter {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

interface PendingValue {
  entityId: EntityId;
  call: SupportedServiceCall;
  sequence: number;
  updatedAt: number;
  waiters: PendingWaiter[];
}

interface DeviceQueue {
  lastDispatchAt: number;
  pending: Map<string, PendingValue>;
  timer: TimerHandle | null;
  climateRangeInFlight: PendingValue | null;
}

export interface DeviceCommandSchedulerOptions {
  dispatch: (call: SupportedServiceCall) => Promise<unknown>;
  resolveDeviceKey: (entityId: EntityId) => string;
  debounceMs?: number;
  throttleMs?: number;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
}

export class DeviceCommandScheduler {
  private readonly dispatch: DeviceCommandSchedulerOptions["dispatch"];
  private readonly resolveDeviceKey: DeviceCommandSchedulerOptions["resolveDeviceKey"];
  private readonly debounceMs: number;
  private readonly throttleMs: number;
  private readonly now: () => number;
  private readonly setTimer: NonNullable<DeviceCommandSchedulerOptions["setTimer"]>;
  private readonly clearTimer: NonNullable<DeviceCommandSchedulerOptions["clearTimer"]>;
  private readonly queues = new Map<string, DeviceQueue>();
  private readonly climateConfirmations = new Set<ClimateConfirmation>();
  private entityStates: Readonly<Partial<Record<EntityId, EntityStateSnapshot>>> = {};
  private nextSequence = 0;
  private disposed = false;

  constructor(options: DeviceCommandSchedulerOptions) {
    this.dispatch = options.dispatch;
    this.resolveDeviceKey = options.resolveDeviceKey;
    this.debounceMs = options.debounceMs ?? VALUE_DEBOUNCE_MS;
    this.throttleMs = options.throttleMs ?? DEVICE_THROTTLE_MS;
    this.now = options.now ?? Date.now;
    this.setTimer =
      options.setTimer ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
    this.clearTimer = options.clearTimer ?? ((timer) => globalThis.clearTimeout(timer));
  }

  schedule(call: SupportedServiceCall): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error("The command scheduler is stopped."));
    const target = call.target.entity_id;
    const entityId = (Array.isArray(target) ? target[0] : target) as EntityId | undefined;
    if (!entityId)
      return Promise.reject(new Error("A service call requires an exact entity target."));
    const queue = this.queueFor(this.resolveDeviceKey(entityId));

    if (!call.delivery) {
      this.cancelQueue(queue);
      queue.lastDispatchAt = this.now();
      try {
        return this.dispatch(call);
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error("Operation failed.", { cause: error }),
        );
      }
    }

    const channelKey = `${entityId}:${call.delivery.channel}`;
    const existing = queue.pending.get(channelKey);
    const promise = new Promise<unknown>((resolve, reject) => {
      if (existing) {
        const earlierEdit = existing.call.climateRangeEdit;
        const edit = call.climateRangeEdit;
        existing.call =
          earlierEdit && edit && earlierEdit.context === edit.context
            ? {
                ...call,
                climateRangeEdit: { ...edit, targets: { ...earlierEdit.targets, ...edit.targets } },
              }
            : call;
        existing.updatedAt = this.now();
        existing.waiters.push({ resolve, reject });
      } else {
        queue.pending.set(channelKey, {
          entityId,
          call,
          sequence: this.nextSequence++,
          updatedAt: this.now(),
          waiters: [{ resolve, reject }],
        });
      }
    });
    this.scheduleNext(queue);
    return promise;
  }

  observeEntityStates(states: Readonly<Partial<Record<EntityId, EntityStateSnapshot>>>): void {
    this.entityStates = states;
    for (const confirmation of this.climateConfirmations) {
      confirmation.observe(states[confirmation.entityId]);
    }
  }

  cancelPendingValues(): void {
    for (const queue of this.queues.values()) {
      this.cancelQueue(queue);
      queue.climateRangeInFlight = null;
    }
    for (const confirmation of this.climateConfirmations) confirmation.cancel();
    this.entityStates = {};
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPendingValues();
    this.queues.clear();
  }

  private queueFor(key: string) {
    const existing = this.queues.get(key);
    if (existing) return existing;
    const queue: DeviceQueue = {
      lastDispatchAt: Number.NEGATIVE_INFINITY,
      pending: new Map(),
      timer: null,
      climateRangeInFlight: null,
    };
    this.queues.set(key, queue);
    return queue;
  }

  private cancelQueue(queue: DeviceQueue) {
    if (queue.timer !== null) this.clearTimer(queue.timer);
    queue.timer = null;
    for (const pending of queue.pending.values()) {
      const result = pending.call.climateRangeEdit ? canceledClimateRangeEdit : undefined;
      for (const waiter of pending.waiters) waiter.resolve(result);
    }
    queue.pending.clear();
  }

  private nextValue(queue: DeviceQueue) {
    return [...queue.pending.entries()]
      .filter(([, pending]) => !pending.call.climateRangeEdit || !queue.climateRangeInFlight)
      .sort(([, left], [, right]) => left.sequence - right.sequence)[0];
  }

  private scheduleNext(queue: DeviceQueue) {
    if (queue.timer !== null) this.clearTimer(queue.timer);
    queue.timer = null;
    const next = this.nextValue(queue)?.[1];
    if (!next) return;
    const continuous = next.call.delivery?.mode === "continuous-value";
    const dueAt = continuous
      ? queue.lastDispatchAt + CONTINUOUS_VALUE_THROTTLE_MS
      : Math.max(queue.lastDispatchAt + this.throttleMs, next.updatedAt + this.debounceMs);
    queue.timer = this.setTimer(
      () => {
        queue.timer = null;
        void this.flushNext(queue);
      },
      Math.max(0, dueAt - this.now()),
    );
  }

  private trackClimateConfirmation(entityId: EntityId, { edit, previous }: ClimateRangeWrite) {
    const awaiting = new Set(
      (["low", "high"] as const).filter(
        (endpoint) =>
          edit.targets[endpoint] !== undefined && edit.targets[endpoint] !== previous[endpoint],
      ),
    );
    if (!awaiting.size) return null;

    let settle!: (result: ClimateConfirmationResult) => void;
    const result = new Promise<ClimateConfirmationResult>((resolve) => {
      settle = resolve;
    });
    let timer: TimerHandle | null = null;
    const finish = (outcome: ClimateConfirmationResult) => {
      if (!this.climateConfirmations.delete(confirmation)) return;
      if (timer !== null) this.clearTimer(timer);
      settle(outcome);
    };
    const confirmation: ClimateConfirmation = {
      entityId,
      observe: (entity) => {
        const range = climateRangeForContext(entity, edit.context);
        if (!range) {
          finish("canceled");
          return;
        }
        for (const endpoint of awaiting) {
          if (range[endpoint] !== previous[endpoint]) awaiting.delete(endpoint);
        }
        if (!awaiting.size) finish("reported");
      },
      wait: () => {
        if (this.climateConfirmations.has(confirmation)) {
          timer = this.setTimer(() => finish("timed-out"), CLIMATE_CONFIRMATION_MS);
        }
        return result;
      },
      cancel: () => finish("canceled"),
    };
    // Track state even when it arrives before the service response.
    this.climateConfirmations.add(confirmation);
    return confirmation;
  }

  private async flushNext(queue: DeviceQueue) {
    if (this.disposed) return;
    const next = this.nextValue(queue);
    if (!next) return;
    const [key, pending] = next;
    queue.pending.delete(key);
    queue.lastDispatchAt = this.now();
    const rangeEdit = pending.call.climateRangeEdit;
    if (rangeEdit) queue.climateRangeInFlight = pending;
    this.scheduleNext(queue);
    let confirmation: ClimateConfirmation | null = null;
    try {
      const write = rangeEdit
        ? resolveClimateRangeCall(pending.call, this.entityStates[pending.entityId])
        : null;
      if (write) confirmation = this.trackClimateConfirmation(pending.entityId, write);
      let result = await this.dispatch(write?.call ?? pending.call);
      if (confirmation) {
        const outcome = await confirmation.wait();
        if (outcome === "timed-out") {
          const error = new Error("Home Assistant did not report the updated climate targets.");
          const queued = queue.pending.get(key);
          if (rangeEdit && queued?.call.climateRangeEdit?.context === rangeEdit.context) {
            queue.pending.delete(key);
            for (const waiter of queued.waiters) waiter.reject(error);
          }
          throw error;
        }
        if (outcome === "canceled") result = canceledClimateRangeEdit;
      }
      for (const waiter of pending.waiters) waiter.resolve(result);
    } catch (error) {
      for (const waiter of pending.waiters)
        waiter.reject(
          error instanceof Error ? error : new Error("Operation failed.", { cause: error }),
        );
    } finally {
      confirmation?.cancel();
      if (queue.climateRangeInFlight === pending) {
        queue.climateRangeInFlight = null;
        this.scheduleNext(queue);
      }
    }
  }
}
