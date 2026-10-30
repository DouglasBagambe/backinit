# Advertising rollout

Adsterra publisher account `backinit`, website `backinit.live` (6162435) was approved on 30 October 2026. Adult ads were disabled. Dashboard-created active units:

| Format        | Unit                          |
| ------------- | ----------------------------- |
| Native Banner | 32002377 (not integrated yet) |
| 300 × 250     | 32002378                      |
| 320 × 50      | 32002379                      |
| 728 × 90      | 32002380                      |

The application uses publisher-issued public tags, not account/API credentials. Responsive banners follow browse content and sit below event video. A rectangle is available in the existing match-information sidebar. No ads are inserted into playback controls or account/admin pages. Native inventory is reserved until separately reviewed. A separate mainstream Smartlink (32002493, BackInIt sponsored offers) is shown as an explicit Sponsored offers link after consent. It opens a new tab only on a visitor click; automated tests never follow it. No click hijacks, disguised Play buttons, automatic redirects, popunder tags, or push subscriptions are installed.

Visitors choose Allow ads or Decline ads before any advertising request is made. The choice is persisted locally and synchronized across tabs; Ad preferences reopens it and removes existing advertising immediately. Withdrawal stops new requests, not past processing by partners. Privacy copy explains Adsterra and links its policy. This simple opt-in is not a claim of certification under any network-specific CMP standard.

Tags execute in opaque-origin sandbox frames without application cookie/DOM access, top navigation or downloads. Explicit advertiser links may open a separate tab. Frames load only near the viewport and only if their native dimensions fit. Responses that create no content collapse after 12 seconds without an empty ad placeholder. Ad blocking/no-fill does not obstruct sport or playback. No automatic ad refresh is implemented.

Automated browser tests intercept advertising requests and generate no real impressions or clicks. Manual checks never click ads. Dashboard “Active”, an HTTP 200, and an initialized iframe are not proof of a delivered creative or revenue. Record visible production fill separately. Local manual checks initially received empty JavaScript from the publisher-issued tags. A diagnostic request identifying the approved public domain returned JavaScript; visible production delivery still needs its own verification. No earnings have been verified.

Payout configuration, any identity/tax verification and actual withdrawal remain account-owner actions. Never invent financial details, expected income, or ads.txt seller records. Use only records issued by the network. No paid advertising purchases are needed for publisher monetization.
