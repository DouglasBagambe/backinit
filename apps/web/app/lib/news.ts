import { newsFeedSchema, type NewsFeed } from "@backinit/domain";
export async function loadNews(): Promise<NewsFeed> {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/news`,
      { cache: "no-store", signal: AbortSignal.timeout(9000) },
    );
    if (!response.ok) throw new Error();
    return newsFeedSchema.parse(await response.json());
  } catch {
    return {
      data: [],
      status: "unavailable",
      message: "News service unavailable. Product guides are shown below.",
      fetchedAt: null,
    };
  }
}
