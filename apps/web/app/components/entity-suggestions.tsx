"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { entityHref } from "@backinit/domain";
import { searchResultSchema, type RemoteEntity } from "../lib/entity-model";
import { Crest } from "./marks";
const snapshots = new Map<string, { data: RemoteEntity[]; at: number }>();
export function useEntitySearch(query: string, revision = 0) {
  const [data, setData] = useState<RemoteEntity[]>([]);
  const [pending, setPending] = useState(false);
  const [settledQuery, setSettledQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setData([]);
    setError("");
    const q = query.trim().slice(0, 80);
    if (q.length < 2) {
      setPending(false);
      return;
    }
    const cached = snapshots.get(q.toLowerCase());
    if (cached && Date.now() - cached.at < 60000) {
      setData(cached.data);
      setSettledQuery(q);
      setPending(false);
      return;
    }
    const c = new AbortController();
    setPending(true);
    const timer = setTimeout(() => {
      const load = async () => {
        try {
          let body: ReturnType<typeof searchResultSchema.parse> | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await fetch(
                `/api/search?${new URLSearchParams({ q })}`,
                {
                  signal: AbortSignal.any([
                    c.signal,
                    AbortSignal.timeout(12000),
                  ]),
                  cache: "no-store",
                },
              );
              if (!response.ok) throw Error("Search request failed");
              body = searchResultSchema.parse(await response.json());
              if (!body.partial || attempt === 1) break;
            } catch (failure) {
              if (!c.signal.aborted && attempt === 1 && body) break;
              if (c.signal.aborted || attempt === 1) throw failure;
            }
          }
          if (c.signal.aborted || !body) return;
          setData(body.data);
          if (body.partial)
            setError("Some player or team results could not load.");
          else {
            if (snapshots.size >= 20)
              snapshots.delete(snapshots.keys().next().value!);
            snapshots.set(q.toLowerCase(), { data: body.data, at: Date.now() });
          }
        } catch {
          if (!c.signal.aborted)
            setError("Team and player search could not load.");
        } finally {
          if (!c.signal.aborted) {
            setPending(false);
            setSettledQuery(q);
          }
        }
      };
      void load();
    }, 300);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, revision]);
  return {
    data,
    pending:
      pending ||
      (query.trim().length >= 2 && settledQuery !== query.trim().slice(0, 80)),
    error,
  };
}
export function EntitySuggestions({
  query,
  sport,
  kind,
}: {
  query: string;
  sport?: string;
  kind?: "team" | "athlete" | "competition";
}) {
  const [revision, setRevision] = useState(0);
  const { data, pending, error } = useEntitySearch(query, revision);
  if (query.trim().length < 2) return null;
  const items = data.filter(
    (e) => (!sport || e.sport === sport) && (!kind || e.kind === kind),
  );
  return (
    <section
      className="entity-suggestions"
      aria-label="Matching teams and players"
    >
      {pending && (
        <p className="fine" role="status">
          Finding teams and players…
        </p>
      )}
      {error && (
        <p className="fine" role="status">
          {error}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>
            Retry search
          </button>{" "}
          <Link href={`/search?${new URLSearchParams({ q: query })}`}>
            Search all sport →
          </Link>
        </p>
      )}
      {!pending && !error && items.length === 0 && (
        <p>
          No matching{" "}
          {kind === "athlete"
            ? "players"
            : kind === "team"
              ? "teams"
              : "teams or players"}{" "}
          found.
        </p>
      )}
      {items.length > 0 && (
        <>
          <h2>Teams & players</h2>
          <div className="search-entity-grid">
            {items.slice(0, 6).map((e) => (
              <Link
                key={`${e.providerSport}:${e.league}:${e.kind}:${e.id}`}
                href={entityHref(e.kind, e.name, e.sport, e)}
              >
                <Crest name={e.name} imageUrl={e.image} />
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {e.kind === "athlete" ? "Player" : "Team"} · {e.sport}{" "}
                    {e.league ? `· ${e.league.toUpperCase()}` : ""}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
