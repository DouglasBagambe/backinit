# Public-site audit and real-data enforcement

## Later update: free Render backend deployed

The founder confirmed that no backend existed and authorized hosting it in Dyson’s Render workspace. `https://backinit-api.onrender.com` is now live at commit `4a6e002`, in stateless **data-only** mode. The hosted probe at 21:22 Africa/Kampala returned 1,048 real provider records across 10 sports, including six provider-reported live tennis records. Earlier in the audit there were seven; subsequent provider refreshes changed the returned live set. This is automated provider data, not independently verified video.

The local production frontend successfully used that real hosted API for event discovery, Watch listings and the Liverpool–Chelsea viewing page. The actual `backinit.live` frontend has not been updated by this work. The prepared Vercel configuration builds only Next.js and explicitly selects the external Render backend, replacing the old two-service arrangement. The connected Vercel account still cannot access the site’s team.

Accounts, source management and playable broadcasts remain unavailable on the hosted API until durable storage is connected. BWF discovery failed from Render; cricket and boxing remain unconfigured. **LIVE PLAYBACK NOT ACHIEVED on the public installation.** No football broadcast has been verified. See [Render operation](RENDER.md), [frontend configuration](VERCEL.md) and [timestamped hosted evidence](evidence/render-api-2026-10-28.json).

The sections below record the earlier audit and preparation, before the backend was hosted.

## Observed public deployment

On 28 October 2026, at approximately 20:58 Africa/Kampala, a real browser opened `https://www.backinit.live/`, `/watch`, `/scores` and `/news`. The HTML returned 200, but the page showed unavailable data/accounts and still offered a Demo edition button. Badminton and ice hockey were absent from its navigation, indicating this deployment did not contain the latest branch's full feature set.

Read-only public requests observed:

| Request                                             | Response                                                                                   | Meaning                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `/api/events`                                       | 200, `edition: real`, zero records, source `Sports API unavailable · no demo substitution` | The fallback explicitly reports missing backend data; it is not a successful provider ingestion. |
| `/api/watch`                                        | 503, zero records                                                                          | Public event discovery unavailable.                                                              |
| `/api/streams?event=efl-20261028-liverpool-chelsea` | 503                                                                                        | Public source registry unavailable.                                                              |

**No public live broadcast was verified in this audit.** Earlier local BWF playback evidence does not prove that the public site can play those streams. No fabricated fixtures, scores or broadcasts were added to cover the failure.

Browser screenshots: `artifacts/public-audit-home.png`, `artifacts/public-audit-watch.png`, `artifacts/public-audit-scores.png`, `artifacts/public-audit-news.png`. Provider testing at 20:57 Kampala returned 11 provider-reported live records locally and three disabled BWF embed candidates. These are discovery observations, not proof of public playback.

## Changes prepared on feat/sports-foundation

- Demo mode is disabled by default across server pages, data loaders, API requests, calendar export and edition selection. Old demo cookies and an old `SPORTS_DATA_MODE=demo` setting do not override the public default.
- `ALLOW_DEMO_MODE=true` explicitly enables isolated demo/CI tests. Keep it absent or false in every public environment. Existing deterministic tests opt in explicitly.
- Public users cannot select the test-player route or list test streams by default. The test fixtures remain available in isolated tests and secured operator tools; they are not public sporting content.
- Paused provider ingestion outside `NODE_ENV=test` returns empty unavailable coverage, rather than the test installation's fixed official fixture snapshots.
- `/api/events` now returns HTTP 503 on backend failure instead of an empty 200 response that could look healthy.
- All server-side API calls resolve the same backend address: the injected `API_INTERNAL_URL` on Vercel, or `API_URL` for local/separately hosted installations. Vercel without either fails explicitly instead of attempting localhost. Private service path prefixes are preserved. This does not create or deploy a backend.
- Admin fixture responses include fresh, official BWF source candidates. Review fills the source form but does not save, verify or publish it. New sources remain disabled. Expired existing source URLs can be reviewed for renewal without creating a duplicate identity.
- Provider-confirmed live sessions stay visible after six hours and across midnight. No elapsed-time rule invents live status.
- BWF caches retain selected event metadata only, discarding unrelated playback/tracking payloads.
- Navigation regression checks now derive expected images and picker entries from the supported sports catalogue instead of an outdated image count.

## Deployment requirements that remain unresolved

The frontend needs a reachable Nest API. The API hosting location was not discoverable through the connected Vercel account, and a request for the backend service URL/project name is pending. The fact that a frontend domain is publicly reachable does not establish that the Nest service is running or bound correctly.

Use the deployment model already configured in `vercel.json`. Import the repository root so both services are built, and use the generated binding rather than localhost:

- `API_INTERNAL_URL`: injected private service URL when using service bindings.
- `API_URL`: local/separately hosted runtime only. On Vercel, the Services configuration requires its injected binding and deliberately ignores manually set API_URL values.

The API must retain a real persistent database for accounts and source configuration. The current SQLite topology requires one API instance and an absolute `DATABASE_PATH` on persistent storage; ephemeral function storage does not satisfy this. See [database operation](DATABASE.md). No paid resource, database migration or hosting topology change has been provisioned. PR #2's Vercel Services configuration was merged into main externally during this continuation and has been incorporated into this feature branch; its documented durable-state blocker remains.

Local SQLite sources/checks do not travel with a frontend deployment. Public playback requires source records on the deployed API, correct validity windows/territories and actual browser verification on the public origin. BWF's standard embeds preserve publisher restrictions. Liverpool–Chelsea and the other cup fixtures still have no verified public in-page source.

## Reproduce the isolated public-mode check

```sh
pnpm build
node scripts/probe-public-mode.mjs
```

The check starts isolated local production-mode processes on ports 3500/4500 with an in-memory database, disabled providers and an intentionally old demo default/cookie. It confirms real-only responses, rejected demo selection, no fixed fixture substitution, no public test streams, no demo calendar event, a missing test-player route and no Demo edition button. It never deploys or changes `backinit.live`.

The public outage is not fixed merely by passing these checks. Apply the reviewed code and establish the backend connection before claiming public functionality. No merge or public deployment was performed in this continuation.

## Validation of the prepared changes

64 unit/integration tests pass after incorporating PR #2’s three binding tests. Strict TypeScript, formatting and the production build pass. The full Chromium suite passed 36 tests, with one optional external test-media probe skipped. Browser checks cover candidate review without publishing, all sports/images in the narrow picker, long-running live sessions, accounts, source switching, revocation, both themes and responsive layouts. The isolated public-mode browser check also confirms that a failed backend returns HTTP 503 instead of an empty success response.
