import React, { useState } from 'react';
import { Eye, CheckCircle2, ChevronDown, ChevronUp, Award, Sparkles, Trophy, BookOpen } from 'lucide-react';
import { getGamificationStats } from '../lib/deviceTracker';

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
  const stats = getGamificationStats(totalWatchedCount);

  return (
    <div className={`rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-2 border-emerald-500/35 p-4 sm:p-5 shadow-xl transition-all duration-300 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Total Count & Title */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-md">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Your Personal Viewing Total
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Videos & Podcasts Combined
              </span>
            </div>
            <p className="text-sm sm:text-base font-bold text-white mt-1">
              You have viewed a total of{' '}
              <span className="inline-block bg-emerald-500/25 text-emerald-300 px-2.5 py-0.5 rounded-lg border border-emerald-400/40 text-base sm:text-lg font-black">
                {totalWatchedCount}
              </span>{' '}
              {totalWatchedCount === 1 ? 'video/podcast' : 'videos & podcasts'} on this device.
            </p>
          </div>
        </div>

        {/* Right: Gamified Rank & Progress */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Subtle Level / Rank Card */}
          <div className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl ${stats.bgClass} border ${stats.borderClass} shadow-inner`}>
            <div className="text-2xl select-none">{stats.rankIcon}</div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Level {stats.level}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[10px] font-bold text-slate-300 font-serif">
                  {stats.rankHebrew}
                </span>
              </div>
              <span className={`text-xs font-black tracking-tight ${stats.colorClass}`}>
                {stats.rankTitle}
              </span>
            </div>
          </div>

          {/* Milestone Details Button */}
          <button
            type="button"
            onClick={() => setShowMilestones(prev => !prev)}
            className="flex items-center justify-between sm:justify-center gap-2 px-3 py-2 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 transition-all active:scale-95 shadow-sm group"
            title="View learning milestones and badges"
          >
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Milestones</span>
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-amber-400/30">
                {stats.unlockedBadgesCount}/{stats.totalBadgesCount}
              </span>
            </div>
            {showMilestones ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Progress towards Next Rank */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full rounded-full transition-all duration-700 shadow-sm shadow-emerald-500/50"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <span className="font-bold text-[11px] text-slate-400 shrink-0">
            {stats.progressPercent}%
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-[11px]">
          {stats.nextThreshold !== null ? (
            <span className="text-slate-300 font-medium">
              <strong className="text-emerald-400 font-black">{stats.viewsNeededForNext}</strong> more to unlock{' '}
              <strong className="text-indigo-300 font-bold">{stats.nextRankTitle}</strong> ({totalWatchedCount}/{stats.nextThreshold})
            </span>
          ) : (
            <span className="text-amber-300 font-black flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Highest Rank Achieved!
            </span>
          )}

          {currentMediaCounts && (
            <div className="inline-flex items-center gap-1.5 text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Current {currentMediaType} is counted</span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Learning Milestones & Badges Drawer */}
      {showMilestones && (
        <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Learning Achievements & Badges
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {stats.unlockedBadgesCount} of {stats.totalBadgesCount} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
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
                <span className="text-xs font-black text-white leading-tight">
                  {badge.title}
                </span>
                <span className="text-[10px] font-bold text-slate-400 font-serif mt-0.5">
                  {badge.hebrewTitle}
                </span>
                <span className={`text-[10px] mt-1 font-semibold ${badge.unlocked ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {badge.unlocked ? '✓ Unlocked' : `${badge.requiredViews} views needed`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
