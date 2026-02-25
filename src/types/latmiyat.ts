export interface LatmiyatTrack {
  id: string;
  trackId: string;
  title: string;
  artistName: string;
  albumName: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
  releaseDate: string | null;
  durationMillis: number;
}
