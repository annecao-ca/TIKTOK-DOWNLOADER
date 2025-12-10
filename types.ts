
export interface TikTokVideo {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  duration?: string;
  downloadUrl: string;
  musicUrl?: string; // URL for the audio track
  coverUrl: string;
}

export interface DownloadHistoryItem {
  id: string;
  video: TikTokVideo;
  timestamp: number;
  status: 'completed' | 'failed' | 'processing';
}

export enum DownloadType {
  SINGLE = 'SINGLE',
  CHANNEL = 'CHANNEL',
  LIST = 'LIST'
}