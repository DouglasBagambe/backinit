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
