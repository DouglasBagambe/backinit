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

A loaded iframe is not proof of sustained video playback. WebView UI/navigation blocking cannot guarantee removal of ads inserted into the video feed. Generic cross-origin iframe media cannot be controlled through parent-document DOM access; provider APIs are required for reliable per-stream audio control. YouTube receives mute/unmute API messages. Other providers need individual validation or supported player integration before universal audio-control claims are made.
