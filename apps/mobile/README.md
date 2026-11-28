# Housive resident app

Expo (React Native) app for residents: Android first, with the same code running on the web. It talks to the NestJS
backend in `apps/backend`; the Next.js site in `apps/frontend` stays the office/committee console.

This folder is deliberately **not** an npm workspace (Expo pins its own React version), so install it on its own.

```bash
cd apps/mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL
npx expo start         # press a for Android, w for web
```

- Routes live in `src/app` (Expo Router). `(app)` holds everything behind sign-in; `(app)/(tabs)` is the bottom bar
  (Home, Services, Activity, Security, Help).
- Shared pieces: `src/components/ui.tsx` (header, cards, buttons, chips), `src/lib/api.ts` (API client, sends the
  `x-tenant-id` society header), `src/lib/auth.tsx` (sign-in, token in the device keychain via expo-secure-store).
- Checks: `npx tsc --noEmit`, `npx expo-doctor`.
- Android builds (needs a free Expo account): `npx eas-cli@latest login`, then `npx eas-cli@latest init` once (adds the
  project id to app.json), set the backend URL in `eas.json` (`EXPO_PUBLIC_API_URL`, currently a placeholder), then
  `npx eas-cli@latest build -p android --profile preview` for an installable APK.
- Sign-up is by invite only: the office opens Members → System users → the phone icon, and sends the member the code.
  The member taps "Have an invite code?" on the login screen. The same code resets a forgotten password.
- Security guards (role SECURITY_SUPERVISOR) see only the gate desk. The President, Secretary and estate manager find
  it under Security → Gate desk.
