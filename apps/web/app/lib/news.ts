import { apiUrl } from "./api-url";
import { newsFeedSchema, type NewsFeed } from "@backinit/domain";
export async function loadNews(): Promise<NewsFeed> {
  try {
    const response = await fetch(apiUrl(`/news`), {
      cache: "force-cache",
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(1500),
    });
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
