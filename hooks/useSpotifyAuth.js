import { useState, useEffect, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const CLIENT_ID = Constants.expoConfig?.extra?.spotifyClientId ?? '';

const SCOPES = [
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
];

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const REFRESH_TOKEN_KEY = 'spotify_refresh_token';

export function useSpotifyAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'spotifyplaylists',
    path: 'callback',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri,
    },
    DISCOVERY,
  );

  // On mount, try to restore session from stored refresh token
  useEffect(() => {
    restoreSession();
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success' && request?.codeVerifier) {
      handleAuthCode(response.params.code, request.codeVerifier);
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [response]);

  const restoreSession = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await refreshAccessToken(refreshToken);
      }
    } catch {
      // No stored session or refresh failed — user will need to log in
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleAuthCode = async (code, codeVerifier) => {
    try {
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: codeVerifier },
        },
        DISCOVERY,
      );

      setAccessToken(tokenResult.accessToken);
      if (tokenResult.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResult.refreshToken);
      }
    } catch (e) {
      console.error('Token exchange failed:', e);
    }
  };

  const refreshAccessToken = async (refreshToken) => {
    try {
      const tokenResult = await AuthSession.refreshAsync(
        {
          clientId: CLIENT_ID,
          refreshToken,
        },
        DISCOVERY,
      );

      setAccessToken(tokenResult.accessToken);
      if (tokenResult.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResult.refreshToken);
      }
      return tokenResult.accessToken;
    } catch (e) {
      // Refresh token is invalid or revoked — clear it so the user is prompted to log in
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
      throw e;
    }
  };

  const login = useCallback(() => {
    promptAsync();
  }, [promptAsync]);

  const logout = useCallback(async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }, []);

  return {
    accessToken,
    loading,
    login,
    logout,
    isReady: !!request,
  };
}
