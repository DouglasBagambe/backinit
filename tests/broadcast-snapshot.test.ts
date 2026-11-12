import { it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileBroadcastSnapshot } from "../apps/api/src/providers/broadcast-snapshot";
import { BroadcastCatalogue } from "../apps/api/src/providers/broadcast-catalogue";
const feed = () => ({
  data: [
    {
      id: "ppv-1",
      title: "Match",
      category: "Football",
      competition: "League",
      poster: null,
      start: Date.now(),
      end: Date.now() + 3600000,
      channel: false,
      viewers: null,
      pageUrl: "https://ppv.st/live/match",
      sources: [
        { id: "1", label: "Stream 1", url: "https://ppv.st/embed/match" },
      ],
      replay: false,
    },
  ],
  updatedAt: new Date().toISOString(),
  stale: false,
});
it("restores a validated recent catalogue across process restarts and rejects expired/corrupt files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backinit-snapshot-"));
  try {
    const path = join(dir, "catalogue.json"),
      store = new FileBroadcastSnapshot(path);
    const value = feed();
    await store.write(value);
    expect(await new FileBroadcastSnapshot(path).read()).toEqual(value);
    expect(
      await new FileBroadcastSnapshot(
        path,
        () => Date.now() + 7 * 3600000,
      ).read(),
    ).toBeNull();
    await writeFile(path, "broken");
    expect(await store.read()).toBeNull();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("returns saved listings immediately while an offline provider refreshes, then retains the original timestamp", async () => {
  const value = feed();
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = new BroadcastCatalogue(
    [
      {
        feed: async () => {
          await waiting;
          throw Error("offline");
        },
      },
    ],
    { read: async () => value, write: async () => {} },
  );
  const restored = await store.feed();
  expect(restored.data).toEqual(value.data);
  expect(restored.stale).toBe(true);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  expect((await store.feed()).updatedAt).toBe(value.updatedAt);
});
it("persists a successful refresh and keeps serving if snapshot storage is unavailable", async () => {
  const value = feed();
  let saved = false;
  const store = new BroadcastCatalogue([{ feed: async () => value }], {
    read: async () => null,
    write: async () => {
      saved = true;
      throw Error("read only");
    },
  });
  expect((await store.feed()).data).toEqual(value.data);
  expect(saved).toBe(true);
});
