export interface Track {
  id: string;
  title: string;
  fileName?: string;
  fileUrl?: string;
}

export interface Release {
  id?: string;
  title: string;
  artist: string;
  genre: string;
  releaseDate: string;
  upc?: string;
  artworkUrl?: string;
  tracks: Track[];
  platforms: string[];
  status: 'draft' | 'submitted' | 'processing' | 'distributed';
  userId: string;
  createdAt: any;
  updatedAt: any;
}

export const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', uploadUrl: 'https://studio.youtube.com/' },
  { id: 'soundcloud', name: 'SoundCloud', uploadUrl: 'https://soundcloud.com/upload' },
  { id: 'audiomack', name: 'Audiomack', uploadUrl: 'https://audiomack.com/dashboard/upload' },
  { id: 'bandcamp', name: 'Bandcamp', uploadUrl: 'https://bandcamp.com/upload' },
  { id: 'tunestotube', name: 'TunestoTube', uploadUrl: 'https://www.tunestotube.com/' },
  { id: 'mixcloud', name: 'Mixcloud', uploadUrl: 'https://www.mixcloud.com/upload/' },
  { id: 'spotify_artists', name: 'Spotify for Artists', uploadUrl: 'https://artists.spotify.com/' },
  { id: 'apple_artists', name: 'Apple Music for Artists', uploadUrl: 'https://artists.apple.com/' },
  { id: 'amazon_artists', name: 'Amazon Music for Artists', uploadUrl: 'https://artists.amazon.com/' },
  { id: 'tidal_artists', name: 'Tidal for Artists', uploadUrl: 'https://artists.tidal.com/' }
];
