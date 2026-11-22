# Islamic Radio (v2.0) — راديو الإسلام

Revival of **Islamic Radio** ([App Store `id1071852395`](https://apps.apple.com/us/app/islamic-radio/id1071852395)), rebuilt with **Expo (React Native + TypeScript)** and **`expo-audio`** for iOS and Android. It is forked from the iTarab Radio v3.0 codebase.

## Highlights

- **Verified Islamic station catalog (`catalog/stations.json`)** in 5 categories:
  - **Holy Quran Radio**: national Quran stations such as Sharjah, Jordan, Zitouna, Algeria, and Sana'a
  - **Reciters 24/7**: single-reciter channels from mp3quran.net and mp3islam.com, including Sudais, Shuraim, Alafasy, Minshawi, Abdulbasit, and Hussary
  - **Lectures & Tafsir**: seerah, adhkar, tafsir, and hadith
  - **Nasheeds**
  - **Islamic Radio Worldwide**: stations from the USA, the UK, Europe, and elsewhere
- **Hand-curated priority list (`catalog/curated-stations.json`)**: edit flagship stations and their `fallbackUrls` in one JSON file without touching app code.
- **Daily over-the-air sync and pull-to-refresh**: a GitHub Action re-verifies every stream daily. The app picks up changes within 24 hours, with no App Store release needed.
- **Automatic failover to backup streams**, background playback, and Lock Screen / Control Center controls.

## App Store Connect identity

| Field | Value |
| :--- | :--- |
| Apple ID | `1071852395` |
| Bundle ID | `com.almojor.islamicradio` (set in `app.json` → `expo.ios.bundleIdentifier`) |
| SKU | `com.almojor.islamradio` |
| Previous version | `1.0.0` → this release: **`2.0.0`** (build `1`) |

## Run locally

```bash
cd islamic-radio
npm install
npx expo prebuild --platform ios
npx expo run:ios
```

> Background audio and Lock Screen controls need a native development build. They are disabled in Expo Go.

## Ship the update to the existing listing

```bash
npx expo prebuild --platform ios --clean
open ios/IslamicRadio.xcworkspace
```

1. Under **Signing & Capabilities**, select your team. Confirm **Background Modes → Audio** is enabled.
2. Choose **Product → Archive**, then upload to App Store Connect.
3. In App Store Connect, update the listing (see the checklist in the revival notes).

## Managing stations

```bash
npm run verify-stations   # re-probe curated + existing stations, drop dead ones
npm run curate-stations   # full discovery (Radio-Browser + mp3quran.net) + live probing
npm run test:catalog      # schema + search/filter checks
```

The catalog URL is set in `app.json` → `expo.extra.catalogUrl`:
`https://raw.githubusercontent.com/fekrik/islamic-radio/main/catalog/stations.json`
