import { TikTokVideo } from "../types";

// List of proxies to try in sequence if one fails
const PROXIES = [
  (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
  (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`
];

/**
 * Helper to fetch data via multiple proxies
 */
async function fetchWithProxyFallback(targetUrl: string): Promise<any> {
  for (const createProxyUrl of PROXIES) {
    const proxyUrl = createProxyUrl(targetUrl);
    try {
      // console.log(`Fetching via: ${proxyUrl}`); // Reduced logging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(proxyUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return data;
      } catch (e) {
        continue;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

/**
 * Fetches TikTok video data using a third-party API (TikWM).
 */
export const analyzeTikTokLink = async (url: string): Promise<TikTokVideo | null> => {
  let cleanUrl = url.trim();
  if (!cleanUrl) return null;

  const targetApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`;
  const data = await fetchWithProxyFallback(targetApiUrl);

  if (data && data.code === 0 && data.data) {
    const d = data.data;
    return {
      id: d.id,
      title: d.title || `TikTok Video ${d.id}`,
      author: d.author ? `@${d.author.nickname}` : "@unknown",
      thumbnail: d.cover,
      duration: d.duration ? String(d.duration) : '0',
      downloadUrl: d.play,
      musicUrl: d.music,
      coverUrl: d.cover
    };
  }

  return null;
};

export const extractUsername = (url: string): string | null => {
  const match = url.match(/@([a-zA-Z0-9_.-]+)/);
  return match ? match[1] : null;
};

interface ChannelResponse {
  videos: TikTokVideo[];
  nextCursor: number;
  hasMore: boolean;
}

/**
 * Fetches a batch of videos from a TikTok user channel.
 * Supports pagination via cursor.
 */
export const fetchChannelVideos = async (username: string, cursor: number = 0): Promise<ChannelResponse> => {
  console.log(`Fetching channel: ${username}, cursor: ${cursor}`);

  // TikWM user posts endpoint. Count 33 is roughly the max reliable batch size.
  const targetApiUrl = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=33&cursor=${cursor}&hd=1`;
  
  const data = await fetchWithProxyFallback(targetApiUrl);

  if (data && data.code === 0 && data.data) {
    const videoList = data.data.videos || [];
    const mappedVideos = videoList.map((d: any) => ({
      id: d.video_id || d.id,
      title: d.title || `Video ${d.id}`,
      author: `@${username}`,
      thumbnail: d.cover,
      duration: d.duration ? String(d.duration) : '0',
      downloadUrl: d.play,
      musicUrl: d.music,
      coverUrl: d.cover
    }));

    return {
      videos: mappedVideos,
      nextCursor: data.data.cursor ? Number(data.data.cursor) : 0,
      hasMore: data.data.hasMore === true || (data.data.cursor && data.data.cursor !== "0" && videoList.length > 0)
    };
  }

  return { videos: [], nextCursor: 0, hasMore: false };
};