# BackInIt

A multi-sport platform for official viewing, scores and following your sport.

Watch combines official publisher broadcasts with reported match tracking. Accounts, favorites, recovery codes and notification preferences use persistent PostgreSQL storage in production. Administrator broadcast sources and playback verification use the same durable backend. News links come from the free, attributed GDELT index, with its bulk RSS feed as a fallback; articles remain on their publishers’ websites. The original demo is a separate edition. Broadcasts and animated tracker coverage remain dependent on the upstream providers and regional availability; no universal live sports coverage is claimed.

- [Local development and current capabilities](docs/DEVELOPMENT.md)
- [Architecture and decisions](docs/ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)
- [Provider and infrastructure research](docs/RESEARCH.md)
- [Tonight’s fixtures and live viewing status](docs/LIVE_VIEWING_2026-10-28.md)
- [Free viewing destinations and stream acquisition](docs/STREAMS.md)
- [Vercel Services configuration and storage blocker](docs/VERCEL.md)
- [Database operation and migration strategy](docs/DATABASE.md)
- [Verification evidence](docs/VERIFICATION.md)

Owner: Douglas Bagambe. No license to reuse the project is granted by this repository.
