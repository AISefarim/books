import React, { useState, useRef } from 'react';
import { Play, Pause, SkipForward, FastForward, Rewind, ExternalLink, Headphones } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
  title: string;
  onNext?: () => void;
}

export function AudioPlayer({ url, title, onNext }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioError, setAudioError] = useState(false);

  // Check if URL is an external platform link rather than a direct playable audio stream
  const isDirectAudio = url.match(/\.(mp3|wav|ogg|m4a|aac|opus)(\?.*)?$/i) || url.includes('firebasestorage') || url.includes('storage.googleapis.com');

  // Detect platform name and styling
  const getPlatformInfo = (targetUrl: string) => {
    const lower = targetUrl.toLowerCase();
    if (lower.includes('spotify.com')) {
      return { name: 'Spotify', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' };
    }
    if (lower.includes('apple.com') || lower.includes('podcasts.apple')) {
      return { name: 'Apple Podcasts', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' };
    }
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return { name: 'YouTube', color: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' };
    }
    if (lower.includes('soundcloud.com')) {
      return { name: 'SoundCloud', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' };
    }
    if (lower.includes('podbean.com')) {
      return { name: 'Podbean', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20' };
    }
    return { name: 'Podcast Link', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20' };
  };

  const platform = getPlatformInfo(url);

  // If not a direct audio file or if the audio element failed to decode, render the direct podcast platform card
  if (!isDirectAudio || audioError) {
    return (
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col gap-4 shadow-2xl w-full border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">Podcast Link</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platform.color}`}>
                  {platform.name}
                </span>
              </div>
              <h3 className="text-white font-bold text-lg md:text-xl truncate max-w-[280px] sm:max-w-md">{title}</h3>
            </div>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2.5 hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-600/30 active:scale-95 group shrink-0"
          >
            <span>Listen on {platform.name}</span>
            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>
      </div>
    );
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
    }
  };

  const toggleSpeed = () => {
    if (audioRef.current) {
      const newRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
      audioRef.current.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl w-full border border-slate-800">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setAudioError(true)}
      />
      
      {/* Visualizer / Title Area */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-1">Now Playing</span>
          <h3 className="text-white font-bold text-lg md:text-xl truncate max-w-[250px] md:max-w-md">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleSpeed} className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-black text-xs hover:bg-indigo-500/40 transition-colors">
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-slate-400 text-xs font-medium">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <button onClick={() => skip(-15)} className="text-slate-400 hover:text-white transition-colors p-2" title="Rewind 15s">
          <Rewind className="w-6 h-6" />
        </button>
        
        <button 
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 hover:scale-105 transition-all shadow-lg active:scale-95"
        >
          {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
        </button>
        
        <button onClick={() => skip(15)} className="text-slate-400 hover:text-white transition-colors p-2" title="Forward 15s">
          <FastForward className="w-6 h-6" />
        </button>

        {onNext && (
          <button onClick={onNext} className="text-slate-400 hover:text-white transition-colors p-2" title="Next Track">
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
        )}
      </div>
    </div>
  );
}
