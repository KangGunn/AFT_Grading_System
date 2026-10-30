import React from 'react';
import type { LaneConfig, TraineeRecord, Platoon } from '../../types/aft/aft.types';
import { LaneCard } from './LaneCard';

interface LaneSelectViewProps {
  laneConfigs: Record<number, LaneConfig>;
  activeCountByLane: Record<number, number>;
  laneTrainees: Record<number, TraineeRecord[]>;
  failedCount?: number;
  onSelectLane: (laneNum: number) => void;
  onOpen2MrStartPoint: () => void;
  onSelectReTestLane?: () => void;
  activePlatoon: Platoon;
  onSelectPlatoon: (platoon: Platoon) => void;
}

export const LaneSelectView: React.FC<LaneSelectViewProps> = ({
  laneConfigs,
  activeCountByLane,
  laneTrainees,
  failedCount = 0,
  onSelectLane,
  onOpen2MrStartPoint,
  onSelectReTestLane,
  activePlatoon,
  onSelectPlatoon
}) => {
  const getLaneRosterRange = (laneNum: number) => {
    const laneList = laneTrainees[laneNum] || [];
    const count = activeCountByLane[laneNum] ?? laneList.length;
    const trainees = laneList.slice(0, count);
    if (trainees.length === 0) return 'No Trainees';
    const firstRN = trainees[0].rosterNumber;
    const lastRN = trainees[trainees.length - 1].rosterNumber;
    return firstRN === lastRN ? `RN #${firstRN}` : `RN #${firstRN} - #${lastRN}`;
  };

  return (
    <main className="w-full flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-2.5 min-h-0">
      {/* Platoon Switcher: Alpha (RN ≤ 100) vs Bravo (RN ≥ 101) */}
      <section className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onSelectPlatoon('alpha')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
            activePlatoon === 'alpha'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>Alpha Platoon</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
            activePlatoon === 'alpha' ? 'bg-blue-800 text-blue-100' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
          }`}>
            RN ≤ 100
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPlatoon('bravo')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
            activePlatoon === 'bravo'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>Bravo Platoon</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
            activePlatoon === 'bravo' ? 'bg-blue-800 text-blue-100' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
          }`}>
            RN ≥ 101
          </span>
        </button>
      </section>

      {/* 10 Vertical Lane Selection Buttons */}
      <section className="space-y-2.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(laneNum => {
          const cfg = laneConfigs[laneNum] || {
            laneNumber: laneNum,
            vestColor: 'Red',
            vestColorCode: '#EF4444'
          };
          const count = activeCountByLane[laneNum] ?? (laneTrainees[laneNum]?.length || 10);
          const rangeStr = getLaneRosterRange(laneNum);

          return (
            <LaneCard
              key={laneNum}
              laneNum={laneNum}
              cfg={cfg}
              count={count}
              rangeStr={rangeStr}
              trainees={laneTrainees[laneNum]}
              onSelectLane={onSelectLane}
            />
          );
        })}

        {/* 2MR Master Clock Stopwatch Card below Lane 10 */}
        <button
          type="button"
          onClick={onOpen2MrStartPoint}
          className="w-full rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-r from-blue-950 via-slate-900 to-emerald-950 p-3.5 shadow-md transition-all active:scale-[0.98] hover:border-emerald-400 hover:shadow-emerald-500/20 flex items-center justify-between text-left group mt-1"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-blue-950 font-black shadow-lg">
              <span className="text-xl">⏱️</span>
            </div>
            <span className="text-base font-black text-white group-hover:text-emerald-300 transition-colors tracking-wide">
              2MR Master Clock
            </span>
          </div>
          <div className="flex items-center text-emerald-400 group-hover:translate-x-0.5 transition-transform">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Re-Test Button below 2MR Master Clock */}
        <button
          type="button"
          onClick={onSelectReTestLane}
          className="w-full rounded-2xl border-2 border-red-500/60 bg-slate-900 p-3.5 shadow-md transition-all active:scale-[0.98] hover:border-red-400 hover:shadow-red-500/20 flex items-center justify-between text-left group mt-1"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white font-black shadow-lg">
              <span className="text-xl">♻️</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white group-hover:text-red-300 transition-colors tracking-wide leading-none">
                Re-Test
              </span>
              <span
                className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-black leading-none translate-y-[1.5px] shadow-xs border ${failedCount > 0
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
              >
                {failedCount} {failedCount === 1 ? 'Failed Trainee' : 'Failed Trainees'}
              </span>
            </div>
          </div>

          <div className="flex items-center text-red-400 group-hover:translate-x-0.5 transition-transform">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </section>
    </main>
  );
};
