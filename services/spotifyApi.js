const BASE_URL = 'https://api.spotify.com/v1';

async function apiRequest(token, endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getUserProfile(token) {
  return apiRequest(token, '/me');
}

export async function getCurrentlyPlaying(token) {
  return apiRequest(token, '/me/player/currently-playing');
}

export async function getAllPlaylists(token) {
  const playlists = [];
  let nextUrl = `${BASE_URL}/me/playlists?limit=50`;

  while (nextUrl) {
    const data = await apiRequest(token, nextUrl);
    playlists.push(...data.items);
    nextUrl = data.next ?? null;
  }

  return playlists;
}

export async function createPlaylist(token, userId, name, year) {
  return apiRequest(token, `/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      public: false,
      description: `Songs from ${year}, added by SpotifyPlaylists`,
    }),
  });
}

export async function isTrackInPlaylist(token, playlistId, trackUri) {
  let nextUrl = `${BASE_URL}/playlists/${playlistId}/tracks?limit=50&fields=next,items(track(uri))`;

  while (nextUrl) {
    const data = await apiRequest(token, nextUrl);
    if (data.items.some((item) => item.track?.uri === trackUri)) {
      return true;
    }
    nextUrl = data.next ?? null;
  }

  return false;
}

export async function addTrackToPlaylist(token, playlistId, trackUri) {
  return apiRequest(token, `/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris: [trackUri] }),
  });
}
