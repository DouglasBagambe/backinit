import { it, expect, afterEach } from "vitest";
import { Accounts } from "../apps/api/src/accounts";
import { Streams, validateStream } from "../apps/api/src/streams";
import { testSources, sourceIsActive } from "../packages/domain/src/index";
const stores: Accounts[] = [];
afterEach(() => stores.splice(0).forEach((a) => a.db.close()));
it("enforces HTTPS, reviewed hosts, embed routes, rights and validity windows", () => {
  const source = testSources[0]!;
  expect(validateStream(source).id).toBe(source.id);
  for (const url of [
    "http://test-streams.mux.dev/test.m3u8",
    "https://127.0.0.1/test",
    "https://test-streams.mux.dev.evil.test/test",
    "https://user:pass@test-streams.mux.dev/test",
    "https://test-streams.mux.dev:8443/test",
  ])
    expect(() => validateStream({ ...source, url })).toThrow();
  expect(() => validateStream({ ...source, type: "embed" })).toThrow();
  expect(() => validateStream({ ...source, rightsEvidence: "" })).toThrow();
  expect(() => validateStream({ ...source, content: "sports" })).toThrow(
    "event ID",
  );
  expect(sourceIsActive({ ...source, revoked: true })).toBe(false);
  expect(
    sourceIsActive({ ...source, validUntil: "2025-01-01T00:00:00Z" }),
  ).toBe(false);
});
it("filters public sources, records audited revocation and detects stale edits", () => {
  const accounts = new Accounts(":memory:");
  stores.push(accounts);
  const streams = new Streams(accounts);
  const source = streams.public()[0]!;
  streams.save(
    { id: "operator", email: "operator@example.test", role: "admin" },
    { ...source, revoked: true },
  );
  expect(streams.public().some((s) => s.id === source.id)).toBe(false);
  expect(() =>
    streams.save(
      { id: "operator", email: "operator@example.test", role: "admin" },
      source,
    ),
  ).toThrow("Source changed");
  expect(accounts.db.prepare("SELECT action FROM audit").get()?.action).toBe(
    "source.revoke",
  );
});
