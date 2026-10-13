import React from 'react';
import type { TraineeRecord, LaneConfig } from '../../types/aft/aft.types';
import { getContrastTextColor } from '../../lib/utils';
import { parseTimeString } from '../../utils/aft/timeFormatter';

interface DualLaneTraineeCardProps {
  trainee: TraineeRecord;
  laneConfig: LaneConfig;
  targetLane: number;
  timeVal: string;
  onTimeChange: (val: string) => void;
  onTagAction: () => void;
  onUpdateVestNumber?: (vestNum: string) => void;
}

export const DualLaneTraineeCard: React.FC<DualLaneTraineeCardProps> = ({
  trainee,
  laneConfig,
  timeVal,
  onTimeChange,
  onTagAction,
  onUpdateVestNumber
}) => {
  const vestTextColor = getContrastTextColor(laneConfig.vestColorCode, laneConfig.vestColor);
  const hasScore = (timeVal || '').trim() !== '';

  return (
    <div
      className={`h-14 rounded-2xl border px-2 shadow-sm transition-all flex items-center justify-between gap-1 overflow-hidden shrink-0 ${hasScore
        ? 'border-blue-400/80 bg-blue-50/40 dark:border-blue-500/60 dark:bg-blue-950/20'
        : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        }`}
    >
      {/* Left: Vest Badge on Top + Roster Number Underneath */}
      <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 w-8">
        {/* Vest Color & Number Badge (Enlarged) */}
        <div
          className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm border border-black/10 ring-1 ring-black/5"
          style={{
            backgroundColor: laneConfig.vestColorCode,
            color: vestTextColor
          }}
          title="Vest Number"
        >
          <input
            type="text"
            value={trainee.vestNumber}
            onChange={(e) => onUpdateVestNumber?.(e.target.value)}
            className="w-full bg-transparent text-center text-xs font-black outline-none tracking-tight p-0 leading-none"
            style={{ color: vestTextColor }}
            placeholder="#"
          />
        </div>

        {/* Roster Number Underneath Vest Badge */}
        <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 tracking-tight leading-none">
          #{trainee.rosterNumber}
        </span>
      </div>

      {/* Middle: Time Input */}
      <input
        type="text"
        placeholder="--:--"
        value={timeVal}
        onChange={(e) => onTimeChange(e.target.value)}
        onBlur={(e) => {
          const trimmed = e.target.value.trim();
          if (!trimmed) {
            onTimeChange('');
          } else {
            const formatted = parseTimeString(trimmed);
            onTimeChange(formatted);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const trimmed = (e.target as HTMLInputElement).value.trim();
            if (!trimmed) {
              onTimeChange('');
            } else {
              const formatted = parseTimeString(trimmed);
              onTimeChange(formatted);
            }
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`w-14 shrink-0 h-8 rounded-xl border px-1 text-xs font-black text-center outline-none transition-all placeholder:text-gray-400 placeholder:font-bold ${hasScore
          ? 'border-blue-500 bg-white text-blue-900 dark:border-blue-400 dark:bg-slate-800 dark:text-white'
          : 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white'
          }`}
        title="2MR Finish Time (mm:ss)"
      />

      {/* Right: TAG Button (Enlarged) */}
      <button
        type="button"
        onClick={onTagAction}
        className="h-8 px-2.5 shrink-0 rounded-xl bg-blue-800 hover:bg-blue-700 text-white text-[11px] font-black active:scale-95 shadow transition-all flex items-center justify-center gap-1 border border-blue-600/40"
        title="Tag runner finish time"
      >
        <span>⏱️</span>
        <span>TAG</span>
      </button>
    </div>
  );
};
