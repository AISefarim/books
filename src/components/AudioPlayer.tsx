import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward, Rewind, Volume2 } from 'lucide-react';

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
