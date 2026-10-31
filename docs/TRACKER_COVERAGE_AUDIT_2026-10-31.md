# Live coverage audit, 31 October 2026

At approximately 14:55 UTC the public Watch feed contained eleven live games: nine tennis, one football and one rugby. Six tennis matches resolved to the published animation. Three tennis matches, Bologna–Monza and the rugby fixture did not.

Two integration failures were identified and corrected:

- ESPN names Carlos Alcaraz; the animation feed names Carlos Alcaraz Garfia. An explicit alias, backed by the [RFET player record](https://www.rfet.es/media/file/competicion/masinfo/626_Documento.pdf), retains exact identity checks without generic prefix/fuzzy matching.
- Bologna–Monza was absent from the general football live listing but present in the documented team-filtered fixture endpoint. The resolver now searches for an exact, unique publisher team, uses its returned slug for a scoped fixture list, and still revalidates both participants, kickoff, current live status and tracker metadata. Ambiguous teams or fixtures fail closed.

The same public Watch response contained 438 entries and 446,614 bytes, even though its client would exclude most of them. Applying the existing client eligibility rule before transfer retained 41 entries and approximately 56 KB in this snapshot. Reported score details and verified source associations remain intact. A stalled browser request now has a 20-second deadline and cannot overlap the next poll; Retry can recover without reloading the page.

## Remaining provider dependencies

- The live listing did not contain Felix Balshaw–Yannick Hanfmann or the Cerundolo/Etcheverry–Seggerman/Tien doubles fixture. The documented Seggerman player search did not list the current doubles partnership. Cerundolo's player-filtered fixtures exposed a singles match, not the doubles fixture. These results are not evidence of an available animation for those games.
- SportScore publishes animation coverage for football, basketball, tennis and cricket. It does not provide the requested rugby animation. Scores and reported events are not represented as positional tracking.
- Gmail search in backinitlive@gmail.com showed only the sent Sportradar no-cost-access enquiry and no reply. No BackInIt Client ID or entitlement was available to activate the existing integration. No paid plan or another publisher's customer identity was used.
- No free, authorized Chelsea–Manchester United video stream for the visitor's region was verified. A reachable manifest or an unofficial site does not establish redistribution permission.

These external coverage limits prevent a truthful claim of universal animated tracking or video coverage. They must not be hidden by inventing ball movement, substituting another match or labelling a scorecard as a broadcast.

References: [SportScore supported sports](https://sportscore.com/about/), [documented API](https://sportscore.com/developers/api/), [official embed instructions](https://sportscore.com/embed/).

## Later live startup audit (approximately 18:00 UTC)

Current public metadata resolved six live singles/football games: Lehecka–Struff, Zverev–de Minaur, Udinese–Roma, Vallejo–Dimitrov, Tottenham–Crystal Palace and Betis–Málaga. The Jakupovic/Radisic doubles match remained absent from the provider's live fixture list, so no substitute match was used.

The original Zverev–de Minaur publisher page initially displayed a black court area, then rendered the real 3D tennis court, set/game points, serving player and score table. This exposed a local startup fault: BackInIt's 35-second load watchdog restarted the entire publisher document while nested resources were still loading, and a scorecard overlay covered any already-rendered animation until the outer load event completed. Publisher transport now remains visible during startup and a slow-resource timeout reports delay without discarding its document. Confirmed navigation errors and explicit Reload retain their recovery path. The contract test holds a nested resource beyond the watchdog and verifies that rendered content remains visible with only one publisher navigation, then completes the load and checks the summary control.

The documented `/api/widget/tracker/` endpoint returned an HTML iframe wrapper, not positional JSON; it cannot provide an independent real-position renderer. The publisher's [official embed integration](https://sportscore.com/embed/) displays the embed directly. No provider credentials were extracted or reused. The owner declined a new support email, so none was sent. The existing Sportradar enquiry still had no reply at this audit.

The post-release browser check also exposed an independent discovery gate: a stale/unknown score snapshot suppressed the tracker metadata request entirely. The client now asks the backend to revalidate that exact fixture even when its initial score snapshot is stale; the backend continues to require a current, live, correctly matched tracker. Live feed/match reads bypass the persistent frontend cache, retaining backend coalescing and scoreboard caching. A regression test keeps the score response stale while returning independently verified current tracker metadata and asserts that the publisher document appears.

Tracker metadata also renews every thirty seconds instead of sixty. A cached two-minute record could otherwise expire while its renewal request was still in flight, temporarily removing and remounting a healthy animation. A browser contract starts with sixty seconds of remaining validity, advances beyond that expiry, and verifies that proactive renewal retains the same single publisher document.

The full suite also caught an intermittent native-player recovery failure. Native `error` events now record the failed source, subsequent progress events cannot overwrite failure, and events from an older selected source/retry attempt cannot change the active player. Failed playback tears down its transport. A browser regression dispatches late pause/waiting/canplay events after error and verifies that Retry and the failure state remain available.
