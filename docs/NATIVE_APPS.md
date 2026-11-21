# BackInIt Android apps

BackInIt ships from one Expo/React Native codebase with two Android products:

- **BackInIt Mobile** (`live.backinit.mobile`): portrait-first touch UI with bottom navigation.
- **BackInIt TV** (`live.backinit.tv`): landscape Android TV UI with D-pad focus, large type and content rails.

Both apps consume the existing BackInIt API and include live channels, events, replays, saved channels, source switching and deep links for `backinit.live/watch`.

## Development

```bash
pnpm --filter @backinit/native start:mobile
pnpm --filter @backinit/native start:tv
```

Set `EXPO_PUBLIC_API_URL` to use another backend. The production default is `https://db.backinit.live/api`.

## Android builds

```bash
ANDROID_HOME=$HOME/Android/Sdk pnpm --filter @backinit/native prebuild:mobile
cd apps/native/android && ./gradlew assembleDebug

EXPO_TV=1 ANDROID_HOME=$HOME/Android/Sdk pnpm --filter @backinit/native prebuild:tv
cd apps/native/android && ./gradlew assembleDebug
```

The repository also contains EAS profiles for internal APKs and Play Store AABs in `apps/native/eas.json`. Store builds require production signing credentials and separate Google Play listings for the mobile and TV package IDs.
