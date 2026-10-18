import React from 'react';
import type { TraineeRecord, LaneConfig, EventConfig, EventCode } from '../../types/aft/aft.types';
import { getOfficialPassingStandard, formatSecondsToTime } from '../../data/aftStandards2025';
import { parseTimeString } from '../../utils/aft/timeFormatter';
import { getContrastTextColor } from '../../lib/utils';

interface TraineeCardProps {
  trainee: TraineeRecord;
  currentEvent: EventConfig;
  currentLaneConfig: LaneConfig;
  isMDL: boolean;
  isHRP: boolean;
  isSDC: boolean;
  isPLK: boolean;
  rawValStr: string;
  rawValStr2: string;
  hasInput: boolean;
  isSdcRunning: boolean;
  sdcElapsedMs?: number;
  isPlkSelected: boolean;
  isPlkActive: boolean;
  isPlkDisabled: boolean;
  isGradingLocked?: boolean;
  timerRunning: boolean;
  onScoreChange: (traineeId: string, eventCode: EventCode, val: string) => void;
  onUpdateTrainee: (traineeId: string, updates: Partial<TraineeRecord>) => void;
  onTogglePlkSelect: (traineeId: string) => void;
  onTimerAction: (traineeId: string, eventCode: 'SDC' | 'PLK' | '2MR') => void;
  onOpenHrpClicker?: (trainee: TraineeRecord) => void;
  onEditCustomTrainee?: (trainee: TraineeRecord) => void;
  onRemoveCustomTrainee?: (traineeId: string) => void;
}

export const TraineeCard: React.FC<TraineeCardProps> = ({
  trainee,
  currentEvent,
  currentLaneConfig,
  isMDL,
  isHRP,
  isSDC,
  isPLK,
  rawValStr,
  rawValStr2,
  hasInput,
  isSdcRunning,
  sdcElapsedMs = 0,
  isPlkSelected,
  isPlkActive,
  isPlkDisabled,
  isGradingLocked = false,
  timerRunning,
  onScoreChange,
  onUpdateTrainee,
  onTogglePlkSelect,
  onTimerAction,
  onOpenHrpClicker,
  onEditCustomTrainee,
  onRemoveCustomTrainee
}) => {
  const displayVal = isSdcRunning
    ? formatSecondsToTime(Math.floor(sdcElapsedMs / 1000))
    : rawValStr;
  return (
    <div
      key={trainee.id}
      onClick={() => {
        if (isPLK && !timerRunning) {
          onTogglePlkSelect(trainee.id);
        }
      }}
      className={`h-14 rounded-2xl border px-2.5 shadow-sm transition-all flex items-center justify-between gap-2 ${
        isPLK && !timerRunning ? 'cursor-pointer hover:border-blue-400' : ''
      } ${
        isPlkActive || isSdcRunning
          ? 'border-amber-400 bg-amber-50/20 dark:border-amber-500/80 dark:bg-amber-950/20'
          : isPlkSelected
            ? 'border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/40 ring-2 ring-blue-400/40'
            : isPlkDisabled
              ? 'opacity-40 border-gray-200 bg-gray-100 dark:border-slate-800 dark:bg-slate-900 cursor-not-allowed'
              : hasInput
                ? 'border-blue-300 bg-white dark:border-blue-900/60 dark:bg-slate-900'
                : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      {/* Left: Vest Number + Name (Static) + RN & Age */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Direct Editable Vest Number Badge */}
        {(() => {
          const vestTextColor = getContrastTextColor(currentLaneConfig.vestColorCode, currentLaneConfig.vestColor);
          return (
            <div 
              className="flex h-8 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/10 dark:ring-white/20 border border-black/10"
              style={{ 
                backgroundColor: currentLaneConfig.vestColorCode,
                color: vestTextColor
              }}
              title="Edit Vest Number"
              onClick={(e) => isPLK && !timerRunning && e.stopPropagation()}
            >
              <input
                type="text"
                value={trainee.vestNumber}
                onChange={(e) => onUpdateTrainee(trainee.id, { vestNumber: e.target.value })}
                onClick={(e) => isPLK && !timerRunning && e.stopPropagation()}
                className="w-full bg-transparent text-center text-xs font-black outline-none"
                style={{ color: vestTextColor }}
                placeholder="#"
              />
            </div>
          );
        })()}

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          {/* Top Row: RN & Age */}
          <div className="flex items-center justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {trainee.rosterNumber && (
                <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 shrink-0">
                  #{trainee.rosterNumber}
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 shrink-0">
                Age: {trainee.age}
              </span>
            </div>
            {trainee.id.startsWith('custom-retest-') && (
              <div className="flex items-center gap-1 shrink-0">
                {onEditCustomTrainee && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCustomTrainee(trainee);
                    }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-1 rounded leading-none transition-colors"
                    title="Edit soldier details"
                  >
                    ✏️
                  </button>
                )}
                {onRemoveCustomTrainee && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete external soldier ${trainee.name} (#${trainee.rosterNumber})?`)) {
                        onRemoveCustomTrainee(trainee.id);
                      }
                    }}
                    className="text-[10px] font-black text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-1 rounded leading-none transition-colors"
                    title="Remove soldier"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Bottom Row: Name (Given full width without wrapping/truncation constraint from other items) */}
          <div className="truncate text-xs font-black text-gray-900 dark:text-white leading-tight mt-0.5" title={trainee.name}>
            {trainee.name}
          </div>
        </div>
      </div>

      {/* Right: Score Input Area - Fixed Width (w-48: 192px) for 100% Consistent Alignment Across All Events */}
      <div 
        className="flex items-center justify-end gap-1.5 shrink-0 w-48"
        onClick={(e) => isPLK && !timerRunning && e.stopPropagation()}
      >
        {isMDL ? (
          <div className="flex items-center gap-1 w-full justify-end">
            {/* Attempt 1 */}
            <div className="relative w-23">
              <input
                type="number"
                step={currentEvent.step}
                placeholder={`1st (${getOfficialPassingStandard('MDL', trainee.ageGroup)})`}
                value={rawValStr}
                onChange={(e) => onScoreChange(trainee.id, 'MDL', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                  }
                }}
                className="w-full h-8 rounded-xl border border-gray-300 bg-gray-50 px-1.5 text-xs font-black text-center text-gray-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                title="1st Attempt (lbs)"
              />
            </div>

            {/* Attempt 2 (Optional) */}
            <div className="relative w-23">
              <input
                type="number"
                step={currentEvent.step}
                placeholder="2nd (opt)"
                value={rawValStr2}
                onChange={(e) => onScoreChange(trainee.id, 'MDL2', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                  }
                }}
                className="w-full h-8 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 px-1.5 text-xs font-black text-center text-gray-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                title="2nd Attempt (Optional lbs)"
              />
            </div>
          </div>
        ) : isHRP ? (
          /* HRP: Reps Input (w-24) + Clicker Button (w-20) = 192px matching right boundary */
          <div className="flex items-center justify-end gap-1.5 w-full">
            <div className="relative w-24">
              <input
                type="number"
                step={currentEvent.step}
                placeholder={getOfficialPassingStandard(currentEvent.code, trainee.ageGroup)}
                value={rawValStr}
                onChange={(e) => onScoreChange(trainee.id, currentEvent.code, e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                  }
                }}
                className="w-full h-8 rounded-xl border border-gray-300 bg-gray-50 px-2 text-xs font-black text-center text-gray-900 outline-none focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenHrpClicker) onOpenHrpClicker(trainee);
              }}
              className="h-8 w-20 shrink-0 flex items-center justify-center gap-1 rounded-xl text-[11px] font-black transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-500/80"
              title="Open Fullscreen Grader"
            >
              <span>⏱️</span>
              <span>GRADE</span>
            </button>
          </div>
        ) : (
          /* SDC, PLK, 2MR: Input (w-24) + Action Button (w-20 fixed) = 192px matching right boundary */
          <div className="flex items-center justify-end gap-1.5 w-full">
            <div className="relative w-24">
              <input
                type="text"
                placeholder={getOfficialPassingStandard(currentEvent.code, trainee.ageGroup)}
                value={isSDC && isSdcRunning ? displayVal : rawValStr}
                onChange={(e) => onScoreChange(trainee.id, currentEvent.code, e.target.value)}
                onBlur={(e) => {
                  if (isSDC && isSdcRunning) return;
                  if (currentEvent.isTime) {
                    const trimmed = e.target.value.trim();
                    if (!trimmed) {
                      onScoreChange(trainee.id, currentEvent.code, '');
                    } else {
                      const formatted = parseTimeString(trimmed);
                      onScoreChange(trainee.id, currentEvent.code, formatted);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && currentEvent.isTime && !(isSDC && isSdcRunning)) {
                    const trimmed = rawValStr.trim();
                    if (!trimmed) {
                      onScoreChange(trainee.id, currentEvent.code, '');
                    } else {
                      const formatted = parseTimeString(trimmed);
                      onScoreChange(trainee.id, currentEvent.code, formatted);
                    }
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={isPlkDisabled || (isSDC && isSdcRunning) || isGradingLocked}
                className={`w-full h-8 rounded-xl border px-2 text-xs font-black text-center outline-none transition-all placeholder:text-gray-400 placeholder:font-bold ${
                  isGradingLocked
                    ? 'border-gray-300 bg-gray-100 text-gray-800 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200'
                    : isSDC && isSdcRunning
                      ? 'border-amber-400 bg-amber-50/50 text-gray-900 dark:border-amber-500/80 dark:bg-amber-950/30 dark:text-white ring-1 ring-amber-400/50'
                      : isPlkDisabled
                        ? 'border-gray-300 bg-gray-50 text-gray-900 opacity-50 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                        : 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                }`}
              />
            </div>

            {/* Action Area for Time Events (SDC, PLK, 2MR) - Fixed Width w-20 */}
            {isPLK && !timerRunning ? (
              /* PLK Before Start: Intuitive Interactive Selection Checkbox */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePlkSelect(trainee.id);
                }}
                className={`h-8 w-20 shrink-0 flex items-center justify-center gap-1 rounded-xl text-[11px] font-black transition-all active:scale-95 border ${
                  isPlkSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-gray-50 border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400'
                }`}
                title={isPlkSelected ? 'Selected for Plank' : 'Click to select for Plank'}
              >
                <span>{isPlkSelected ? '☑' : '☐'}</span>
                <span>{isPlkSelected ? 'READY' : 'SELECT'}</span>
              </button>
            ) : (
              /* SDC / 2MR / PLK Running: Action Button */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isGradingLocked) return;
                  onTimerAction(trainee.id, currentEvent.code as 'SDC' | 'PLK' | '2MR');
                }}
                disabled={isPlkDisabled || isGradingLocked}
                className={`h-8 w-20 shrink-0 flex items-center justify-center gap-1 rounded-xl text-[11px] font-black tracking-wider transition-colors active:scale-95 shadow ${
                  isGradingLocked
                    ? 'bg-gray-200 text-gray-400 dark:bg-slate-800 dark:text-gray-500 cursor-not-allowed border border-gray-300 dark:border-slate-700'
                    : isSDC
                      ? isSdcRunning
                        ? 'bg-amber-500 text-blue-950 animate-pulse ring-1 ring-amber-600'
                        : 'bg-blue-800 text-white hover:bg-blue-700'
                      : isPLK
                        ? isPlkActive
                          ? 'bg-amber-500 text-blue-950 animate-pulse ring-1 ring-amber-600 cursor-pointer'
                          : isPlkDisabled
                            ? 'bg-gray-200 text-gray-400 dark:bg-slate-800 cursor-not-allowed'
                            : 'bg-blue-800 text-white hover:bg-blue-700'
                        : 'bg-blue-800 text-white hover:bg-blue-700'
                }`}
                title={
                  isGradingLocked
                    ? 'Grading is controlled by another lane'
                    : isSDC
                      ? (isSdcRunning ? 'Stop & Record Time' : 'Start SDC Timer')
                      : isPLK
                        ? (isPlkActive ? 'Stop & Record PLK' : 'Plank idle')
                        : 'Tag runner finish time'
                }
              >
                <span>{isGradingLocked ? '🔒' : '⏱️'}</span>
                {isSDC && <span>{isSdcRunning ? 'STOP' : 'START'}</span>}
                {isPLK && <span>{isPlkActive ? 'STOP' : 'IDLE'}</span>}
                {currentEvent.code === '2MR' && <span>{isGradingLocked ? 'LOCKED' : 'TAG'}</span>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
