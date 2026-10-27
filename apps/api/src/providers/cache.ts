/** Single-process bounded cache. Deduplicates in-flight loads, honors Retry-After,
 * serves explicitly stale snapshots for at most 24h, never stores failures as data.
 * A shared cache/ingester is required before running multiple API replicas. */
export class ProviderCache {
  private entries = new Map<string, { value: unknown; fetchedAt: number }>();
  private pending = new Map<string, Promise<unknown>>();
  private blockedUntil = new Map<string, number>();
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now = Date.now,
  ) {}
  async json<T>(
    url: string,
    ttl: number,
    parse: (raw: unknown) => T,
    headers: Record<string, string> = {},
    read: (response: Response) => Promise<unknown> = (response) =>
      response.json(),
  ) {
    const old = this.entries.get(url);
    const wrap = (value: T, at: number, stale: boolean) => ({
      value,
      fetchedAt: new Date(at).toISOString(),
      stale,
    });
    if (old && this.now() - old.fetchedAt < ttl)
      return wrap(old.value as T, old.fetchedAt, false);
    try {
      if ((this.blockedUntil.get(new URL(url).host) ?? 0) > this.now())
        throw new Error("Provider cooling down");
      let task = this.pending.get(url);
      if (!task) {
        task = (async () => {
          const response = await this.fetcher(url, {
            headers: {
              "User-Agent":
                "BackInIt/0.2 (+https://github.com/DouglasBagambe/backinit)",
              ...headers,
            },
            signal: AbortSignal.timeout(8000),
            redirect: "error",
          });
          if (!response.ok) {
            const retry = response.headers.get("retry-after");
            const seconds =
              retry && /^\d+$/.test(retry)
                ? Number(retry) * 1000
                : retry
                  ? Date.parse(retry) - this.now()
                  : 60000;
            if (response.status === 429 || response.status >= 500)
              this.blockedUntil.set(
                new URL(url).host,
                this.now() +
                  Math.min(
                    3600000,
                    Math.max(60000, Number.isFinite(seconds) ? seconds : 60000),
                  ),
              );
            throw new Error(`Provider HTTP ${response.status}`);
          }
          const data = parse(await read(response));
          if (this.entries.size >= 64 && !this.entries.has(url))
            this.entries.delete(this.entries.keys().next().value!);
          this.entries.set(url, { value: data, fetchedAt: this.now() });
          return data;
        })();
        this.pending.set(url, task);
        void task.finally(() => this.pending.delete(url)).catch(() => {});
      }
      const data = (await task) as T;
      return wrap(data, this.entries.get(url)!.fetchedAt, false);
    } catch (error) {
      if (old && this.now() - old.fetchedAt <= 86400000)
        return wrap(old.value as T, old.fetchedAt, true);
      throw error;
    }
  }
}
