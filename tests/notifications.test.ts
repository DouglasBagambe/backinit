import { it, expect } from "vitest";
import { Accounts } from "../apps/api/src/accounts";
import { Notifications } from "../apps/api/src/notifications";
import { events, type SportEvent } from "../packages/domain/src/index";
it("generates deduplicated, isolated opt-in updates only from fresh real changes", async () => {
  const a = new Accounts(":memory:");
  try {
    const n = new Notifications(a);
    const fan = await a.authenticate(
      { email: "updates@example.test", password: "long-notification-password" },
      true,
    );
    const other = await a.authenticate(
      { email: "other@example.test", password: "long-notification-password" },
      true,
    );
    a.favorite(fan.user, { kind: "team", target: "Arsenal" }, false);
    const event = {
      ...events[0]!,
      provenance: "provider",
      source: {
        provider: "Verified test provider",
        url: "https://provider.example",
        license: "Test fixture",
        fetchedAt: new Date().toISOString(),
        stale: false,
      },
    } as SportEvent;
    n.ingest([event]);
    n.preferences(fan.user, { enabled: true });
    const updated = {
      ...event,
      kind: "score",
      homeScore: 3,
      source: {
        ...event.source!,
        fetchedAt: new Date(Date.now() + 100).toISOString(),
      },
    } as SportEvent;
    n.ingest([{ ...updated, provenance: "demo" }]);
    n.ingest([{ ...updated, source: { ...updated.source!, stale: true } }]);
    expect(n.list(fan.user).data).toHaveLength(0);
    n.ingest([updated]);
    n.ingest([updated]);
    expect(n.list(fan.user).data).toHaveLength(1);
    expect(n.list(other.user).data).toHaveLength(0);
    const id = Number(n.list(fan.user).data[0]!.id);
    n.read(other.user, { id });
    expect(n.list(fan.user).data[0]?.read).toBe(0);
    n.read(fan.user, { id });
    expect(n.list(fan.user).data[0]?.read).toBe(1);
    n.preferences(fan.user, { enabled: false });
    n.ingest([{ ...updated, homeScore: 4 } as SportEvent]);
    expect(n.list(fan.user).data).toHaveLength(1);
  } finally {
    a.db.close();
  }
});
