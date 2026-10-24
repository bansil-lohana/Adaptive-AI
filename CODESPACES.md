# Running Adaptive AI in GitHub Codespaces

## Start the API and Expo together

Set the API URL in the terminal before launching both services. Codespaces
provides `CODESPACE_NAME`; alternatively, copy the exact forwarded HTTPS URL
for port `5000` from the **Ports** tab:

```sh
export EXPO_PUBLIC_API_URL="https://${CODESPACE_NAME}-5000.app.github.dev"
pnpm run dev
```

This starts the API on port `5000` and Expo Metro concurrently. Open the
**Ports** tab to verify port `5000` is forwarded.

To start each process in its own terminal instead, use the API and Expo
commands below.

## Start the API only

In a Codespaces terminal, start the Express API on port 5000:

```sh
pnpm --filter @workspace/api-server run dev
```

Keep this terminal running. In the Codespaces **Ports** tab, make sure port
`5000` is forwarded. Native requests from the phone cannot use the Codespaces
browser sign-in; if private forwarding blocks the requests, set port `5000`'s
visibility to **Public** in the Ports tab. Public visibility makes the API
reachable without GitHub login, so use it only if the API can safely be
exposed. Do not put credentials or API keys in the URL.

## Run on an Android phone with Expo Go

In a second terminal, set the API URL to the Codespaces forwarded HTTPS URL.
`CODESPACE_NAME` is provided by Codespaces; alternatively, copy the exact
forwarded address for port 5000 from the **Ports** tab:

```sh
export EXPO_PUBLIC_API_URL="https://${CODESPACE_NAME}-5000.app.github.dev"
```

From the Expo app directory, start Expo directly with:

```sh
npx expo start
```

For Codespaces-to-phone connections, start Expo with its tunnel instead:

```sh
npx expo start --tunnel
```

Install **Expo Go** from the Play Store on the Android phone, then scan the QR
code printed by Expo with Expo Go. Keep the API terminal running while using
the app. Restart Expo after changing `EXPO_PUBLIC_API_URL`.

## Build and install an Android APK with EAS

Set `EXPO_PUBLIC_API_URL` in the terminal that will run the EAS build, using the
same forwarded HTTPS URL as above. Run EAS from the Expo app directory, then
log in and build the internal preview APK:

```sh
cd artifacts/adaptive-ai
export EXPO_PUBLIC_API_URL="https://${CODESPACE_NAME}-5000.app.github.dev"
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Download the APK from the EAS build link and install it on the Android device.
Use the `production` profile when you need an Android App Bundle for store
distribution.

## Run the offline demo

The offline demo bypasses API and Supabase authentication requests. It starts
directly in a demo session, stores timetable/profile/conversation changes on the
device, and returns clearly labeled placeholder AI, voice, and image answers.
Timetable image extraction and real AI analysis still require the API server.
Do not enable this flag for production builds.

From the Expo app directory, set the flag before starting Metro:

```sh
cd artifacts/adaptive-ai
export EXPO_PUBLIC_OFFLINE_MOCK_MODE=true
npx expo start --tunnel
```

Use Expo Go to scan the QR code. The phone does not need to reach port 5000 in
this mode. Restart Expo after changing the flag.
