# Sportradar tracker pilot

Status: implemented and tested with isolated browser contracts; **not activated**.
No customer Client ID, paid entitlement, or live mapping feed has been obtained.
Production continues to use the existing tracker and score summary.

On 31 October 2026 the owner approved requesting free access only. A request was
sent from backinitlive@gmail.com to sales@sportradar.com asking about a no-obligation
trial, an ongoing free option, widget Client ID, allowed domains and fixture mapping
feed. The message explicitly declines activation of any paid service. Do not
purchase or assume a trial permits ongoing ad-supported production use.

Browser inspection of betPawa's live Villarreal–Espanyol event found a
`widgets.sir.sportradar.com` widget loader. Its customer identity was not copied.
Sofascore's public match export offered a live result card, not its animated pitch.

## Activation

1. Obtain BackInIt's own widget Client ID and explicit applicable domain/coverage
   entitlement from the provider. Ordinary Marketplace sports-data API trials do
   not automatically include widget access.
2. Set `SPORTRADAR_CLIENT_ID` on the API service, never an API key. This identifier
   is public widget configuration and reaches the browser.
3. For an initial pilot set `SPORTRADAR_TRACKER_MATCHES` to a JSON array of verified
   mappings from our licensed coverage or dashboard:

   ```json
   [
     {
       "eventId": "backinit-event-id",
       "matchId": "sr:match:PROVIDER_NUMERIC_ID",
       "sport": "Tennis",
       "home": "Exact home participant",
       "away": "Exact away participant",
       "start": "2026-10-31T12:00:00Z"
     }
   ]
   ```

   The example intentionally contains no working customer or fixture identifier.
   It will not activate a widget as written. The resolver requires one mapping,
   exact participant order, sport and kickoff, provider provenance and a live,
   non-stale event. Invalid/missing mappings leave the current tracker unchanged.
   This is a curated pilot, **not automatic multisport discovery**. Add licensed
   coverage-feed discovery after the provider confirms the feed/credentials.

4. Rebuild/deploy from main after CI, then verify a real covered live match on
   desktop and mobile. Confirm actual animation and data updates, full natural
   height, licence-error fallback and navigation cleanup. Mocked browser contracts
   are not proof of actual vendor access or ball movement.

The frontend uses the documented custom-name SDK bootstrap and `match.lmtPlus`.
Only a successful `data_change` callback for the bound match reveals the widget;
script load alone is insufficient. Licensing/data errors show the updating score
summary. The vendor's layout owns its height, without an iframe crop. Route changes
remove the old widget and lease renewal reuses the loader. No extra attribution
label is added; provider branding remains under its own control.

## References

- [Widget client identity and licences](https://apidocs.sportradar.com/resources/widgets/docs/tutorials/faq)
- [Integration bootstrap](https://apidocs.sportradar.com/resources/widgets/docs/tutorials/getting-started)
- [SIR lifecycle and theme methods](https://apidocs.sportradar.com/resources/widgets/docs/tutorials/SIR)
- [Data and licensing callbacks](https://apidocs.sportradar.com/resources/widgets/docs/tutorials/tracking-guide)
- [Marketplace trial limitations: widgets require separate access](https://developer.sportradar.com/getting-started/docs/your-account)
