# Advertising rollout

Adsterra publisher `backinit`, website `backinit.live` (6162435). Adult ads disabled during setup. No paid plans or purchases authorized.

## Placements

Home, Watch, Fixtures, Live, Scores, News and Videos have a responsive display banner near the top. Home has one Native Banner immediately after the live preview; other browse pages have one after content. Sidebars use a fitting rectangle/skyscraper. Match pages have a banner below the player/tracker and display + Native placements in the sidebar (below the player on narrow screens). Empty responses collapse. Account, admin, settings, privacy and saved pages have no passive ad tags.

The owner requested automatic ads without an Allow/Decline prompt unless the networks require one. Adsterra's [publisher terms clause 4.9](https://adsterra.com/publishers-terms-managed/) expressly requires a cookie-consent message when cookies collect visitor information. The implementation therefore retains only a footer cookie choice (Accept cookies / Essential only), with detailed disclosure on Privacy. No "Allow ads / Decline ads" wording or top-of-page prompt. After cookie permission, tags load automatically as placements become visible. Playback never requires an ordinary ad click. No automatic creative refresh or application iframe wrapper. Display tags execute serially because the original legacy snippets share `window.atOptions`; only one fitting size is requested per placement. Network-created creative iframes are part of the original integration.

| Format        | Unit     | Public tag key                   |
| ------------- | -------- | -------------------------------- |
| Native Banner | 32002377 | b9e9a122a56fe6638c4236bbf4696b47 |
| 300×250       | 32002378 | 8012e7c6a2ca269c4f61b668b5547ea1 |
| 320×50        | 32002379 | 576edab930bc072648fb2ebc5443a5db |
| 728×90        | 32002380 | 208c83c78501d240404891d74ed085e2 |
| Popunder      | 32053539 | 548b0877b7f514cfb8326cf26dbd7fe2 |
| Social Bar    | 32053540 | 1ed8358b832d318983f90d4b83b1eb73 |
| 468×60        | 32053541 | 3252a86563bbe1fb22b0eea6f0cb2f75 |
| 160×300       | 32053542 | 276f42212b068ca265798bba87f19179 |
| 160×600       | 32053543 | 603c1aba716e2c6791970e0bb779b9ce |

All units were Active in the publisher dashboard on 2 November. Tags were copied from each unit's GET CODE dialog. Native uses `https://czernik.org/21/{key}` and its `container-{key}` div. Display uses `https://czernik.org/22/{key}` with the original `atOptions` dimensions/format. Social uses `https://czernik.org/14/{key}`; Popunder uses `https://capitalhospitals.org/1/{key}` in the head.

Social loads automatically after 15 seconds on public browse pages other than Home and Watch. Popunder loads only on Watch discovery after 30 seconds. They never load together in the same document. First-party storage limits tag loads to once per six hours for Social and once per 24 hours for Popunder, per browser. **These are tag-loading limits, not guaranteed network creative/popup impression caps.** Network-controlled behavior must be monitored after release. If storage is unavailable, these interactive tags are skipped. Navigation after an interactive tag uses a fresh document; private links clear the document before vendor click handlers. Withdrawing cookie permission starts a fresh document to cancel pending vendor scripts and clear their handlers. Previously transmitted data cannot be recalled.

The separate Smartlink (32002493) is labelled Sponsored and opens only on a voluntary click: `https://asiafilm.org/4/03e480f030ce8a18c8c3de500ca10b7d`. It does not intercept Play. `ADSTERRA_NATIVE_ENABLED=false` disables third-party tags while retaining voluntary sponsored links.

## Network rules

Earlier support rejected wrapping ad tags in our own iframe and said Adsterra VAST is unsupported. That wrapper remains removed. Support suggested Popunder, Social Bar and Native; its earlier troubleshooting advice also warned about multiple codes. The owner instructed us not to send another clarification and to use supported combinations. Current official guidance explicitly supports combining distinct formats/different banner sizes, while forbidding duplicate Popunder/Social codes:

- [Official WordPress monetization guide](https://adsterra.com/blog/monetize-wordpress-website/): separate codes/sizes for multiple banners; one Popunder code.
- [Official CPM guide](https://adsterra.com/blog/how-to-increase-cpm/): distinct-format combinations including Popunder + Native and Social + Native.
- [Official banner comparison](https://adsterra.com/blog/popunders-vs-banners/): combining banner sizes.

This implementation uses distinct issued units once per placement, one Native container, and at most one interactive format per document. No new personalized exception was obtained. No forced advertiser clicks, disguised playback buttons, rewarded unlocks or fake impressions.

## Video ads

HilltopAds publisher account 411698 was registered by the owner. Mainstream website `backinit.live` (927895) is verified. Video Slider MultiTag zone **7587969–7587973** was issued **APPROVED ACTIVE** on 2 November. The original loader runs on Home only, after 20 seconds and cookie permission, with a once-per-24-hours/browser tag-loading limit. It replaces Social Bar on Home; other browse pages retain Social, and Watch retains Adsterra Popunder. No interactive formats are loaded together in one document.

The account offers Video Slider as **MultiTag**, which can include a popup as well as skippable video. The dashboard exposes no per-zone creative-frequency controls. App tag-loading caps are not network popup/creative caps; no bypass or alteration of the issued loader is used. Cookie disclosure includes both providers and preference version 3 requests permission for the new provider. Video ads do not gate publisher-controlled YouTube players. Original public script: `//juvenilechoice.com/bTXWV/s.dtG/lQ0KYIWQck/le/md9_uNZzUulqkfPhT-cl1hOVDkcP5lNQj/kptANdzWUe4cNmzokE3NM/wr`, asynchronous, `referrerPolicy=no-referrer-when-downgrade`, empty issued settings object. [HilltopAds legal/privacy](https://hilltopads.com/legal#privacypolicy), including cookie-consent requirements in clause 8.2.3.

## Verification and earnings

Automated tests intercept vendor requests: no real impressions or advertiser clicks. They cover direct tags, cookie permission, no-fill, responsive size selection, configuration serialization, all popular routes, delayed interactive formats, loading caps across reloads, and clean private-page navigation. Active units, HTTP 200 and script load do not prove creative fill or revenue. No earnings or withdrawal verified; no income guarantee.

Payout details, tax/identity verification and withdrawal are account-owner actions. Only publish network-issued ads.txt seller records. Screenshots: `artifacts/ads-2026-11-02/`.
