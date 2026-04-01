/**
 * app.js — Spotify Year Playlist
 *
 * Uses the Spotify Web API with the PKCE Authorization Code Flow (no server needed).
 * Scopes required:
 *   user-read-currently-playing
 *   playlist-read-private
 *   playlist-modify-public
 *   playlist-modify-private
 */

const TOKEN_REFRESH_BUFFER_MS = 60_000; // refresh token 1 minute before expiry

const SCOPES = [
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

// ── PKCE helpers ────────────────────────────────────────────────────────────

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}

// ── Token storage ────────────────────────────────────────────────────────────

function saveTokens(data) {
  const expiresAt = Date.now() + data.expires_in * 1000;
  sessionStorage.setItem('access_token', data.access_token);
  sessionStorage.setItem('refresh_token', data.refresh_token);
  sessionStorage.setItem('expires_at', String(expiresAt));
}

function getAccessToken() {
  return sessionStorage.getItem('access_token');
}

function isTokenExpired() {
  const expiresAt = sessionStorage.getItem('expires_at');
  if (!expiresAt) return true;
  return Date.now() > parseInt(expiresAt, 10) - TOKEN_REFRESH_BUFFER_MS;
}

async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!resp.ok) return false;
  const data = await resp.json();
  saveTokens(data);
  return true;
}

async function ensureValidToken() {
  if (!getAccessToken()) return false;
  if (isTokenExpired()) return refreshAccessToken();
  return true;
}

// ── Spotify API helpers ──────────────────────────────────────────────────────

async function spotifyFetch(path, options = {}) {
  const token = getAccessToken();
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return resp;
}

async function getCurrentlyPlaying() {
  const resp = await spotifyFetch('/me/player/currently-playing');
  if (resp.status === 204) return null; // nothing playing
  if (!resp.ok) throw new Error(`Failed to get currently playing: ${resp.status}`);
  return resp.json();
}

async function getCurrentUserId() {
  const resp = await spotifyFetch('/me');
  if (!resp.ok) throw new Error('Failed to get user profile');
  const data = await resp.json();
  return data.id;
}

/**
 * Fetches all of the current user's playlists (handles pagination).
 */
async function getAllPlaylists() {
  const playlists = [];
  let url = '/me/playlists?limit=50';

  while (url) {
    const resp = await spotifyFetch(url);
    if (!resp.ok) throw new Error('Failed to fetch playlists');
    const data = await resp.json();
    playlists.push(...data.items);
    // next is a full URL like https://api.spotify.com/v1/me/playlists?offset=50&limit=50
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }

  return playlists;
}

/**
 * Finds a playlist owned by the user whose name exactly matches `name`.
 */
async function findPlaylistByName(name, userId) {
  const playlists = await getAllPlaylists();
  return playlists.find(
    (p) => p.name === name && p.owner.id === userId
  ) || null;
}

/**
 * Creates a new private playlist named `name` for the user.
 */
async function createPlaylist(userId, name) {
  const resp = await spotifyFetch(`/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      public: false,
      description: `Songs released in ${name} — created by Spotify Year Playlist`,
    }),
  });
  if (!resp.ok) throw new Error(`Failed to create playlist: ${resp.status}`);
  return resp.json();
}

/**
 * Checks whether a track URI is already in a given playlist.
 */
async function isTrackInPlaylist(playlistId, trackUri) {
  let url = `/playlists/${playlistId}/tracks?fields=next,items(track(uri))&limit=100`;

  while (url) {
    const resp = await spotifyFetch(url);
    if (!resp.ok) throw new Error('Failed to check playlist tracks');
    const data = await resp.json();
    if (data.items.some((item) => item.track && item.track.uri === trackUri)) {
      return true;
    }
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return false;
}

/**
 * Adds a track URI to a playlist.
 */
async function addTrackToPlaylist(playlistId, trackUri) {
  const resp = await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris: [trackUri] }),
  });
  if (!resp.ok) throw new Error(`Failed to add track: ${resp.status}`);
}

// ── Auth flow ────────────────────────────────────────────────────────────────

async function startLogin() {
  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function handleCallback(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('Missing PKCE verifier');

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error_description || `Token exchange failed: ${resp.status}`);
  }

  const data = await resp.json();
  saveTokens(data);
  sessionStorage.removeItem('pkce_verifier');

  // Clean the ?code= from the URL so a page refresh doesn't re-use the code.
  window.history.replaceState({}, '', window.location.pathname);
}

// ── Main action ──────────────────────────────────────────────────────────────

async function addCurrentSongToYearPlaylist() {
  const valid = await ensureValidToken();
  if (!valid) {
    setStatus('Session expired. Please log in again.', 'error');
    showView('login');
    return;
  }

  setStatus('Getting currently playing song…', 'loading');

  const playing = await getCurrentlyPlaying();
  if (!playing || !playing.item) {
    setStatus('Nothing is playing right now. Start a song on Spotify and try again.', 'error');
    return;
  }

  const track = playing.item;
  const trackName = track.name;
  const artistName = track.artists.map((a) => a.name).join(', ');
  const trackUri = track.uri;
  const releaseDate = track.album && track.album.release_date;
  if (!releaseDate || !/^\d{4}/.test(releaseDate)) {
    setStatus('Could not determine the release year for this track.', 'error');
    return;
  }
  const year = releaseDate.split('-')[0];

  const safeTrackName = escapeHtml(trackName);
  const safeArtistName = escapeHtml(artistName);
  const safeYear = escapeHtml(year);

  setStatus(`Found: "${safeTrackName}" by ${safeArtistName} (${safeYear}). Looking for playlist…`, 'loading');

  const userId = await getCurrentUserId();

  let playlist = await findPlaylistByName(year, userId);
  if (!playlist) {
    setStatus(`Creating playlist "${safeYear}"…`, 'loading');
    playlist = await createPlaylist(userId, year);
  }

  const alreadyAdded = await isTrackInPlaylist(playlist.id, trackUri);
  if (alreadyAdded) {
    setStatus(
      `"${safeTrackName}" is already in your <strong>${safeYear}</strong> playlist!`,
      'info'
    );
    return;
  }

  await addTrackToPlaylist(playlist.id, trackUri);
  setStatus(
    `✅ Added <strong>${safeTrackName}</strong> by ${safeArtistName} to your <strong>${safeYear}</strong> playlist!`,
    'success'
  );
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showView(name) {
  document.querySelectorAll('[data-view]').forEach((el) => {
    el.hidden = el.dataset.view !== name;
  });
}

/**
 * Updates the status element. `safeHtml` may only contain trusted static
 * markup (e.g. <strong>). User-supplied values must be escaped via escapeHtml
 * before being interpolated.
 */
function setStatus(safeHtml, type = '') {
  const el = document.getElementById('status');
  el.innerHTML = safeHtml;
  el.className = type;
  el.hidden = false;
}

function clearStatus() {
  const el = document.getElementById('status');
  el.innerHTML = '';
  el.hidden = true;
  el.className = '';
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

(async function init() {
  // If we don't have CLIENT_ID configured, tell the user.
  if (typeof CLIENT_ID === 'undefined' || CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID_HERE') {
    document.getElementById('config-warning').hidden = false;
    showView('login');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    setStatus(`Spotify login error: ${escapeHtml(error)}`, 'error');
    showView('login');
    return;
  }

  if (code) {
    try {
      await handleCallback(code);
    } catch (err) {
      setStatus(`Login failed: ${escapeHtml(err.message)}`, 'error');
      showView('login');
      return;
    }
  }

  if (getAccessToken() && !isTokenExpired()) {
    showView('app');
  } else {
    showView('login');
  }

  // Wire up buttons
  document.getElementById('login-btn').addEventListener('click', startLogin);
  document.getElementById('add-btn').addEventListener('click', async () => {
    clearStatus();
    document.getElementById('add-btn').disabled = true;
    try {
      await addCurrentSongToYearPlaylist();
    } catch (err) {
      setStatus(`Error: ${escapeHtml(err.message)}`, 'error');
    } finally {
      document.getElementById('add-btn').disabled = false;
    }
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.clear();
    showView('login');
    clearStatus();
  });
})();
