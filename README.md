# SpotifyPlaylists

A minimal app that adds the **currently playing Spotify song** to a playlist named after its **release year** — with a single tap.

Available as:
- **Android app** (React Native / Expo) — see [Android setup](#android-app-expo) below
- **Web app** (plain HTML + JS) — see [Web setup](#web-app) below

---

## How it works

1. You authenticate with Spotify (OAuth 2.0 PKCE — no server required).
2. You tap **Add to Year Playlist**.
3. The app reads the currently playing track and its release year.
4. It finds or creates a private playlist in your library named after that year (e.g. `2019`).
5. It adds the track to that playlist (duplicates are detected and skipped).

---

## Android App (Expo)

The Expo app is built with React Native and runs on Android (and iOS). It uses the same no-backend PKCE OAuth flow as the web app.

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Expo Go](https://expo.dev/go) installed on your Android device, **or** Android Studio for an emulator

### 1 — Create a Spotify app

1. Go to <https://developer.spotify.com/dashboard> and log in.
2. Click **Create app**.
3. Give it any name and description.
4. Add **both** of the following as Redirect URIs:
   - `spotifyplaylists://callback` — used by standalone / Expo Go builds
   - `exp://127.0.0.1:8081/--/callback` — used during local development with Expo Go (the port may vary; check your terminal output when you run `expo start`)
5. Save. Copy the **Client ID** shown on the app overview page.

### 2 — Configure the app

Open `app.json` and replace `YOUR_SPOTIFY_CLIENT_ID_HERE` with your Client ID:

```json
"extra": {
  "spotifyClientId": "paste-your-client-id-here"
}
```

> The Client ID is **not** a secret — it is a public app identifier. The PKCE flow never uses a client secret.

### 3 — Install dependencies

```bash
npm install
```

### 4 — Run on Android

```bash
# Start the Expo development server
npm start

# Then press 'a' to open on an Android emulator,
# or scan the QR code in the terminal with the Expo Go app on your phone.
```

To build a standalone APK / AAB for distribution, use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --platform android
```

### 5 — Use it

1. Open the app and tap **Connect with Spotify**.
2. Authorize the requested permissions.
3. Start playing a song on any Spotify device.
4. Tap **Add to Year Playlist** — done!

---

## Web App

The original web app requires no build step and runs entirely in a browser.

### 1 — Create a Spotify app

1. Go to <https://developer.spotify.com/dashboard> and log in.
2. Click **Create app** and give it any name.
3. Set the **Redirect URI** to the URL where you will serve `index.html`:
   - Local server example: `http://localhost:8080`
   - GitHub Pages example: `https://<your-username>.github.io/<your-repo>/`
4. Save. Copy the **Client ID**.

### 2 — Configure

```bash
cp config.example.js config.js
```

Edit `config.js`:

```js
const CLIENT_ID   = 'paste-your-client-id-here';
const REDIRECT_URI = 'http://localhost:8080'; // must match your Spotify dashboard
```

> `config.js` is listed in `.gitignore` — your Client ID will never be committed.

### 3 — Serve

The app must be served over HTTP (not opened as a `file://` URL):

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve . -l 8080
```

Open `http://localhost:8080` in your browser.

---

## Permissions requested

| Scope | Why |
|---|---|
| `user-read-currently-playing` | Read the track that is currently playing |
| `playlist-read-private` | Check your existing playlists for a year match |
| `playlist-modify-public` | Add tracks to public year playlists |
| `playlist-modify-private` | Add tracks to private year playlists (default) |

---

## File overview

| File / Directory | Purpose |
|---|---|
| `app/` | Expo Router screens (Android/iOS entry point) |
| `app/index.jsx` | Main screen UI |
| `app/_layout.jsx` | Root layout |
| `hooks/useSpotifyAuth.js` | PKCE auth hook using expo-auth-session |
| `services/spotifyApi.js` | Spotify Web API calls |
| `app.json` | Expo configuration (add your Client ID here) |
| `package.json` | Node/Expo dependencies |
| `index.html` | Web app UI |
| `app.js` | Web app Spotify logic |
| `config.example.js` | Web app config template |
| `config.js` | Your web app credentials (git-ignored) |
