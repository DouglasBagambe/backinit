# Native app audit — 22 November 2026

This is a verified-fixes record, not a claim that every third-party stream or device is supported.

## Screenshot defects addressed

- Replaced the decorative profile icon with a focusable Settings entry.
- Added Light, Dark and System appearance across navigation, cards, settings and playback controls. Preferences are stored on the device.
- Replaced fixed grid widths and leftover rail margins with responsive widths: four columns on wide TV layouts, three on smaller TV layouts, and one/two on phones/tablets.
- Added sport filters and search to live/channel browsing; shortened TV page introductions.
- Preserved channel logos with contain sizing and corrected Light-mode overlay contrast.
- Wrapped long Multiview selection names instead of allowing text overflow.
- Fixed the horizontal control bar consuming the video frame's height.
- Embedded providers in a sandboxed parent document with an HTTPS base URL/referrer. YouTube embeds receive API/origin parameters.
- Unmounted the Multiview wall when closed. Expansion now keeps other tiles mounted; muting all no longer automatically unmutes the first tile.
- Corrected upcoming event badges and removed unsupported “verified stream” copy.

## TV release verification

Release 1.0.3 / Android version code 4 built and installed over 1.0.2 on the Android TV API 36 emulator.

Observed:

- Remote navigation from Home into Live works.
- Settings opens, Light mode updates the app, and survives force-stop/relaunch.
- Live and Channels display four cards across the 1920×1080 emulator.
- Multiview selection names wrap within their buttons.
- NFL Network's player uses the available height.
- The exact PFL “Most Dominant Performances” replay from the report loads and plays; error 153 no longer appears.

Source failure still observed:

- NFL Network / Stream 3 (`dembed.st`) now recognizes that it is embedded but returns “Not allowed to stream. Contact admin.” This is an upstream access denial, not successful playback.

## Playback limits to retain in future audits

A loaded iframe is not proof of sustained video playback. WebView UI/navigation blocking cannot guarantee removal of ads inserted into the video feed. Generic cross-origin iframe media cannot be controlled through parent-document DOM access. Release 1.0.4 adds Android WebView output muting where the installed WebView supports MUTE_AUDIO; older engines retain provider-specific fallback. YouTube receives mute/unmute API messages. Other providers need individual validation or supported player integration before universal audio-control claims are made.

## Follow-up release checks

- Fixed a stale mute-state closure: provider DOM changes now read the current mute choice. Repeated unmute no longer resets the user's media volume. Two executable regression tests reproduce mute/unmute followed by a provider DOM mutation.
- Mobile 1.0.3 installed over 1.0.1 on the Android 9/API 28 emulator and loaded 469 catalogue entries (402 channels, 67 events). Settings, Light appearance, restart persistence and channel browsing were inspected.
- Mobile Multiview opens two stacked tiles, expands/restores a tile while retaining two WebViews, retains the all-muted UI state, and releases the WebViews on exit.
- Final TV build displays two side-by-side tiles and four tiles in a 2×2 grid at 1920×1080. Expanding a tile retains all four WebViews. This verifies the wall layout and lifecycle, not four simultaneous decoded videos.
- Both universal APKs contain arm64-v8a, armeabi-v7a, x86 and x86_64 libraries, require Android 7/API 24 or later, and pass APK signature verification.
- Full CI for code commit `bd0e807` passed (typecheck, unit suite, builds and browser checks). The focused native suite passed five files/eight tests.
- The API 36 TV emulator had boot/graphics failures during concurrent compilation. It was restarted with host graphics before final TV checks; these failed emulator sessions are not app performance passes.

### Remaining release limits

- The tested live provider frames initially remain black, then show provider Play controls. This must not be counted as decoded live playback.
- Earlier NFL Network Stream 3 returned an upstream access denial. Alternative source availability remains provider-dependent.
- Universal provider mute and complete removal of ads inside third-party video feeds are not verified or guaranteed by these fixes.
- Emulator checks do not certify every physical Android phone or TCL model. Long-session stability and simultaneous multi-video decoding remain separate from layout/lifecycle checks.

## Release 1.0.4 output-audio verification

- Added an Expo plugin and native Android module using AndroidX WebViewCompat.setAudioMuted. This mutes the complete WebView output, including nested frames, independently for each player. Unsupported WebView engines retain the existing provider fallback.
- Repeated changes on the final TV release were verified against native readback on API 36 / WebView 143: first tile alone audible, second tile alone audible, all four muted, first tile alone audible again, then all muted again. Every player reported the expected native mute flag. The emulator runs without host audio; these are native state checks, not listening tests.
- Switching sources and reloading retained mute. Expanding/restoring the wall retained its selection; exiting removed all WebViews from the UI hierarchy. These checks do not certify four simultaneous decoded video feeds.
- Fixed callback-ref detachment clearing player identity during ordinary rerenders, which had broken repeated native mute changes.
- Both 1.0.4 universal APKs pass signature verification. TV installed as an update over the earlier build. Focused audio controller tests cover supported native output, unsupported fallback, rapid changes and unavailable native views.
- Settings displays the installed native version instead of a hardcoded version. Website advertising and cookie code are unchanged.
