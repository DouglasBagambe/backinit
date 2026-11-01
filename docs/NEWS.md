# Public sports news links

The default provider is the GDELT Article List RSS feed, with the DOC 2.0 sports query as a fallback. Both are documented GDELT interfaces; no API key, paid plan or publisher permission flag is required for the GDELT index. BBC's direct syndication feed remains separately gated by BBC_FEED_LICENSED.

GDELT's terms permit commercial redistribution of its datasets with attribution: https://www.gdeltproject.org/about.html. The Article List documentation specifically describes article URL/title links: https://blog.gdeltproject.org/announcing-the-gdelt-article-list-rss-feed/. Query API reference: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/.

BackInIt shows index titles and original publisher links; it does not ingest article bodies or publisher images. Each feed credits GDELT and links to its website. Dates are labelled Indexed, since GDELT discovery time is not the publisher's publication timestamp. Publisher domains and sports paths are allowlisted, duplicate titles/URLs removed, tracking parameters stripped, and malformed, future or older-than-seven-day records rejected. XML parsing rejects document/entity declarations and bounds the response size.

The service coalesces refreshes, retains a readable stale snapshot for up to 24 hours and backs off failing requests. The frontend has a small initial render budget, then independently loads/retries news so an upstream outage cannot hold navigation. Empty or unavailable news is never replaced by invented stories.

The web `/api/news` route also runs the same shared `@backinit/news` provider. Its network path is independent of the hosted sports API: a backend egress timeout no longer makes the website's news source unavailable. The backend remains a fallback snapshot source. Both hosts preserve identical publisher validation and attribution.
