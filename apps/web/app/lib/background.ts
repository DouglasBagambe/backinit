import { after } from "next/server";

/** Keep serverless refresh work alive after returning a cached response. */
export function completeAfterResponse(task: () => Promise<void>) {
  after(task);
}
