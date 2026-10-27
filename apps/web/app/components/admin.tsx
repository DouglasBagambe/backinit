"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type StreamSource } from "@backinit/domain";
const blank: StreamSource = {
  id: "",
  name: "",
  type: "hls",
  url: "",
  content: "sports",
  eventId: "",
  rightsOwner: "",
  rightsEvidence: "",
  validFrom: "2026-10-26T00:00:00Z",
  validUntil: "2026-10-27T00:00:00Z",
  territory: "WORLD",
  revoked: true,
  version: 1,
};
export function Admin() {
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [selected, setSelected] = useState<StreamSource | null>(null);
  const [audit, setAudit] = useState<
    { id: number; action: string; target: string; at: string }[]
  >([]);
  const [message, setMessage] = useState("Checking access…");
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState(false);
  async function load() {
    const response = await fetch("/api/admin/sources", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.message || "Administrator access required.");
      return;
    }
    setAllowed(true);
    setSources(body.data);
    setMessage("");
    const log = await fetch("/api/admin/audit", { cache: "no-store" });
    if (log.ok) setAudit((await log.json()).data);
  }
  useEffect(() => {
    void load().catch(() => setMessage("Administration service unavailable."));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BACKINIT OPERATIONS</span>
          <h1>Source management.</h1>
          <p>
            Direct streams require documented worldwide rights. Official embeds
            retain the provider’s regional and playback restrictions.
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
          <section className="panel">
            <div className="section-heading">
              <h2>Configured sources</h2>
              <button
                onClick={() =>
                  setSelected({
                    ...blank,
                    validFrom: new Date().toISOString(),
                    validUntil: new Date(Date.now() + 86400000).toISOString(),
                  })
                }
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
                    {s.revoked ? "Revoked" : "Enabled"} · v{s.version}
                  </p>
                </div>
                <button onClick={() => setSelected({ ...s })}>
                  Edit {s.id}
                </button>
              </div>
            ))}
          </section>
          {selected && (
            <section className="panel account-panel">
              <h2>{selected.id ? `Edit ${selected.name}` : "New source"}</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPending(true);
                  setMessage("");
                  try {
                    const response = await fetch("/api/admin/sources", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...selected,
                        eventId: selected.eventId || null,
                      }),
                    });
                    const body = await response.json();
                    if (!response.ok)
                      throw new Error(body.message || "Save failed");
                    setSelected(null);
                    await load();
                    setMessage("Source saved. Change recorded in audit log.");
                  } catch (e) {
                    setMessage((e as Error).message);
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
                    ["eventId", "Event ID (required for sports)"],
                    ["rightsOwner", "Rights owner"],
                    ["rightsEvidence", "Rights evidence URL"],
                    ["validFrom", "Valid from (ISO UTC)"],
                    ["validUntil", "Valid until (ISO UTC)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={selected[key] || ""}
                      required={key !== "eventId"}
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
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        content: e.target.value as StreamSource["content"],
                      })
                    }
                  >
                    <option value="sports">Sports broadcast</option>
                    <option value="test">Test content</option>
                    {selected.catalog && (
                      <option value="official">Official channel embed</option>
                    )}
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={selected.revoked}
                    onChange={(e) =>
                      setSelected({ ...selected, revoked: e.target.checked })
                    }
                  />
                  Revoked (unavailable to viewers)
                </label>
                <p className="fine">
                  A rights evidence link is an operator record, not automated
                  verification. Approved hosts: test-streams.mux.dev,
                  dash.akamaized.net, www.youtube-nocookie.com. Host changes
                  require a code review.
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
