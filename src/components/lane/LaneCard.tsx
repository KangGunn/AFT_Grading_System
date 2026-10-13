import React from 'react';
import type { LaneConfig, TraineeRecord } from '../../types/aft/aft.types';

interface LaneCardProps {
  laneNum: number;
  cfg: LaneConfig;
  count: number;
  rangeStr: string;
  trainees?: TraineeRecord[];
  onSelectLane: (laneNum: number) => void;
}

const EVENTS_IN_ORDER = [
  { code: 'MDL', label: 'MDL' },
  { code: 'HRP', label: 'HRP' },
  { code: 'SDC', label: 'SDC' },
  { code: 'PLK', label: 'PLK' },
  { code: '2MR', label: '2MR' }
] as const;

export const LaneCard: React.FC<LaneCardProps> = ({
  laneNum,
  cfg,
  count,
  rangeStr,
  trainees = [],
  onSelectLane
}) => {
  // Determine current active event stage
  const activeTrainees = trainees.slice(0, count);

  const getLaneStage = (): { label: string; isComplete?: boolean } => {
    if (activeTrainees.length === 0) return { label: 'MDL' };

    for (const ev of EVENTS_IN_ORDER) {
      const isEventComplete = activeTrainees.every((t) => {
        if (ev.code === 'MDL') {
          return (t.scores.MDL || '').trim() !== '' || (t.scores.MDL2 || '').trim() !== '';
        }
        return (t.scores[ev.code] || '').trim() !== '';
      });

      if (!isEventComplete) {
        return { label: ev.label };
      }
    }

    return { label: 'Completed', isComplete: true };
  };

  const stage = getLaneStage();

  return (
    <button
      key={laneNum}
      type="button"
      onClick={() => onSelectLane(laneNum)}
      className="relative w-full overflow-hidden rounded-2xl border-2 border-gray-300 bg-gray-200 p-3.5 pl-8 shadow-sm transition-all active:scale-[0.98] hover:bg-gray-300/80 hover:border-gray-400 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-750 flex items-center justify-between text-left group"
    >
      {/* 1. Thick Left Indicator Bar (w-5) - Clean without border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-5 transition-all shadow-xs"
        style={{ backgroundColor: cfg.vestColorCode }}
      />

      {/* Lane Details */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-gray-900 dark:text-white">
              Lane {laneNum}
            </span>
            <span className="rounded-md bg-white dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-gray-700 dark:text-gray-200 shadow-xs border border-gray-300 dark:border-neutral-700">
              {count} Trainees
            </span>
          </div>
          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-0.5 flex items-center gap-1.5">
            <span className="text-gray-800 dark:text-gray-200 font-extrabold">{rangeStr}</span>
          </div>
        </div>
      </div>

      {/* Right Side: Clean Prominent Stage Text & Arrow */}
      <div className="flex items-center gap-2">
        <span
          className={`text-base font-black tracking-wide ${
            stage.isComplete
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          {stage.label}
        </span>

        {/* Action Arrow */}
        <div className="flex items-center text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};
