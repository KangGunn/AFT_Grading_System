import React from 'react';
import type { TraineeRecord, LaneConfig } from '../../types/aft/aft.types';
import { formatSecondsToTime } from '../../data/aftStandards2025';
import { getContrastTextColor } from '../../lib/utils';

interface TwoMileRunStartPointViewProps {
  twoMileRunSync: {
    startTime: number | null;
    status: 'idle' | 'running' | 'finished';
    startedBy?: string;
  };
  twoMileRunElapsedMs: number;
  isFirebaseConnected: boolean;
  laneTrainees: Record<number, TraineeRecord[]>;
  laneConfigs: Record<number, LaneConfig>;
  activeCountByLane: Record<number, number>;
  onStart2MrTimer: () => void;
  onReset2MrTimer: () => void;
  onBackToLanes: () => void;
  onSelectLane2Mr: (laneNum: number) => void;
}

export const TwoMileRunStartPointView: React.FC<TwoMileRunStartPointViewProps> = ({
  twoMileRunSync,
  twoMileRunElapsedMs,
  isFirebaseConnected,
  laneTrainees,
  laneConfigs,
  activeCountByLane,
  onStart2MrTimer,
  onReset2MrTimer,
  onBackToLanes,
  onSelectLane2Mr
}) => {
  const isRunning = twoMileRunSync.status === 'running';

  // Compute 2MR completion statistics per lane
  const laneStats = Array.from({ length: 10 }, (_, i) => {
    const laneNum = i + 1;
    const cfg = laneConfigs[laneNum] || {
      laneNumber: laneNum,
      vestColor: 'Red',
      vestColorCode: '#EF4444'
    };
    const activeCount = activeCountByLane[laneNum] ?? (laneTrainees[laneNum]?.length || 10);
    const trainees = (laneTrainees[laneNum] || []).slice(0, activeCount);
    const finishedCount = trainees.filter((t) => (t.scores['2MR'] || '').trim() !== '').length;
    const isAllDone = activeCount > 0 && finishedCount === activeCount;
    const hasAny = finishedCount > 0;

    return {
      laneNum,
      cfg,
      activeCount,
      finishedCount,
      isAllDone,
      hasAny
    };
  });

  const totalActive = laneStats.reduce((sum, s) => sum + s.activeCount, 0);
  const totalFinished = laneStats.reduce((sum, s) => sum + s.finishedCount, 0);
  const totalPercent = totalActive > 0 ? Math.round((totalFinished / totalActive) * 100) : 0;

  return (
    <div className="flex flex-col h-full w-full bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-gray-100 select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            type="button"
            onClick={onBackToLanes}
            className="flex items-center gap-1 rounded-xl bg-blue-950/70 px-2.5 py-1.5 text-xs font-black text-white hover:bg-blue-800 active:scale-95 transition-all border border-blue-800"
          >
            <span>←</span>
            <span>LANES</span>
          </button>
          <div className="text-center">
            <h1 className="text-base font-black tracking-wider">2MR MASTER CLOCK</h1>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-black bg-blue-950/80 px-2.5 py-1 rounded-xl border border-blue-800">
            <span className={`h-2 w-2 rounded-full ${isFirebaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
            <span className="text-[10px] text-blue-200">{isFirebaseConnected ? 'SYNCED' : 'LOCAL'}</span>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3.5 flex flex-col gap-3.5 min-h-0">
        {/* 1. Dedicated Stopwatch Display Card */}
        <div className="w-full flex flex-col items-center justify-center py-4 px-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white border border-blue-800 shadow-md relative overflow-hidden">
          {/* Glowing Status Indicator */}
          <div className="text-xs font-black text-blue-300 uppercase tracking-widest mb-1 flex items-center gap-2">
            <span>⏱️ 2MR Master Clock</span>
            {isRunning && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>}
          </div>

          <div className="font-mono text-5xl sm:text-6xl font-black text-amber-300 tracking-wider py-1 text-center">
            {formatSecondsToTime(Math.floor(twoMileRunElapsedMs / 1000))}
            <span className="text-xl sm:text-2xl text-blue-200 font-normal">
              .{Math.floor((twoMileRunElapsedMs % 1000) / 10).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* 2. 2MR Lane Progress Section */}
        <section className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-col gap-2.5">
          {/* Section Header with Overall Progress */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wider text-gray-900 dark:text-white">2MR LANE PROGRESS</span>
            </div>
            <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
              totalFinished === totalActive && totalActive > 0
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/50'
                : 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/60 dark:text-amber-300 dark:border-blue-700/60'
            }`}>
              {totalFinished} / {totalActive} ({totalPercent}%)
            </span>
          </div>

          {/* Overall Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${totalPercent}%` }}
            />
          </div>

          {/* 10-Lane Grid (2 columns x 5 rows) - Click to open Lane 2MR Grading */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {laneStats.map(({ laneNum, cfg, activeCount, finishedCount, isAllDone, hasAny }) => {
              const vestTextColor = getContrastTextColor(cfg.vestColorCode, cfg.vestColor);
              return (
                <button
                  key={laneNum}
                  type="button"
                  onClick={() => onSelectLane2Mr(laneNum)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all shadow-sm active:scale-[0.97] hover:border-blue-400 hover:shadow cursor-pointer text-left ${
                    isAllDone
                      ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/30 dark:bg-emerald-950/30 dark:border-emerald-500/40 dark:ring-emerald-500/20'
                      : hasAny
                        ? 'bg-white dark:bg-slate-800/90 border-gray-200 dark:border-slate-700'
                        : 'bg-gray-50/70 border-gray-200/80 dark:bg-slate-900/60 dark:border-slate-800/80'
                  }`}
                  title={`Lane ${laneNum} 2MR 채점 화면으로 이동`}
                >
                  {/* Left: Vest Color Badge + Lane Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="h-6 w-7 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 border border-black/10 shadow-sm"
                      style={{
                        backgroundColor: cfg.vestColorCode,
                        color: vestTextColor
                      }}
                    >
                      L{laneNum}
                    </div>
                    <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                      Lane {laneNum}
                    </span>
                  </div>

                  {/* Right: N / N Progress Pill */}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-black shrink-0 ${
                      isAllDone
                        ? 'bg-emerald-500 text-white dark:bg-emerald-500/25 dark:text-emerald-300 font-black shadow-sm'
                        : hasAny
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/70 dark:text-amber-300 font-bold'
                          : 'bg-gray-200/80 text-gray-600 dark:bg-slate-800 dark:text-gray-400'
                    }`}
                  >
                    {isAllDone && <span className="mr-0.5">✓</span>}
                    {finishedCount} / {activeCount}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Bottom Action Control Bar (Seamless background matching screen) */}
      <footer className="sticky bottom-0 z-40 w-full px-3.5 pb-3.5 pt-1 bg-gray-100 dark:bg-slate-950 shrink-0">
        {isRunning ? (
          <button
            type="button"
            onClick={onReset2MrTimer}
            className="w-full h-16 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-lg tracking-wider shadow-lg flex items-center justify-center gap-2 border border-red-400/40 transition-all"
          >
            <span className="text-xl">🔄</span>
            <span>RESET MASTER CLOCK</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart2MrTimer}
            className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-blue-950 font-black text-xl tracking-wider shadow-xl flex items-center justify-center gap-2 border border-emerald-300 transition-all"
          >
            <span className="text-xl">🚀</span>
            <span>START MASTER CLOCK</span>
          </button>
        )}
      </footer>
    </div>
  );
};
