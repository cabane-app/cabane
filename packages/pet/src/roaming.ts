export interface PetPoint {
  x: number;
  z: number;
}

export interface PetRoamingOptions {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Includes the animal's clearance, indoor support and current obstacles. */
  isWalkable: (point: PetPoint) => boolean;
  random?: () => number;
  spacing?: number;
  speed?: number;
  spawn?: PetPoint;
  initialYaw?: number;
}

export interface PetRoaming {
  readonly position: PetPoint | null;
  readonly yaw: number;
  readonly moving: boolean;
  readonly actualSpeed: number;
  readonly gaitSpeed: number;
  step: (deltaSeconds: number, target?: PetPoint | null) => void;
}

/** Floor-local roaming; all geometry knowledge stays in the injected predicate. */
export function createPetRoaming({
  bounds,
  isWalkable,
  random = Math.random,
  spacing = 0.25,
  speed = 0.28,
  spawn,
  initialYaw = 0,
}: PetRoamingOptions): PetRoaming {
  const { minX, maxX, minZ, maxZ } = bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const nodes: PetPoint[] = [];
  const neighbors: number[][] = [];
  const boundedRandom = () => Math.max(0, Math.min(0.999999, random()));
  const clearSegment = (from: PetPoint, to: PetPoint) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.05));
    if (steps > 2048) return false;
    for (let i = 0; i <= steps; i++) {
      const point = {
        x: from.x + ((to.x - from.x) * i) / steps,
        z: from.z + ((to.z - from.z) * i) / steps,
      };
      if (
        point.x < minX ||
        point.x > maxX ||
        point.z < minZ ||
        point.z > maxZ ||
        !isWalkable(point)
      )
        return false;
    }
    return true;
  };
  if (
    [minX, maxX, minZ, maxZ, spacing, speed].every(Number.isFinite) &&
    width > 0 &&
    depth > 0 &&
    spacing > 0 &&
    speed > 0
  ) {
    // Bound both memory and predicate work for very large or elongated plans.
    let columns = Math.ceil(width / spacing) + 1;
    let rows = Math.ceil(depth / spacing) + 1;
    while (columns * rows > 4096) {
      if (columns >= rows) columns = Math.max(2, Math.ceil(columns / 2));
      else rows = Math.max(2, Math.ceil(rows / 2));
    }
    const grid = new Int32Array(columns * rows).fill(-1);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const point = {
          x: minX + (width * column) / (columns - 1),
          z: minZ + (depth * row) / (rows - 1),
        };
        if (!isWalkable(point)) continue;
        const index = nodes.length;
        nodes.push(point);
        neighbors.push([]);
        grid[row * columns + column] = index;
        for (const previous of [
          column > 0 ? grid[row * columns + column - 1] : -1,
          row > 0 ? grid[(row - 1) * columns + column] : -1,
        ]) {
          if (previous >= 0 && clearSegment(nodes[previous], point)) {
            neighbors[index].push(previous);
            neighbors[previous].push(index);
          }
        }
      }
    }
  }
  const center = spawn ?? { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  let current = -1;
  let bestDistance = Infinity;
  nodes.forEach((point, index) => {
    const distance = Math.hypot(point.x - center.x, point.z - center.z);
    if (
      distance < bestDistance &&
      neighbors[index].length > 0 &&
      (!spawn || clearSegment(spawn, point))
    ) {
      current = index;
      bestDistance = distance;
    }
  });
  // A small valid island can still display an idle pet.
  if (!spawn && current < 0 && nodes.length > 0) current = 0;
  const position = spawn
    ? clearSegment(spawn, spawn)
      ? { ...spawn }
      : null
    : current < 0
      ? null
      : { ...nodes[current] };
  let route: PetPoint[] = [];
  let wait = 0.5;
  let yaw = Number.isFinite(initialYaw) ? initialYaw : 0;
  let actualSpeed = 0;
  let turningSpeed = 0;
  let velocity = 0;
  let replanAfter = 0;
  let lastTarget: PetPoint | null = null;
  let following = false;
  let blocked = false;

  const plan = (target?: PetPoint | null) => {
    if (!position) return [];
    // A smoothed route can leave the grid: reconnect from the actual position.
    let anchor = -1,
      nearest = Infinity;
    nodes.forEach((point, index) => {
      const distance = Math.hypot(point.x - position.x, point.z - position.z);
      if (distance < nearest && clearSegment(position, point)) {
        anchor = index;
        nearest = distance;
      }
    });
    if (anchor < 0) return [];
    const parents = new Int32Array(nodes.length).fill(-1);
    const queue = [anchor];
    parents[anchor] = anchor;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      for (const next of neighbors[index]) {
        if (parents[next] >= 0 || !clearSegment(nodes[index], nodes[next])) continue;
        parents[next] = index;
        queue.push(next);
      }
    }
    let destination = queue[Math.floor(boundedRandom() * queue.length)];
    if (target) {
      destination = queue.reduce(
        (best, index) =>
          Math.hypot(nodes[index].x - target.x, nodes[index].z - target.z) <
          Math.hypot(nodes[best].x - target.x, nodes[best].z - target.z)
            ? index
            : best,
        anchor,
      );
    }
    const path: PetPoint[] = [nodes[destination]];
    while (destination !== anchor) {
      destination = parents[destination];
      path.push(nodes[destination]);
    }
    path.reverse();
    if (target && clearSegment(path[path.length - 1], target)) path.push({ ...target });
    // Keep only collision-checked line-of-sight corners, never diagonal grid cuts.
    const smooth: PetPoint[] = [];
    let from = position,
      start = 0;
    while (start < path.length) {
      let end = path.length - 1;
      while (end > start && !clearSegment(from, path[end])) end--;
      if (Math.hypot(path[end].x - from.x, path[end].z - from.z) > 0.04) smooth.push(path[end]);
      from = path[end];
      start = end + 1;
    }
    return smooth;
  };

  return {
    get position() {
      return position;
    },
    get yaw() {
      return yaw;
    },
    get moving() {
      return actualSpeed > 0.001 || turningSpeed > 0.001;
    },
    get actualSpeed() {
      return actualSpeed;
    },
    get gaitSpeed() {
      return Math.max(actualSpeed, turningSpeed);
    },
    step(deltaSeconds, target) {
      actualSpeed = 0;
      turningSpeed = 0;
      if (
        !position ||
        !Number.isFinite(deltaSeconds) ||
        deltaSeconds <= 0 ||
        !isWalkable(position)
      ) {
        velocity = 0;
        return;
      }
      // Returning from a hidden tab must never fast-forward through the home.
      const dt = Math.min(deltaSeconds, 0.1);
      replanAfter = Math.max(0, replanAfter - dt);
      const nextFollowing = Boolean(
        target && Number.isFinite(target.x) && Number.isFinite(target.z),
      );
      if (nextFollowing !== following) {
        route = [];
        lastTarget = null;
        replanAfter = 0;
        wait = 0;
        following = nextFollowing;
      }
      if (following && target) {
        const changed =
          !lastTarget || Math.hypot(target.x - lastTarget.x, target.z - lastTarget.z) >= 0.4;
        if (replanAfter === 0 && (changed || blocked)) {
          route = plan(target);
          lastTarget = { ...target };
          replanAfter = 0.6;
          blocked = false;
        }
      } else {
        if (wait > 0) {
          wait -= dt;
          velocity = 0;
          return;
        }
        if (!route.length) {
          route = plan();
          if (!route.length) wait = 1;
        }
      }
      while (route.length && Math.hypot(route[0].x - position.x, route[0].z - position.z) <= 0.04)
        route.shift();
      if (!route.length) {
        velocity = 0;
        return;
      }
      const waypoint = route[0];
      const dx = waypoint.x - position.x,
        dz = waypoint.z - position.z;
      const distance = Math.hypot(dx, dz);
      const desiredYaw = Math.atan2(dx, dz);
      const difference = Math.atan2(Math.sin(desiredYaw - yaw), Math.cos(desiredYaw - yaw));
      // Keep stepping through an arc; smaller steps make a tight half-turn.
      const cornerSpeed = 0.45 + 0.55 * Math.max(0, Math.cos(difference));
      const desiredSpeed = Math.min(speed * cornerSpeed, distance * 1.8);
      const acceleration = desiredSpeed > velocity ? 0.65 : 1.3;
      velocity += Math.max(
        -acceleration * dt,
        Math.min(acceleration * dt, desiredSpeed - velocity),
      );
      const travel = Math.min(distance, velocity * dt);
      const turnRadius = 0.16;
      const turn = Math.max(-travel / turnRadius, Math.min(travel / turnRadius, difference));
      const nextYaw = yaw + turn;
      const next = {
        x: position.x + Math.sin(nextYaw) * travel,
        z: position.z + Math.cos(nextYaw) * travel,
      };
      if (!clearSegment(position, next)) {
        // In a tight corner, step around without translating into the obstacle.
        // The gait still advances in proportion to the feet's turning distance.
        const tightTurn = Math.max(-dt, Math.min(dt, difference));
        yaw += tightTurn;
        turningSpeed = (Math.abs(tightTurn) * turnRadius) / dt;
        route = [];
        velocity = 0;
        blocked = true;
        wait = 0;
        return;
      }
      yaw = nextYaw;
      turningSpeed = (Math.abs(turn) * turnRadius) / dt;
      actualSpeed = Math.hypot(next.x - position.x, next.z - position.z) / dt;
      position.x = next.x;
      position.z = next.z;
      if (Math.hypot(waypoint.x - position.x, waypoint.z - position.z) <= 0.04) {
        route.shift();
        if (!route.length && !following) wait = 0.75 + boundedRandom() * 2;
      }
    },
  };
}
