// CI keeps software WebGL serial while Node/DOM uses the other shared workers.
// Local hardware graphics can overlap. Unit-only selections use every worker.
export function assignTestShards(files, shardCount, { serialBrowser = false } = {}) {
  const shards = Array.from({ length: shardCount }, () => ({ cost: 0, files: [] }));
  const hasBrowser = serialBrowser && files.some((file) => file.browser);
  for (const file of [...files].sort(
    (left, right) => right.cost - left.cost || left.name.localeCompare(right.name),
  )) {
    const candidates =
      hasBrowser && shardCount > 1 ? (file.browser ? shards.slice(0, 1) : shards.slice(1)) : shards;
    const shard = candidates.reduce((lightest, candidate) =>
      candidate.cost < lightest.cost ? candidate : lightest,
    );
    shard.files.push(file.name);
    shard.cost += file.cost;
  }
  return shards.map((shard) => shard.files.sort());
}
