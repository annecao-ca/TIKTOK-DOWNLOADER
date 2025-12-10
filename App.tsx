import React, { useState, useEffect, useRef } from 'react';
import { analyzeTikTokLink, fetchChannelVideos, extractUsername } from './services/geminiService';
import { TikTokVideo, DownloadHistoryItem, DownloadType } from './types';
import { HistoryList } from './components/HistoryList';

// --- Sub-components for different pages ---

const FAQSection = () => (
  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
    <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
    {[
      { q: "Is it free to download TikTok videos?", a: "Yes, TikTok Downloader is 100% free and does not require any payment or registration." },
      { q: "Where are videos saved?", a: "Videos are saved to your device's default download folder (e.g., Downloads folder on PC, Gallery or Files app on Mobile)." },
      { q: "Does it support downloading MP3?", a: "Yes, you can extract and download the background music (MP3) from any TikTok video." },
      { q: "Why did the download open in a new tab?", a: "Sometimes browser security settings prevent automatic downloads. If the video opens in a new tab, simply right-click (or long press on mobile) and select 'Save Video As'." }
    ].map((item, idx) => (
      <div key={idx} className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <i className="fa-solid fa-circle-question text-[#25f4ee]"></i>
          {item.q}
        </h3>
        <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
      </div>
    ))}
  </div>
);

const LegalSection = ({ title }: { title: string }) => (
  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4">
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <div className="space-y-4 text-sm text-slate-400">
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <p>This service is provided "as is" without warranty of any kind. We do not host any video content. All videos are hosted on TikTok's servers.</p>
      <p>Users are responsible for ensuring they have the right to download and use the content. This tool is for personal use only.</p>
      <p>We do not store your personal data or download history on our servers. All data is processed locally in your browser.</p>
    </div>
  </div>
);

const SEOContent = () => (
  <div className="mt-16 space-y-8 text-slate-400 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-8">
    <section>
      <h3 className="text-xl font-bold text-slate-200 mb-3">Best TikTok Downloader 2025</h3>
      <p>
        Looking for the best <strong>TikTok Downloader</strong>? Our tool allows you to save videos from TikTok without the watermark. 
        Whether you want to keep funny clips, tutorials, or music videos, our TikTok Downloader is the fastest and easiest solution. 
        It works on all devices—Android, iOS, Windows, and Mac.
      </p>
    </section>
    
    <div className="grid md:grid-cols-2 gap-8">
      <section>
        <h3 className="text-lg font-bold text-slate-200 mb-2">Key Features</h3>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>No Watermark:</strong> Download TikTok videos clean, without the TikTok logo.</li>
          <li><strong>HD Quality:</strong> Get the highest resolution available (HD/Full HD).</li>
          <li><strong>TikTok to MP3:</strong> Easily convert and download TikTok audio/music.</li>
          <li><strong>Free & Unlimited:</strong> No costs, no download limits.</li>
        </ul>
      </section>
      
      <section>
        <h3 className="text-lg font-bold text-slate-200 mb-2">How to Download TikTok Videos?</h3>
        <p>
          Using our TikTok Downloader is simple. Just copy the video URL from the TikTok app or website, paste it into the search box above, 
          and hit the Download button. You can then choose to save the video in MP4 format or extract the audio as MP3.
        </p>
      </section>
    </div>
  </div>
);

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    error: 'border-red-500/50 bg-red-500/10 text-red-400',
    info: 'border-[#25f4ee]/50 bg-[#25f4ee]/10 text-[#25f4ee]'
  };

  return (
    <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-right-full ${colors[type]}`}>
      <i className={`fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle'}`}></i>
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><i className="fa-solid fa-xmark"></i></button>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'faq' | 'terms' | 'privacy'>('home');
  const [url, setUrl] = useState('');
  
  // State for single video
  const [currentVideo, setCurrentVideo] = useState<TikTokVideo | null>(null);
  
  // State for channel/list
  const [channelVideos, setChannelVideos] = useState<TikTokVideo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCursor, setScanCursor] = useState<number>(0);
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const [scanningUsername, setScanningUsername] = useState<string | null>(null);
  const abortScanRef = useRef<boolean>(false);

  // General UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, 'waiting' | 'downloading' | 'success' | 'error'>>({});

  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [downloadType, setDownloadType] = useState<DownloadType>(DownloadType.SINGLE);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('tiktok_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('tiktok_history', JSON.stringify(history));
  }, [history]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  };

  const validateUrl = (input: string) => {
    if (downloadType === DownloadType.SINGLE) return input.includes('tiktok.com');
    if (downloadType === DownloadType.CHANNEL) return input.includes('tiktok.com/@');
    // For List, check if at least one line has tiktok.com
    if (downloadType === DownloadType.LIST) return input.split(/\r?\n/).some(line => line.includes('tiktok.com'));
    return false;
  };

  const resetState = () => {
    setError(null);
    setChannelVideos([]);
    setCurrentVideo(null);
    setScanCursor(0);
    setHasMoreVideos(false);
    setScanningUsername(null);
    setDownloadProgress({});
    setLoadingProgress('');
    abortScanRef.current = false;
  };

  const handleDownload = async () => {
    resetState();
    setCurrentView('home'); 
    
    if (!url.trim()) return;
    if (!validateUrl(url)) {
      setError('Please enter valid TikTok URL(s)');
      showToast('Invalid URL provided', 'error');
      return;
    }

    setIsLoading(true);

    try {
      if (downloadType === DownloadType.SINGLE) {
        const videoData = await analyzeTikTokLink(url);
        
        if (videoData) {
          showToast('Video found successfully!', 'success');
          setCurrentVideo(videoData);
          // Removed automatic addToHistory here. It will be added upon successful download.
        } else {
          setError('Could not fetch video. Link might be invalid or private.');
          showToast('Video not found', 'error');
        }
        setIsLoading(false);
      } 
      else if (downloadType === DownloadType.CHANNEL) {
        // Channel Mode - Initial Fetch
        const username = extractUsername(url);
        if (!username) {
          setError('Could not find username in URL.');
          setIsLoading(false);
          return;
        }

        setScanningUsername(username);
        // Start recursive scan process
        await scanChannel(username, 0);
      }
      else if (downloadType === DownloadType.LIST) {
        // List Mode
        const lines = url.split(/\r?\n/).map(l => l.trim()).filter(l => l && l.includes('tiktok.com'));
        
        if (lines.length === 0) {
           setError('No valid TikTok links found in the list.');
           setIsLoading(false);
           return;
        }

        setScanningUsername('Custom Batch List');
        let foundCount = 0;
        
        // Process each link sequentially
        for (let i = 0; i < lines.length; i++) {
           setLoadingProgress(`Analyzing ${i + 1}/${lines.length}...`);
           try {
             const videoData = await analyzeTikTokLink(lines[i]);
             if (videoData) {
               // Check duplicate in current batch
               setChannelVideos(prev => {
                  if (prev.find(p => p.id === videoData.id)) return prev;
                  return [...prev, videoData];
               });
               foundCount++;
             }
             // Small delay to prevent rate limit
             await new Promise(r => setTimeout(r, 500));
           } catch (e) {
             console.error(`Failed to analyze line ${i}`, e);
           }
        }

        setIsLoading(false);
        setLoadingProgress('');
        if (foundCount === 0) {
           setError('Could not fetch any videos from the list.');
           showToast('No videos found', 'error');
        } else {
           showToast(`Processed list. Found ${foundCount} videos.`, 'success');
        }
      }
    } catch (err: any) {
      setError('An error occurred while processing the request.');
      showToast('Connection error', 'error');
      console.error(err);
      setIsLoading(false);
    }
  };

  // Function to recursively scan channel
  const scanChannel = async (username: string, cursor: number) => {
    setIsScanning(true);
    // Don't set isLoading to false immediately, we want to show we are working
    
    try {
      const response = await fetchChannelVideos(username, cursor);
      
      // If we got videos
      if (response.videos.length > 0) {
        setChannelVideos(prev => {
          // Filter duplicates just in case
          const newVideos = response.videos.filter(v => !prev.some(p => p.id === v.id));
          return [...prev, ...newVideos];
        });
      }

      setScanCursor(response.nextCursor);
      setHasMoreVideos(response.hasMore);

      if (cursor === 0) {
        // First fetch complete
        setIsLoading(false); 
        if (response.videos.length === 0) {
           setError('No videos found or profile is private.');
        } else {
           showToast(`Found ${response.videos.length} videos.`, 'success');
        }
      }

    } catch (e) {
      console.error("Scan error", e);
      if (cursor === 0) {
         setError('Failed to fetch channel data.');
         setIsLoading(false);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadMore = async () => {
    if (!scanningUsername || !hasMoreVideos) return;
    await scanChannel(scanningUsername, scanCursor);
  };

  // Automatically fetch next page if user wants to "Fetch All"
  // But due to API limits/time, we might want to do this via a "Scan All" button
  const handleScanAll = async () => {
    if (!scanningUsername) return;
    abortScanRef.current = false;
    setIsScanning(true);
    
    let currentCursor = scanCursor;
    let keepGoing = hasMoreVideos;

    // Safety limit: 1000 videos to prevent browser crash
    let safetyCounter = 0;
    const MAX_VIDEOS = 1000;

    while (keepGoing && !abortScanRef.current && channelVideos.length < MAX_VIDEOS && safetyCounter < 50) {
       safetyCounter++;
       try {
         const response = await fetchChannelVideos(scanningUsername, currentCursor);
         
         if (response.videos.length > 0) {
           setChannelVideos(prev => {
             const newVideos = response.videos.filter(v => !prev.some(p => p.id === v.id));
             return [...prev, ...newVideos];
           });
         }
         
         currentCursor = response.nextCursor;
         keepGoing = response.hasMore;
         
         // Small delay to be nice to proxies
         await new Promise(r => setTimeout(r, 1000));
       } catch (e) {
         console.error("Auto scan interrupted", e);
         break;
       }
    }
    
    setIsScanning(false);
    setHasMoreVideos(keepGoing);
    setScanCursor(currentCursor);
    showToast(`Scan complete. Total ${channelVideos.length} videos.`, 'success');
  };

  const stopScan = () => {
    abortScanRef.current = true;
    setIsScanning(false);
    showToast("Scanning stopped.", 'info');
  };

  const addToHistory = (video: TikTokVideo) => {
    const newHistoryItem: DownloadHistoryItem = {
      id: Date.now().toString(),
      video: video,
      timestamp: Date.now(),
      status: 'completed'
    };
    setHistory(prev => {
      const exists = prev.find(p => p.video.id === video.id);
      if (exists) return prev;
      return [newHistoryItem, ...prev];
    });
  };

  const handleFileDownload = async (fileUrl: string | undefined, type: 'video' | 'audio', filenamePrefix: string = 'ttdown') => {
    if (!fileUrl || fileUrl === '#') {
      // showToast("Link unavailable", 'error'); // Too noisy for batch
      return false;
    }

    const ext = type === 'video' ? 'mp4' : 'mp3';
    const filename = `${filenamePrefix}-${Date.now()}.${ext}`;

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      return true;
      
    } catch (e) {
      // Fallback for batch? usually opening in new tab is bad for batch.
      // For batch, we just fail silently or log.
      console.log(`Direct download failed for ${filename}`);
      return false;
    }
  };

  const handleBatchDownload = async () => {
    if (channelVideos.length === 0) return;

    if (!window.confirm(`Start downloading ${channelVideos.length} videos? This will process videos one by one.`)) {
      return;
    }

    setIsBatchDownloading(true);
    showToast('Starting batch download... Please keep this tab open.', 'info');
    
    // Initialize progress map
    const progressMap: Record<string, 'waiting' | 'downloading' | 'success' | 'error'> = {};
    channelVideos.forEach(v => progressMap[v.id] = 'waiting');
    setDownloadProgress(progressMap);

    let successCount = 0;
    
    // Process sequentially
    for (let i = 0; i < channelVideos.length; i++) {
      const video = channelVideos[i];
      setDownloadProgress(prev => ({ ...prev, [video.id]: 'downloading' }));
      
      try {
        const success = await handleFileDownload(video.downloadUrl, 'video', `${video.author.replace('@','')}-video-${i+1}`);
        if (success) {
            successCount++;
            setDownloadProgress(prev => ({ ...prev, [video.id]: 'success' }));
        } else {
            setDownloadProgress(prev => ({ ...prev, [video.id]: 'error' }));
        }
        
        // Add delay between downloads
        if (i < channelVideos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (e) {
        console.error(`Failed to download video ${video.id}`);
        setDownloadProgress(prev => ({ ...prev, [video.id]: 'error' }));
      }
    }

    setIsBatchDownloading(false);
    showToast(`Batch finished. Saved ${successCount}/${channelVideos.length} videos.`, 'success');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'faq': return <FAQSection />;
      case 'terms': return <LegalSection title="Terms of Service" />;
      case 'privacy': return <LegalSection title="Privacy Policy" />;
      default: return (
        <>
        {/* Search Input Area */}
        <div className="bg-slate-800/40 p-1.5 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm transition-all hover:border-slate-600 focus-within:ring-2 focus-within:ring-[#fe2c55]/50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              {downloadType === DownloadType.LIST ? (
                <>
                  <div className="absolute left-4 top-4 text-slate-500">
                    <i className="fa-solid fa-list-ul"></i>
                  </div>
                  <textarea
                    placeholder="Paste multiple TikTok links here (one per line)..."
                    className="w-full bg-transparent border-0 pl-11 pr-4 py-4 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 resize-none custom-scrollbar"
                    rows={4}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <i className="fa-solid fa-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input 
                    type="text"
                    placeholder={downloadType === DownloadType.SINGLE ? "Paste TikTok link here..." : "Paste channel link (@username)..."}
                    className="w-full bg-transparent border-0 pl-11 pr-4 py-4 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                  />
                </>
              )}
              
              {url && (
                <button 
                  onClick={() => setUrl('')}
                  className="absolute right-4 top-4 text-slate-500 hover:text-slate-300"
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>
            
            <button 
              onClick={handleDownload}
              disabled={isLoading || isScanning || !url}
              className={`px-8 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-[#fe2c55]/20 active:scale-95 flex-shrink-0 ${
                downloadType === DownloadType.LIST ? 'py-4' : 'py-3'
              } ${
                (isLoading || isScanning || !url)
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-[#fe2c55] to-[#f2295b] text-white hover:opacity-90'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="text-xs">{loadingProgress || "Processing"}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-down text-xl"></i>
                  <span>Download</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="type" 
              className="hidden" 
              checked={downloadType === DownloadType.SINGLE} 
              onChange={() => setDownloadType(DownloadType.SINGLE)} 
              disabled={isLoading || isScanning}
            />
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${downloadType === DownloadType.SINGLE ? 'border-[#fe2c55] bg-[#fe2c55]/20' : 'border-slate-600'}`}>
              <div className={`w-2 h-2 rounded-full bg-[#fe2c55] transition-all ${downloadType === DownloadType.SINGLE ? 'scale-100' : 'scale-0'}`}></div>
            </div>
            <span className={`text-sm ${downloadType === DownloadType.SINGLE ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>Single Video</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="type" 
              className="hidden" 
              checked={downloadType === DownloadType.CHANNEL} 
              onChange={() => setDownloadType(DownloadType.CHANNEL)} 
              disabled={isLoading || isScanning}
            />
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${downloadType === DownloadType.CHANNEL ? 'border-[#fe2c55] bg-[#fe2c55]/20' : 'border-slate-600'}`}>
              <div className={`w-2 h-2 rounded-full bg-[#fe2c55] transition-all ${downloadType === DownloadType.CHANNEL ? 'scale-100' : 'scale-0'}`}></div>
            </div>
            <span className={`text-sm ${downloadType === DownloadType.CHANNEL ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>Full Channel</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="type" 
              className="hidden" 
              checked={downloadType === DownloadType.LIST} 
              onChange={() => setDownloadType(DownloadType.LIST)} 
              disabled={isLoading || isScanning}
            />
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${downloadType === DownloadType.LIST ? 'border-[#fe2c55] bg-[#fe2c55]/20' : 'border-slate-600'}`}>
              <div className={`w-2 h-2 rounded-full bg-[#fe2c55] transition-all ${downloadType === DownloadType.LIST ? 'scale-100' : 'scale-0'}`}></div>
            </div>
            <span className={`text-sm ${downloadType === DownloadType.LIST ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>Batch List</span>
          </label>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 mt-16">
          <section className="space-y-6">
            {/* SINGLE VIDEO VIEW */}
            {currentVideo && !channelVideos.length && (
              <div className="bg-slate-800/40 rounded-2xl border border-slate-700 p-6 animate-in zoom-in duration-300">
                <div className="flex gap-4 mb-6">
                  <div className="w-24 h-36 rounded-xl overflow-hidden shadow-xl bg-slate-900 flex-shrink-0 group relative">
                    <img src={currentVideo.thumbnail} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fa-solid fa-play text-white"></i>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold line-clamp-2 leading-tight mb-2 text-slate-100">{currentVideo.title}</h3>
                    <p className="text-slate-400 text-sm mb-4">By <span className="text-[#25f4ee] hover:underline cursor-pointer">{currentVideo.author}</span></p>
                    <div className="flex gap-2 text-xs text-slate-500">
                      <span className="bg-slate-700/50 px-2 py-1 rounded border border-slate-700">HD MP4</span>
                      <span className="bg-slate-700/50 px-2 py-1 rounded border border-slate-700">No Logo</span>
                    </div>
                  </div>
                </div>
                
                {(() => {
                   const isDownloaded = history.some(h => h.video.id === currentVideo.id && h.status === 'completed');
                   
                   return (
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                        {isDownloaded ? (
                             <button 
                                disabled
                                className="flex items-center justify-center gap-2 bg-emerald-500/20 text-emerald-400 py-3 rounded-xl font-bold cursor-not-allowed border border-emerald-500/20"
                              >
                                <i className="fa-solid fa-check"></i>
                                <span>Downloaded</span>
                              </button>
                        ) : (
                              <button 
                                onClick={async () => {
                                   const success = await handleFileDownload(currentVideo.downloadUrl, 'video');
                                   if (success) addToHistory(currentVideo);
                                }}
                                className="flex items-center justify-center gap-2 bg-[#25f4ee] hover:bg-[#1fd9d4] text-slate-900 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-[0_0_20px_-5px_#25f4ee]"
                              >
                                <i className="fa-solid fa-download"></i>
                                <span>Download HD</span>
                              </button>
                        )}
                          <button 
                            onClick={async () => {
                                const success = await handleFileDownload(currentVideo.musicUrl || currentVideo.downloadUrl, 'audio');
                                if (success && !isDownloaded) addToHistory(currentVideo);
                            }}
                            className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 py-3 rounded-xl font-bold transition-all active:scale-95 border border-slate-600"
                          >
                            <i className="fa-solid fa-music"></i>
                            <span>Download MP3</span>
                          </button>
                        </div>
                        
                        {isDownloaded && (
                            <button 
                              onClick={() => handleFileDownload(currentVideo.downloadUrl, 'video')}
                              className="w-full flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 rounded-xl font-medium text-sm transition-all border border-dashed border-slate-600"
                            >
                              <i className="fa-solid fa-rotate-right"></i>
                              <span>Download Again</span>
                            </button>
                        )}
                    </div>
                   );
                })()}
              </div>
            )}

            {/* CHANNEL / LIST RESULTS VIEW */}
            {channelVideos.length > 0 && (
              <div className="bg-slate-800/40 rounded-2xl border border-slate-700 p-6 animate-in zoom-in duration-300 flex flex-col max-h-[600px]">
                 <div className="flex flex-col gap-3 mb-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">
                            {downloadType === DownloadType.LIST ? "Batch List Results" : `Channel: ${scanningUsername}`}
                        </h3>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                           {isScanning && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                           {isScanning ? "Scanning..." : "Found"} {channelVideos.length} videos
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {isScanning ? (
                           <button 
                             onClick={stopScan}
                             className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs font-bold transition-colors"
                           >
                             Stop Scan
                           </button>
                        ) : hasMoreVideos && downloadType === DownloadType.CHANNEL && (
                           <button 
                             onClick={handleScanAll}
                             className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs font-bold transition-colors flex items-center gap-1"
                           >
                             <i className="fa-solid fa-magnifying-glass-plus"></i>
                             Scan All
                           </button>
                        )}
                        <button 
                          onClick={handleBatchDownload}
                          disabled={isBatchDownloading || isScanning}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                            (isBatchDownloading || isScanning) ? 'bg-slate-600 cursor-not-allowed text-slate-400' : 'bg-[#fe2c55] hover:bg-[#d61f43] text-white shadow-lg'
                          }`}
                        >
                          {isBatchDownloading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-layer-group"></i>
                              Download All ({channelVideos.length})
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {channelVideos.map((video, idx) => {
                      const status = downloadProgress[video.id];
                      return (
                      <div key={`${video.id}-${idx}`} className="flex gap-3 p-2 rounded-lg hover:bg-slate-700/40 transition-colors border border-transparent hover:border-slate-600">
                         <img src={video.thumbnail} className="w-16 h-20 rounded object-cover bg-slate-900" alt="thumb" loading="lazy" />
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 line-clamp-1">{video.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{video.duration}s • {video.author}</p>
                            <div className="flex gap-2 mt-2">
                               {isBatchDownloading && status ? (
                                   <div className={`text-xs px-2 py-1.5 rounded flex items-center gap-2 font-medium w-fit ${
                                      status === 'waiting' ? 'bg-slate-700 text-slate-400' :
                                      status === 'downloading' ? 'bg-blue-500/20 text-blue-400' :
                                      status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                                      'bg-red-500/20 text-red-400'
                                   }`}>
                                       {status === 'waiting' && <><i className="fa-regular fa-clock"></i> Waiting</>}
                                       {status === 'downloading' && <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>}
                                       {status === 'success' && <><i className="fa-solid fa-check"></i> Saved</>}
                                       {status === 'error' && <><i className="fa-solid fa-xmark"></i> Failed</>}
                                   </div>
                               ) : (
                                   <button 
                                     onClick={() => handleFileDownload(video.downloadUrl, 'video')}
                                     className="text-xs bg-[#25f4ee]/10 text-[#25f4ee] px-2 py-1 rounded hover:bg-[#25f4ee]/20 transition-colors"
                                   >
                                     Download
                                   </button>
                               )}
                               {!isBatchDownloading && status === 'success' && (
                                   <span className="text-emerald-400 text-xs flex items-center px-1" title="Already downloaded in this session">
                                     <i className="fa-solid fa-check-double"></i>
                                   </span>
                               )}
                            </div>
                         </div>
                      </div>
                      );
                    })}
                    {hasMoreVideos && !isScanning && downloadType === DownloadType.CHANNEL && (
                      <button 
                        onClick={handleLoadMore} 
                        className="w-full py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg border border-dashed border-slate-700 transition-all"
                      >
                        Load more videos...
                      </button>
                    )}
                    {isScanning && (
                      <div className="text-center py-4 text-slate-500">
                        <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Scanning next page...
                      </div>
                    )}
                 </div>
              </div>
            )}

            {/* EMPTY STATE / PLACEHOLDER */}
            {!currentVideo && channelVideos.length === 0 && (
              <div className="bg-slate-800/20 border border-dashed border-slate-700 rounded-2xl h-[300px] flex flex-col items-center justify-center text-slate-500 hover:border-slate-600 transition-colors">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#fe2c55]/20 border-t-[#fe2c55] rounded-full animate-spin"></div>
                    <p className="animate-pulse">{loadingProgress || "Fetching info..."}</p>
                  </div>
                ) : (
                  <>
                    <i className="fa-solid fa-clapperboard text-4xl mb-4 opacity-20"></i>
                    <p className="text-sm">Video preview will appear here</p>
                  </>
                )}
              </div>
            )}
            
            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-4 select-none">
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-[#fe2c55]/20 transition-colors">
                   <i className="fa-solid fa-bolt text-[#fe2c55]"></i>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Super Fast</p>
              </div>
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-[#25f4ee]/20 transition-colors">
                   <i className="fa-solid fa-shield text-[#25f4ee]"></i>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Secure</p>
              </div>
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-2 group-hover:bg-[#fe2c55]/20 transition-colors">
                   <i className="fa-solid fa-infinity text-[#fe2c55]"></i>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unlimited</p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <HistoryList 
              items={history} 
              onClear={() => {
                if (window.confirm('Are you sure you want to clear your download history? This action cannot be undone.')) {
                  setHistory([]);
                  showToast('History cleared', 'success');
                }
              }}
              onDownload={(video) => {
                setDownloadType(DownloadType.SINGLE);
                setCurrentVideo(video);
                setChannelVideos([]);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                showToast("Loaded from history", 'info');
              }}
            />
            
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl">
              <h4 className="text-emerald-400 font-bold text-sm mb-2 flex items-center gap-2">
                <i className="fa-solid fa-circle-question"></i>
                How to use?
              </h4>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                <li>Open the TikTok app and copy the video link</li>
                <li>Paste the link into the search box above</li>
                <li>Click the download button</li>
                <li>Choose "Download HD" to save the video</li>
              </ol>
            </div>
          </section>
        </div>
        
        {/* SEO Content Section */}
        <SEOContent />
        </>
      );
    }
  };

  return (
    <div className="min-h-screen pb-20 flex flex-col items-center">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800 transition-all">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => setCurrentView('home')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#fe2c55] to-[#25f4ee] rounded-lg flex items-center justify-center shadow-lg shadow-[#fe2c55]/20">
              <i className="fa-brands fa-tiktok text-white text-lg"></i>
            </div>
            <h1 className="text-xl font-bold tracking-tight">TikTok <span className="text-[#fe2c55]">Downloader</span></h1>
          </button>
          <nav className="flex items-center gap-2 md:gap-6">
            <button 
              onClick={() => setCurrentView('home')}
              className={`text-sm font-medium px-2 py-1 rounded-lg transition-colors ${currentView === 'home' ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setCurrentView('faq')}
              className={`text-sm font-medium px-2 py-1 rounded-lg transition-colors ${currentView === 'faq' ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
            >
              FAQ
            </button>
            <button 
              onClick={() => showToast('Premium features coming soon!', 'info')}
              className="text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-xs hover:bg-emerald-400/20 transition-colors"
            >
              Premium
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl px-4 mt-12 flex-1">
        {currentView === 'home' && (
          <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              The Best TikTok Downloader <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fe2c55] via-[#ff512f] to-[#25f4ee]">Without Watermark</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              The fastest way to download TikTok videos in MP4 format without logos. Simply paste the link below to get started.
            </p>
          </div>
        )}
        
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-slate-800 w-full bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 text-slate-500 text-xs">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <p>&copy; 2024 TikTtok Downloader. All rights reserved.</p>
            <div className="flex gap-6">
              <button onClick={() => setCurrentView('privacy')} className="hover:text-slate-300 transition-colors">Privacy Policy</button>
              <button onClick={() => setCurrentView('terms')} className="hover:text-slate-300 transition-colors">Terms of Service</button>
              <a href="mailto:ngocanh.hyp@gmail.com" className="hover:text-slate-300 transition-colors">Contact Us</a>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-6 flex flex-col items-center md:items-start gap-2">
            <p className="font-semibold text-slate-400">Author Information</p>
            <div className="flex flex-col md:flex-row gap-2 md:gap-6 items-center md:items-start">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-user text-[#25f4ee]"></i> PHẠM NGỌC ÁNH
              </span>
              <a href="tel:0931887903" className="flex items-center gap-2 hover:text-[#25f4ee] transition-colors">
                <i className="fa-solid fa-phone text-[#25f4ee]"></i> 093.188.7903
              </a>
              <a href="https://ngocanhblog.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#25f4ee] transition-colors">
                <i className="fa-solid fa-globe text-[#25f4ee]"></i> https://ngocanhblog.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;