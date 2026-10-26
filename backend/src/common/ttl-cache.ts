/**
 * A small in-memory cache with an expiry per entry and a cap on entries,
 * oldest evicted first. Values are usually promises, so concurrent callers
 * for one key share a single upstream request instead of racing it.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    // Maps iterate in insertion order, so the first key is the oldest.
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as K;
      this.entries.delete(oldest);
    }
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  /** The cached value, or `load()`'s — a rejected load is dropped so the next caller retries. */
  getOrLoad(key: K, load: () => V): V {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = load();
    this.set(key, value);
    if (value instanceof Promise) value.catch(() => this.delete(key));
    return value;
  }
}
