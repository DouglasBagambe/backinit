import { test, expect } from "@playwright/test";

test("scoped event filters survive browser proxy to API and invalid dates fail explicitly", async ({
  request,
}) => {
  const response = await request.get("/api/events?sport=Football", {
    headers: { Cookie: "backinit-edition=real" },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.edition).toBe("real");
  expect(body.data.length).toBeGreaterThan(0);
  expect(
    body.data.every((event: { sport: string }) => event.sport === "Football"),
  ).toBe(true);
  expect((await request.get("/api/events?sport=NotASport")).status()).toBe(400);
  expect((await request.get("/api/events?date=2026-02-30")).status()).toBe(400);
  const api = `http://127.0.0.1:${process.env.E2E_API_PORT || 4100}`;
  expect(
    (await request.get(`${api}/events?edition=real&date=2026-02-30`)).status(),
  ).toBe(400);
});
