/**
 * Runs `task` over `items` with at most `limit` in flight, stopping early once
 * `withinBudget()` turns false — the remaining items are simply never started.
 * Returns how many were, so a caller can report what a spent budget cost.
 */
export async function mapWithLimit<T>(
  items: T[],
  limit: number,
  withinBudget: () => boolean,
  task: (item: T) => Promise<void>,
): Promise<number> {
  let next = 0;
  let started = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && withinBudget()) {
      const index = next++;
      started++;
      await task(items[index]);
    }
  });

  await Promise.all(workers);
  return started;
}
