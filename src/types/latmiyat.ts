export interface LatmiyatTrack {
  id: string;
  trackId: number;
  title: string;
  artistName: string;
  albumName: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
  releaseDate: string | null;
  durationMillis: number;
}

