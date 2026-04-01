# SpotifyPlaylists

A minimal, mobile-friendly web app that adds the **currently playing Spotify song** to a playlist named after its **release year** — with a single tap.

---

## How it works

1. You authenticate with Spotify (OAuth 2.0 PKCE — no server required, your credentials stay in the browser).
2. You tap **Add to Year Playlist**.
3. The app reads the currently playing track and its release year.
4. It finds or creates a private playlist in your library named after that year (e.g. `2019`).
5. It adds the track to that playlist (duplicates are detected and skipped).

---

## Quick start

### 1 — Create a Spotify app

1. Go to <https://developer.spotify.com/dashboard> and log in.
2. Click **Create app**.
3. Give it any name and description.
4. Set the **Redirect URI** to the URL where you will open `index.html`.  
   - Local file server example: `http://localhost:8080`  
   - GitHub Pages example: `https://<your-username>.github.io/<your-repo-name>/` (must match the exact repository name, which is case-sensitive)
5. Save. Copy the **Client ID** shown on the app overview page.

### 2 — Configure the app

```bash
cp config.example.js config.js
```

Open `config.js` and fill in:

```js
const CLIENT_ID  = 'paste-your-client-id-here';
const REDIRECT_URI = 'http://localhost:8080'; // must match what you set in the Spotify dashboard
```

> `config.js` is listed in `.gitignore` — your Client ID will never be committed.

### 3 — Serve the files

The app must be served over HTTP (not opened as a `file://` URL) so that the Spotify redirect can return to it.

Any static file server works. Examples:

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve . -l 8080

# VS Code — install the "Live Server" extension and click "Go Live"
```

Open `http://localhost:8080` in your browser (or on your phone if your machine and phone are on the same network, replace `localhost` with your machine's local IP).

### 4 — Use it

1. Open the app and tap **Connect with Spotify**.
2. Authorize the requested permissions.
3. Start playing a song on any Spotify device.
4. Tap **Add to Year Playlist** — done!

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

| File | Purpose |
|---|---|
| `index.html` | Single-page UI (mobile-friendly, one button) |
| `app.js` | All Spotify API logic (PKCE auth, API calls) |
| `config.example.js` | Template — copy to `config.js` and fill in credentials |
| `config.js` | Your credentials (git-ignored, you create this) |
