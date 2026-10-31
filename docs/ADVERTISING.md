# Advertising rollout

Adsterra publisher `backinit`, approved website `backinit.live` (6162435). Adult ads were disabled during setup. No purchases are authorized.

## Current integration

The publisher supplied the original asynchronous Native Banner snippet for unit 32002377 on 31 October 2026:

```html
<script
  async="async"
  data-cfasync="false"
  src="https://czernik.org/21/b9e9a122a56fe6638c4236bbf4696b47"
></script>
<div id="container-b9e9a122a56fe6638c4236bbf4696b47"></div>
```

The application executes this tag directly after advertising consent and when its placement approaches the viewport. There is one Native Banner per page: in the match sidebar, below the tracker on narrow screens; after content on browse pages. No native ads appear on account/admin pages. No automatic refresh, fixed-size clipping, duplicate native container or application iframe wrapper is used. Empty responses collapse. `ADSTERRA_NATIVE_ENABLED=false` disables passive ads and their consent prompt, retaining only voluntary sponsored links. The default is enabled for the real edition.

Native ads run as third-party scripts in the page, as required by the vendor. They are not isolated from the application DOM. Ad preferences and privacy wording disclose the provider and let visitors withdraw: removing the placement stops new requests here, but cannot reverse information already received by partners or third-party code already executed. This opt-in is not a claim of certification under a network CMP standard.

The separate Smartlink (32002493, BackInIt sponsored offers) uses the publisher-issued public URL `https://asiafilm.org/4/03e480f030ce8a18c8c3de500ca10b7d`. It is explicitly labelled Sponsored, opens only after a voluntary visitor click, and never intercepts Play. No popunder, forced advertiser click, VAST, rewarded or pre-watch access gate is installed.

## Support decision

Adsterra support explicitly rejected placing ad code inside our iframe wrapper and said VAST is unsupported. They suggested Popunder, Social Bar and Native Banner. The original sandbox banner implementation has been removed; `ADSTERRA_IFRAME_APPROVED` is obsolete and has no effect. Suggested formats do not approve disguising ads as playback controls or requiring ordinary ad clicks to unlock content.

The inactive legacy account units are 32002378 (300×250), 32002379 (320×50), and 32002380 (728×90). Their scripts are not loaded.

## Verification and earnings

Automated tests intercept vendor requests and never generate real impressions, advertiser visits or clicks. They cover the exact direct tag, one container per page, consent/withdrawal, responsive layout, no-fill and exclusion from account pages. Dashboard Active, script HTTP 200 or a loaded tag do not prove a creative was delivered or revenue earned. Record visible production fill separately. No earnings or withdrawal have been verified.

Payout configuration, identity/tax verification and withdrawal remain account-owner actions. Never invent financial details, income guarantees or ads.txt seller records. Only use network-issued seller records.
