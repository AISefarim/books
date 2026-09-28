import React, { useState } from 'react';
import { Eye, ChevronDown, ChevronUp, Award, Sparkles, Trophy, Zap, BookOpen, Download } from 'lucide-react';
import { getGamificationStats, getDeviceWatchStats } from '../lib/deviceTracker';

interface LearningGamificationBannerProps {
  totalWatchedCount: number;
  currentMediaCounts?: boolean;
  currentMediaType?: 'video' | 'podcast';
  onViewLibrary?: () => void;
  className?: string;
}

export function LearningGamificationBanner({
  totalWatchedCount,
  currentMediaCounts = false,
  currentMediaType = 'video',
  onViewLibrary,
  className = ''
}: LearningGamificationBannerProps) {
  const [showMilestones, setShowMilestones] = useState(false);
  const deviceStats = getDeviceWatchStats();
  const stats = getGamificationStats(totalWatchedCount, deviceStats.totalXp);

  return (
    <div className={`rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-2 border-emerald-500/35 p-4 sm:p-6 shadow-xl transition-all duration-300 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Your Score & Activity Breakdown */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-md">
            <Trophy className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                Your Score
              </h3>
              <span className="inline-block bg-emerald-500/30 text-white px-2.5 py-0.5 rounded-lg border border-emerald-400/50 text-base sm:text-lg font-black shadow-sm">
                {stats.totalScore ?? stats.totalXp}
              </span>
              <span className="text-emerald-300 font-black text-base sm:text-lg tracking-tight">
                Torah Points
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 mt-1.5 flex-wrap text-xs sm:text-sm font-bold text-slate-300">
              <span className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded-xl border border-slate-800">
                <span className="text-emerald-400 font-black">{deviceStats.watchedMediaCount}</span>
                <span className="text-slate-300 font-medium">videos/podcasts</span>
              </span>
              <span className="text-slate-600 hidden sm:inline select-none">•</span>
              <span className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded-xl border border-slate-800">
                <span className="text-indigo-400 font-black">{deviceStats.totalBooksRead}</span>
                <span className="text-slate-300 font-medium">Books read</span>
              </span>
              {deviceStats.todayWatchCount >= 2 ? (
                <>
                  <span className="text-slate-600 hidden sm:inline select-none">•</span>
                  <span 
                    className="flex items-center gap-1 bg-amber-500/15 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-500/30 text-xs font-black shadow-sm"
                    title="1.2x multiplier applied to all videos & podcasts watched after the 1st one today"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    <span>1.2x Daily Bonus Active ({deviceStats.todayWatchCount} today)</span>
                  </span>
                </>
              ) : deviceStats.todayWatchCount === 1 ? (
                <>
                  <span className="text-slate-600 hidden sm:inline select-none">•</span>
                  <span 
                    className="flex items-center gap-1 bg-slate-950/60 text-emerald-400 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-bold"
                    title="Next video or podcast today unlocks a 1.2x multiplier!"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Next shiur earns 1.2x bonus today!</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right: Gamified Rank & Hebrew Badge (Prominent & Larger) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Prominent Hebrew Rank Badge */}
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl ${stats.bgClass} border ${stats.borderClass} shadow-md`}>
            <span className="text-3xl select-none shrink-0" role="img" aria-label={stats.rankTitle}>
              {stats.rankIcon}
            </span>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black text-white font-serif tracking-normal leading-tight">
                {stats.rankHebrew}
              </span>
              <span className={`text-[11px] font-bold ${stats.colorClass}`}>
                Level {stats.level} of 22 · {stats.rankTitle}
              </span>
            </div>
          </div>

          {/* Milestone Details Toggle */}
          <button
            type="button"
            onClick={() => setShowMilestones(prev => !prev)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 transition-all active:scale-95 shadow-sm group shrink-0"
            title="View learning milestones"
          >
            <Trophy className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="font-bold">Milestones</span>
            <span className="bg-amber-400/20 text-amber-300 text-[11px] font-black px-1.5 py-0.5 rounded-full border border-amber-400/30">
              {stats.unlockedBadgesCount}/{stats.totalBadgesCount}
            </span>
            {showMilestones ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Simplified, Clean Progress Bar */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5 flex-1 max-w-lg">
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-500 h-full rounded-full transition-all duration-700 shadow-sm shadow-emerald-500/50"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <span className="font-bold text-xs text-slate-400 shrink-0">
            {stats.progressPercent}%
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
          {stats.nextThreshold !== null ? (
            <span className="text-slate-300 font-medium">
              <strong className="text-emerald-400 font-black">{stats.viewsNeededForNext}</strong> more to{' '}
              <strong className="text-white font-serif text-sm font-bold">{stats.nextRankHebrew}</strong>{' '}
              <span className="text-slate-400 text-[11px]">({totalWatchedCount}/{stats.nextThreshold} sessions)</span>
            </span>
          ) : (
            <span className="text-amber-300 font-black flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-serif">כתר שר התורה — 250+ Sessions Mastered!</span>
            </span>
          )}
        </div>
      </div>

      {/* Expandable Milestones Drawer */}
      {showMilestones && (
        <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Milestones &amp; Badges (Goal: 250 Sessions)
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {stats.unlockedBadgesCount} of {stats.totalBadgesCount} Completed
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {stats.badges.map(badge => (
              <div
                key={badge.id}
                className={`p-3 rounded-2xl flex flex-col items-center text-center transition-all ${
                  badge.unlocked
                    ? 'bg-gradient-to-b from-slate-900 to-emerald-950/50 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950/60 border border-slate-800/80 opacity-45'
                }`}
              >
                <div className={`text-2xl mb-1 select-none ${badge.unlocked ? 'transform scale-110 drop-shadow' : 'grayscale'}`}>
                  {badge.icon}
                </div>
                {/* Larger Hebrew Milestone Name */}
                <span className="text-sm sm:text-base font-black text-white font-serif leading-tight">
                  {badge.hebrewTitle}
                </span>
                <span className="text-[11px] font-bold text-slate-300 mt-0.5">
                  {badge.title}
                </span>
                <span className={`text-[10px] mt-1 font-semibold ${badge.unlocked ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {badge.unlocked ? '✓ Unlocked' : `${badge.requiredViews} sessions`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
