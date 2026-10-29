"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  eventTitle,
  sourceIsActive,
  type SportEvent,
  type StreamSource,
  type PlaybackReport,
} from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
const blank: StreamSource = {
  id: "",
  name: "",
  type: "hls",
  url: "",
  content: "sports",
  eventId: null,
  presentation: "live",
  rightsOwner: "",
  rightsEvidence: "",
  validFrom: "2026-10-28T00:00:00Z",
  validUntil: "2026-10-29T00:00:00Z",
  territory: "WORLD",
  revoked: true,
  version: 1,
};
type Check = {
  result: string;
  method: string;
  checkedAt: string;
  version: number;
};
export function Admin() {
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [fixtures, setFixtures] = useState<SportEvent[]>([]);
  const [checks, setChecks] = useState<Record<string, Check | null>>({});
  const [candidates, setCandidates] = useState<StreamSource[]>([]);
  const [selected, setSelected] = useState<StreamSource | null>(null);
  const [preview, setPreview] = useState<StreamSource | null>(null);
  const [probe, setProbe] = useState("");
  const [audit, setAudit] = useState<
    { id: number; action: string; target: string; at: string }[]
  >([]);
  const [message, setMessage] = useState("Checking access…");
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/sources", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.message || "Administrator access required.");
      return;
    }
    setAllowed(true);
    setSources(body.data);
    setChecks(body.checks || {});
    setMessage("");
    const [log, events] = await Promise.all([
      fetch("/api/admin/audit", { cache: "no-store" }),
      fetch("/api/admin/fixtures", { cache: "no-store" }),
    ]);
    if (log.ok) setAudit((await log.json()).data);
    if (events.ok) {
      const feed = await events.json();
      setFixtures(feed.data);
      setCandidates(feed.candidates || []);
    }
  }, []);
  useEffect(() => {
    void load().catch(() => setMessage("Administration service unavailable."));
  }, [load]);
  const report = useCallback(
    async (value: PlaybackReport) => {
      if (!preview) return;
      try {
        const r = await fetch("/api/admin/source-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...value,
            id: preview.id,
            version: preview.version,
            browser: navigator.userAgent.slice(0, 300),
          }),
        });
        const body = await r.json();
        if (!r.ok)
          throw new Error(
            body.message || "Playback report could not be saved.",
          );
        setChecks((old) => ({ ...old, [preview.id]: body }));
        setMessage(
          "Playback verified in this browser. Distribution rights still require operator review.",
        );
      } catch (error) {
        setMessage((error as Error).message);
      }
    },
    [preview],
  );
  const reviewCandidates = candidates.flatMap((candidate) => {
    const existing = sources.find((source) => source.url === candidate.url);
    if (existing && sourceIsActive(existing)) return [];
    return [
      existing
        ? { ...candidate, id: existing.id, version: existing.version }
        : candidate,
    ];
  });
  const saved = sources.find((s) => s.id === selected?.id);
  const canEnable =
    !!selected &&
    !!saved &&
    saved.url === selected.url &&
    saved.type === selected.type &&
    checks[selected.id]?.result === "passed" &&
    Date.now() - Date.parse(checks[selected.id]!.checkedAt) < 86400000;
  async function verify(source: StreamSource) {
    setMessage("");
    setPreview(source);
    setProbe("Checking manifest or publisher compatibility…");
    try {
      const r = await fetch(
        `/api/admin/source-check?id=${encodeURIComponent(source.id)}`,
      );
      const b = await r.json();
      setProbe(b.message || "Compatibility probe finished.");
    } catch {
      setProbe(
        "Manifest probe unavailable. Browser playback can still be checked.",
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BACKINIT OPERATIONS</span>
          <h1>Event sources</h1>
          <p>
            Configure a source for an ingested fixture, verify playback, then
            enable it within its permitted window.
          </p>
        </div>
      </div>
      {message && <p role="status">{message}</p>}
      {!allowed ? (
        <section className="panel">
          <h2>Administrator access required.</h2>
          <p>
            Accounts receive no administrative permissions at registration. An
            operator must grant the role locally.
          </p>
          <Link className="primary" href="/profile">
            Open account
          </Link>
        </section>
      ) : (
        <>
          {reviewCandidates.length > 0 && (
            <section
              className="panel"
              aria-label="Discovered broadcast candidates"
            >
              <h2>Discovered broadcasts</h2>
              <p>
                Publisher listings. Review rights, save disabled, then verify
                playback.
              </p>
              {reviewCandidates.map((candidate) => (
                <div className="source-row" key={candidate.id}>
                  <div>
                    <strong>{candidate.name}</strong>
                    <p>Unverified · {candidate.rightsOwner}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(candidate);
                      setPreview(null);
                    }}
                  >
                    Review {candidate.name}
                  </button>
                </div>
              ))}
            </section>
          )}
          <section className="panel">
            <div className="section-heading">
              <h2>Configured sources</h2>
              <button
                onClick={() => {
                  setSelected({
                    ...blank,
                    validFrom: new Date().toISOString(),
                    validUntil: new Date(Date.now() + 86400000).toISOString(),
                  });
                  setPreview(null);
                }}
              >
                Add source
              </button>
            </div>
            {sources.map((s) => (
              <div className="source-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <p>
                    {s.type.toUpperCase()} · {s.content} ·{" "}
                    {s.presentation ||
                      (s.content === "official" ? "archive" : "live")}{" "}
                    · {s.revoked ? "Revoked" : "Enabled"} · v{s.version}
                  </p>
                  <p className="fine">
                    {s.eventId ||
                      s.fixtureRef?.externalId ||
                      "Not attached to an event"}{" "}
                    ·{" "}
                    {checks[s.id]
                      ? `${checks[s.id]!.result} · ${checks[s.id]!.method}`
                      : "No recorded playback check"}
                  </p>
                </div>
                <div className="admin-source-actions">
                  <button
                    onClick={() => {
                      setSelected({ ...s });
                      setPreview(null);
                    }}
                  >
                    Edit {s.id}
                  </button>
                  <button onClick={() => void verify(s)}>Verify {s.id}</button>
                </div>
              </div>
            ))}
          </section>
          {selected && (
            <section className="panel account-panel">
              <h2>
                {selected.id
                  ? `Edit ${selected.name || selected.id}`
                  : "New source"}
              </h2>
              <p>
                New sports sources stay disabled until a saved version passes
                playback verification. Test feeds cannot be associated with real
                fixtures.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPending(true);
                  setMessage("");
                  try {
                    const r = await fetch("/api/admin/sources", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...selected,
                        eventId: selected.eventId || null,
                      }),
                    });
                    const body = await r.json();
                    if (!r.ok) throw new Error(body.message || "Save failed");
                    setSelected(null);
                    setPreview(null);
                    await load();
                    setMessage("Source saved. Change recorded in audit log.");
                  } catch (error) {
                    setMessage((error as Error).message);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {(
                  [
                    ["id", "Source ID"],
                    ["name", "Display name"],
                    ["url", "Player URL"],
                    ["rightsOwner", "Rights owner"],
                    ["rightsEvidence", "Rights evidence URL"],
                    ["validFrom", "Valid from (ISO UTC)"],
                    ["validUntil", "Valid until (ISO UTC)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      required
                      value={selected[key]}
                      onChange={(e) =>
                        setSelected({ ...selected, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Player type
                  <select
                    value={selected.type}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        type: e.target.value as StreamSource["type"],
                        territory:
                          e.target.value === "embed" ? "PROVIDER" : "WORLD",
                      })
                    }
                  >
                    <option value="hls">HLS</option>
                    <option value="dash">DASH</option>
                    <option value="embed">Permitted embed</option>
                  </select>
                </label>
                <label>
                  Content
                  <select
                    value={selected.content}
                    onChange={(e) => {
                      const content = e.target.value as StreamSource["content"];
                      setSelected({
                        ...selected,
                        content,
                        eventId: content === "sports" ? selected.eventId : null,
                        fixtureRef:
                          content === "sports"
                            ? selected.fixtureRef
                            : undefined,
                      });
                    }}
                  >
                    <option value="sports">Sports broadcast</option>
                    <option value="test">Test content</option>
                    {selected.catalog && (
                      <option value="official">Official channel archive</option>
                    )}
                  </select>
                </label>
                {selected.content === "sports" && (
                  <>
                    <label>
                      Event fixture
                      <select
                        aria-label="Event fixture"
                        required
                        value={selected.eventId || ""}
                        onChange={(e) => {
                          const fixture = fixtures.find(
                            (f) => f.id === e.target.value,
                          );
                          setSelected({
                            ...selected,
                            eventId: fixture?.id || null,
                            fixtureRef:
                              fixture?.source && fixture.externalId
                                ? {
                                    provider: fixture.source.provider,
                                    externalId: fixture.externalId,
                                  }
                                : undefined,
                          });
                        }}
                      >
                        <option value="">Select a verified fixture</option>
                        {fixtures.map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.sport} · {eventTitle(e)} · {e.start.slice(0, 16)}{" "}
                            UTC
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Programme type
                      <select
                        value={selected.presentation || "live"}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            presentation: e.target
                              .value as StreamSource["presentation"],
                          })
                        }
                      >
                        <option value="live">Live broadcast</option>
                        <option value="replay">Replay</option>
                        <option value="highlights">Highlights</option>
                      </select>
                    </label>
                    <p className="fine">
                      Fixture ID: {selected.eventId || "not selected"}. Provider
                      references are linked automatically. A test URL is never
                      accepted as a sports broadcast.
                    </p>
                  </>
                )}
                {selected.type === "embed" && (
                  <label>
                    Embed territory
                    <select
                      value={selected.territory}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          territory: e.target
                            .value as StreamSource["territory"],
                        })
                      }
                    >
                      <option value="PROVIDER">
                        Provider-enforced restrictions
                      </option>
                      <option value="WORLD">
                        Documented worldwide permission
                      </option>
                    </select>
                  </label>
                )}
                <p className="fine">
                  Territory: {selected.territory}. Direct streams require
                  documented worldwide rights. Embeds retain provider
                  restrictions; approved embed hosts require operator
                  configuration.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={selected.revoked}
                    disabled={
                      selected.content === "sports" &&
                      selected.revoked &&
                      !canEnable
                    }
                    onChange={(e) =>
                      setSelected({ ...selected, revoked: e.target.checked })
                    }
                  />
                  Revoked (unavailable to viewers)
                </label>
                {selected.content === "sports" && !canEnable && (
                  <p>
                    Save disabled, then use Verify beside the saved source.
                    Playback verification expires after 24 hours and is
                    invalidated by a URL or format change.
                  </p>
                )}
                <p className="fine">
                  Only reviewed HTTPS hosts are accepted. Additional direct
                  hosts use STREAM_ALLOWED_HOSTS; permitted publisher frames use
                  STREAM_EMBED_HOSTS. Neither setting grants distribution
                  rights.
                </p>
                <button className="primary" disabled={pending}>
                  {pending ? "Saving…" : "Save source"}
                </button>
                <button type="button" onClick={() => setSelected(null)}>
                  Cancel
                </button>
              </form>
            </section>
          )}
          {preview && (
            <section
              className="panel source-verification"
              aria-label="Source playback verification"
            >
              <div className="section-heading">
                <h2>Verify {preview.name}</h2>
                <button onClick={() => setPreview(null)}>Close preview</button>
              </div>
              <p>{probe}</p>
              <p className="fine">
                Preview uses saved version {preview.version}. Press play to
                verify actual decoding. It does not publish the source or prove
                entitlement.
              </p>
              <Player
                key={`${preview.id}-${preview.version}`}
                previewSource={preview}
                onPlaybackReport={report}
              />
              {preview.type === "embed" &&
                new URL(preview.url).hostname !==
                  "www.youtube-nocookie.com" && (
                  <div>
                    <p>
                      Cross-origin frames without a supported SDK cannot report
                      decoding automatically. Confirm only after you visibly
                      observe the correct programme playing.
                    </p>
                    <button
                      onClick={() =>
                        void report({
                          result: "passed",
                          method: "operator-observed",
                          currentTime: 0,
                          width: 0,
                          height: 0,
                        })
                      }
                    >
                      Confirm visible playback
                    </button>
                  </div>
                )}
              <button
                onClick={() =>
                  void report({
                    result: "failed",
                    method:
                      preview.type === "embed"
                        ? "operator-observed"
                        : "native-decoded",
                    currentTime: 0,
                    width: 0,
                    height: 0,
                  })
                }
              >
                Record playback failure
              </button>
            </section>
          )}
          <section className="panel">
            <h2>Recent audit entries</h2>
            {audit.length ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Scrollable data table"
              >
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Action</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td>{a.at}</td>
                        <td>{a.action}</td>
                        <td>{a.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No source changes recorded.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
