import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import {
  getUserProfile,
  getCurrentlyPlaying,
  getAllPlaylists,
  createPlaylist,
  isTrackInPlaylist,
  addTrackToPlaylist,
} from '../services/spotifyApi';

const COLORS = {
  background: '#191414',
  primary: '#1DB954',
  text: '#FFFFFF',
  subtext: '#B3B3B3',
  error: '#E74C3C',
  card: '#282828',
};

export default function HomeScreen() {
  const { accessToken, loading, login, logout, isReady } = useSpotifyAuth();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'info', message }
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (accessToken) {
      getUserProfile(accessToken).then(setProfile).catch(() => setProfile(null));
    } else {
      setProfile(null);
    }
  }, [accessToken]);

  const addToYearPlaylist = async () => {
    if (!accessToken || isWorking) return;

    setIsWorking(true);
    setStatus({ type: 'info', message: 'Getting current track…' });

    try {
      const playing = await getCurrentlyPlaying(accessToken);

      if (!playing || !playing.item || playing.currently_playing_type !== 'track') {
        setStatus({ type: 'error', message: 'No track currently playing.' });
        return;
      }

      const track = playing.item;
      const trackName = track.name;
      const artist = track.artists.map((a) => a.name).join(', ');
      const trackUri = track.uri;
      const releaseDate = track.album.release_date;

      const yearMatch = releaseDate.match(/^(\d{4})/);
      if (!yearMatch) {
        setStatus({ type: 'error', message: 'Could not determine track release year.' });
        return;
      }
      const year = yearMatch[1];

      setStatus({ type: 'info', message: `Finding playlist for ${year}…` });

      const userProfile = profile ?? (await getUserProfile(accessToken));
      const userId = userProfile.id;

      const playlists = await getAllPlaylists(accessToken);
      // Exact match: playlists created by this app are named exactly as the year (e.g. "2019")
      let playlist = playlists.find((p) => p.name === year) ?? null;

      if (!playlist) {
        setStatus({ type: 'info', message: `Creating playlist "${year}"…` });
        playlist = await createPlaylist(accessToken, userId, year, year);
      }

      setStatus({ type: 'info', message: 'Checking for duplicates…' });
      const alreadyIn = await isTrackInPlaylist(accessToken, playlist.id, trackUri);

      if (alreadyIn) {
        setStatus({
          type: 'info',
          message: `"${trackName}" by ${artist} is already in "${year}".`,
        });
        return;
      }

      setStatus({ type: 'info', message: 'Adding track…' });
      await addTrackToPlaylist(accessToken, playlist.id, trackUri);

      setStatus({
        type: 'success',
        message: `Added "${trackName}" by ${artist} to "${year}"! 🎵`,
      });
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'An error occurred.' });
    } finally {
      setIsWorking(false);
    }
  };

  // Initial loading state (restoring session)
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Login screen
  if (!accessToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <SpotifyIcon />
          <Text style={styles.title}>SpotifyPlaylists</Text>
          <Text style={styles.subtitle}>
            Add your currently playing song to a playlist named after its release year.
          </Text>
          <TouchableOpacity
            style={[styles.button, !isReady && styles.buttonDisabled]}
            onPress={login}
            disabled={!isReady}
          >
            <Text style={styles.buttonText}>Connect with Spotify</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <SpotifyIcon />
        {profile && (
          <Text style={styles.greeting}>Hi, {profile.display_name || profile.id}!</Text>
        )}

        <TouchableOpacity
          style={[styles.button, isWorking && styles.buttonDisabled]}
          onPress={addToYearPlaylist}
          disabled={isWorking}
        >
          {isWorking ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.buttonText}>Add to Year Playlist</Text>
          )}
        </TouchableOpacity>

        {status && (
          <View style={[styles.statusBox, styles[`status_${status.type}`]]}>
            <Text style={styles.statusText}>{status.message}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SpotifyIcon() {
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.iconSymbol}>♫</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconSymbol: {
    fontSize: 40,
    color: COLORS.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.subtext,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBox: {
    padding: 16,
    borderRadius: 8,
    width: '100%',
    maxWidth: 360,
  },
  status_success: {
    backgroundColor: '#1a3d2b',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  status_error: {
    backgroundColor: '#3d1a1a',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  status_info: {
    backgroundColor: COLORS.card,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.subtext,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  logoutButton: {
    marginTop: 8,
    padding: 12,
  },
  logoutText: {
    color: COLORS.subtext,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
