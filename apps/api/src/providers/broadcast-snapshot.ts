import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  broadcastFeedSchema,
  type BroadcastFeed,
} from "../../../../packages/domain/src/index.js";

export interface BroadcastSnapshot {
  read(): Promise<BroadcastFeed | null>;
  write(feed: BroadcastFeed): Promise<void>;
}

/** A last-known catalogue is recovery data, never evidence of current playback. */
export class FileBroadcastSnapshot implements BroadcastSnapshot {
  constructor(
    private path: string,
    private now = Date.now,
  ) {}
  async read(): Promise<BroadcastFeed | null> {
    try {
      if ((await stat(this.path)).size > 5000000) return null;
      const feed = broadcastFeedSchema.parse(
        JSON.parse(await readFile(this.path, "utf8")),
      );
      const age = this.now() - Date.parse(feed.updatedAt || "");
      return feed.data.length &&
        Number.isFinite(age) &&
        age >= 0 &&
        age <= 6 * 3600000
        ? feed
        : null;
    } catch {
      return null;
    }
  }
  async write(feed: BroadcastFeed): Promise<void> {
    const temp = `${this.path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      const file = await open(temp, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(feed));
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temp, this.path);
    } finally {
      await rm(temp, { force: true }).catch(() => {});
    }
  }
}
