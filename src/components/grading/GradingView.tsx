import React, { useState, useRef, useEffect } from 'react';
import type { TraineeRecord, LaneConfig, EventCode } from '../../types/aft/aft.types';
import { EVENT_CONFIGS } from '../../utils/aft/constants';
import { calculateOfficialAftScore, formatSecondsToTime } from '../../data/aftStandards2025';
import { parseTimeToSeconds } from '../../utils/aft/timeFormatter';
import { getContrastTextColor } from '../../lib/utils';
import { TraineeCard } from './TraineeCard';
import { DualLaneModal } from '../modals/DualLaneModal';
import { HrpClickerModal } from '../modals/HrpClickerModal';
import { DualLaneTraineeCard } from './DualLaneTraineeCard';
import { RETEST_LANE_NUM } from '../../utils/aft/retestHelpers';

interface GradingViewProps {
  selectedLane: number;
  currentLaneConfig: LaneConfig;
  currentTrainees: TraineeRecord[];
  isFirebaseConnected: boolean;
  twoMileRunSync: {
    startTime: number | null;
    status: 'idle' | 'running' | 'finished';
    startedBy?: string;
  };
  twoMileRunElapsedMs: number;
  plkElapsedMs: number;
  plkTimerRunning: boolean;
  sdcStartTimes: Record<string, number>;
  sdcElapsedMs?: Record<string, number>;
  selectedPlkIds: string[];
  plkRunningIds: string[];
  onBackToLanes: () => void;
  onOpenStandards: () => void;
  onScoreChange: (traineeId: string, eventCode: EventCode, val: string, targetLane?: number) => void;
  onUpdateTrainee: (traineeId: string, updates: Partial<TraineeRecord>, targetLane?: number) => void;
  onStart2MrTimer?: () => void;
  onReset2MrTimer?: () => void;
  onStartBatchPlk: () => void;
  onCancelPlkBatch: () => void;
  onTogglePlkSelect: (traineeId: string) => void;
  onTimerAction: (traineeId: string, eventCode: 'SDC' | 'PLK' | '2MR', targetLane?: number) => void;
  onOpenAllResults?: () => void;
  backButtonLabel?: string;
  // 2MR Dual Lane Grading Props
  secondaryLane?: number | null;
  secondaryLaneConfig?: LaneConfig;
  secondaryTrainees?: TraineeRecord[];
  allLaneConfigs?: Record<number, LaneConfig>;
  activeCountByLane?: Record<number, number>;
  dualLanes?: Record<number, { primaryLane: number; active: boolean }>;
  onSelectSecondaryLane?: (laneNum: number | null) => void;
}

export const GradingView: React.FC<GradingViewProps> = ({
  selectedLane,
  currentLaneConfig,
  currentTrainees,
  isFirebaseConnected,
  twoMileRunSync,
  twoMileRunElapsedMs,
  plkElapsedMs,
  plkTimerRunning,
  sdcStartTimes,
  sdcElapsedMs = {},
  selectedPlkIds,
  plkRunningIds,
  onBackToLanes,
  onOpenStandards,
  onScoreChange,
  onUpdateTrainee,
  onStart2MrTimer,
  onReset2MrTimer,
  onStartBatchPlk,
  onCancelPlkBatch,
  onTogglePlkSelect,
  onTimerAction,
  onOpenAllResults,
  backButtonLabel,
  secondaryLane,
  secondaryLaneConfig,
  secondaryTrainees,
  allLaneConfigs,
  activeCountByLane,
  dualLanes,
  onSelectSecondaryLane
}) => {
  const [isDualLaneModalOpen, setIsDualLaneModalOpen] = useState<boolean>(false);
  const [activeHrpTrainee, setActiveHrpTrainee] = useState<TraineeRecord | null>(null);

  const [currentEventIndex, setCurrentEventIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(`aft_event_idx_lane_${selectedLane}`);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 0 && parsed <= EVENT_CONFIGS.length) return parsed;
      }
    }
    return 0;
  });

  const handleSetEventIndex = (idx: number) => {
    setCurrentEventIndex(idx);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`aft_event_idx_lane_${selectedLane}`, String(idx));
    }
  };

  const isSummaryView = currentEventIndex === EVENT_CONFIGS.length;
  const currentEvent = !isSummaryView ? EVENT_CONFIGS[currentEventIndex] : null;

  const completedCount = currentEvent
    ? currentTrainees.filter((t) => {
      if (currentEvent.code === 'MDL') {
        return (t.scores.MDL || '').trim() !== '' || (t.scores.MDL2 || '').trim() !== '';
      }
      return (t.scores[currentEvent.code] || '').trim() !== '';
    }).length
    : 0;

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            onClick={onBackToLanes}
            className="flex items-center gap-1 rounded-lg bg-blue-800 px-2.5 py-1.5 text-xs font-black text-white active:scale-95 hover:bg-blue-700 uppercase"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            {backButtonLabel || 'LANES'}
          </button>
          <div className="text-center">
            <h1 className="text-base font-black tracking-wider">AFT GRADER</h1>
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">
              {selectedLane === 99 ? 'RE-TEST' : `LANE ${selectedLane} · EVALUATION`}
            </span>
          </div>
          {/* Standards Reference & Verification Button */}
          <button
            type="button"
            onClick={onOpenStandards}
            className="rounded-lg bg-blue-950 px-2 py-1 text-[10px] font-black text-amber-300 border border-blue-700 active:scale-95 hover:bg-blue-800"
            title="View 2025 Official Score Standards"
          >
            📜 STANDARDS
          </button>
        </div>
      </header>

        {/* Main Content Area - Scrollable with Mobile Touch Support */}
        <main className="w-full flex-1 overflow-y-auto overscroll-contain px-3 py-3 flex flex-col gap-3 min-h-0">

        {/* EVENT GRADING MODE (Step by Step) */}
        {!isSummaryView && currentEvent && (
          <>
            {/* Event Header Banner with integrated Stopwatch & Event-specific Controls (PLK, 2MR) */}
            <section className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 p-3 text-white shadow-md flex flex-col gap-2">
              {/* Top Row: Event Badges + PLK Selection / 2MR Sync Status + Start/Reset Controls + Stopwatch */}
              <div className="flex items-center justify-between gap-2">
                {/* Left: Badges */}
                <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
                  <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-black text-blue-950 shrink-0">
                    EVENT {currentEventIndex + 1}/5
                  </span>
                  {completedCount === currentTrainees.length && currentTrainees.length > 0 ? (
                    <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-blue-950 shrink-0 flex items-center gap-1 shadow-sm ring-1 ring-emerald-300">
                      <span>✓</span>
                      <span>ALL GRADED ({completedCount}/{currentTrainees.length})</span>
                    </span>
                  ) : (
                    <span className="rounded-md bg-blue-800/80 px-2 py-0.5 text-[10px] font-black text-amber-300 shrink-0">
                      {completedCount}/{currentTrainees.length} GRADED
                    </span>
                  )}
                </div>

                {/* Right: Master Start/Reset Controls (PLK, 2MR) + Pure Stopwatch Live Display */}
                <div className="flex items-center gap-2 shrink-0 h-8">
                  {/* PLK Batch Start/Reset Button directly in Top Banner */}
                  {currentEvent.code === 'PLK' && (
                    plkTimerRunning ? (
                      <button
                        type="button"
                        onClick={onCancelPlkBatch}
                        className="h-8 rounded-xl bg-red-600 hover:bg-red-500 text-white px-2.5 text-[11px] font-black shadow transition-all active:scale-95 flex items-center justify-center gap-1 border border-red-400/40"
                        title="Reset / Re-select trainees"
                      >
                        <span>🔄</span>
                        <span>RESET</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onStartBatchPlk}
                        disabled={selectedPlkIds.length === 0}
                        className={`h-8 rounded-xl px-2.5 text-[11px] font-black shadow transition-all active:scale-95 flex items-center justify-center gap-1 ${selectedPlkIds.length > 0
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-blue-950 font-bold'
                            : 'bg-blue-950 text-blue-400 opacity-50 cursor-not-allowed border border-blue-800'
                          }`}
                        title="Start PLK for selected trainees"
                      >
                        <span>🚀</span>
                        <span>START</span>
                      </button>
                    )
                  )}

                  {/* Stopwatch Live Display with 2MR Dynamic Border (Only Border Pulses, Numbers Stay Solid) */}
                  {currentEvent.isTime && (
                    <div className="relative flex items-center justify-center h-8 rounded-xl">
                      {/* Dynamic Pulsing Border Overlay */}
                      {currentEvent.code === '2MR' && twoMileRunSync.status === 'running' && (
                        <div
                          className={`absolute -inset-[1px] rounded-xl pointer-events-none transition-all ${!isFirebaseConnected
                              ? 'border-2 border-red-500 ring-2 ring-red-500/50'
                              : 'border-2 border-emerald-400 ring-2 ring-emerald-400/60 animate-pulse shadow-emerald-500/20'
                            }`}
                        />
                      )}

                      {/* Pure Solid Stopwatch Display */}
                      <div className="flex items-center justify-center bg-blue-950/90 px-2.5 h-8 rounded-xl border border-blue-800/90 shadow-inner z-10">
                        <div className="font-mono text-base font-black text-amber-300 tracking-wider select-none">
                          {(() => {
                            const activeSdcMs = Object.values(sdcElapsedMs)[0] || 0;
                            const activeElapsedMs = currentEvent.code === '2MR'
                              ? twoMileRunElapsedMs
                              : currentEvent.code === 'PLK'
                                ? plkElapsedMs
                                : currentEvent.code === 'SDC'
                                  ? activeSdcMs
                                  : 0;
                            return (
                              <>
                                {formatSecondsToTime(Math.floor(activeElapsedMs / 1000))}
                                <span className="text-[10px] text-blue-200 font-normal">.{Math.floor((activeElapsedMs % 1000) / 10).toString().padStart(2, '0')}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Row: Event Title (inline with unit) + Dual Lane Toggle Button (2MR only) */}
              <div className="flex items-center justify-between gap-2 min-h-[28px]">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <h2 className="text-xs sm:text-sm font-black text-white truncate">
                    {currentEvent.name} ({currentEvent.code})
                  </h2>
                  <span className="text-[10px] text-blue-300 font-semibold shrink-0">
                    · {currentEvent.unit}
                  </span>
                </div>

                {/* 2MR Dual-Lane Selection Button */}
                {currentEvent.code === '2MR' && onSelectSecondaryLane && selectedLane !== RETEST_LANE_NUM && (() => {
                  const isBeingGradedByOtherLane = dualLanes?.[selectedLane]?.active;
                  const otherPrimaryLane = dualLanes?.[selectedLane]?.primaryLane;

                  if (isBeingGradedByOtherLane) {
                    return (
                      <div
                        className="h-7 px-2.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/60 flex items-center gap-1.5 shadow-sm shrink-0 cursor-not-allowed select-none"
                        title={`Lane ${selectedLane} is currently being graded simultaneously by Lane ${otherPrimaryLane}`}
                      >
                        <span className="text-[11px]">🔒</span>
                        <span>BY LANE {otherPrimaryLane}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={() => setIsDualLaneModalOpen(true)}
                      className={`h-7 px-3 rounded-lg text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-sm border shrink-0 ${
                        secondaryLane && secondaryLaneConfig
                          ? 'bg-blue-950 text-white border-amber-400 ring-1 ring-amber-400/30'
                          : 'bg-blue-800/80 hover:bg-blue-700 text-white border-blue-600/50'
                      }`}
                      title="Simultaneous 2MR grading with another lane"
                    >
                      {secondaryLane && secondaryLaneConfig ? (
                        <>
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/50"
                            style={{ backgroundColor: secondaryLaneConfig.vestColorCode }}
                          />
                          <span className="truncate">DUAL: LANE {secondaryLane}</span>
                          <span className="text-[9px] text-amber-300">▼</span>
                        </>
                      ) : (
                        <span>+ DUAL LANE</span>
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30 mt-0.5">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${completedCount === currentTrainees.length && currentTrainees.length > 0
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                    }`}
                  style={{ width: `${(completedCount / Math.max(1, currentTrainees.length)) * 100}%` }}
                />
              </div>
            </section>

            {/* Trainee Scoring List */}
            {currentEvent.code === '2MR' && selectedLane !== RETEST_LANE_NUM && secondaryLane && secondaryLaneConfig ? (
              /* Split Dual Lane View: Left = Primary Lane, Right = Secondary Lane */
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {/* Left Column: Primary Lane (기존에 채점하던 레인) */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div
                    className="flex items-center justify-between px-2 py-1 rounded-xl border border-black/10 shadow-sm"
                    style={{
                      backgroundColor: currentLaneConfig.vestColorCode,
                      color: getContrastTextColor(currentLaneConfig.vestColorCode, currentLaneConfig.vestColor)
                    }}
                  >
                    <span className="text-xs font-black tracking-wider truncate">
                      {selectedLane === 99 ? 'RE-TEST' : `LANE ${selectedLane}`}
                    </span>
                    <span className="text-[10px] font-bold opacity-85 shrink-0">
                      {currentTrainees.length} soldiers
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {currentTrainees.map((trainee) => (
                      <DualLaneTraineeCard
                        key={trainee.id}
                        trainee={trainee}
                        laneConfig={currentLaneConfig}
                        targetLane={selectedLane}
                        timeVal={trainee.scores['2MR'] || ''}
                        onTimeChange={(val) => onScoreChange(trainee.id, '2MR', val, selectedLane)}
                        onTagAction={() => onTimerAction(trainee.id, '2MR', selectedLane)}
                        onUpdateVestNumber={(v) => onUpdateTrainee(trainee.id, { vestNumber: v }, selectedLane)}
                      />
                    ))}
                  </div>
                </div>

                {/* Right Column: Secondary Lane (새로 추가한 레인) */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div
                    className="flex items-center justify-between px-2 py-1 rounded-xl border border-black/10 shadow-sm"
                    style={{
                      backgroundColor: secondaryLaneConfig.vestColorCode,
                      color: getContrastTextColor(secondaryLaneConfig.vestColorCode, secondaryLaneConfig.vestColor)
                    }}
                  >
                    <span className="text-xs font-black tracking-wider truncate">
                      LANE {secondaryLane}
                    </span>
                    <span className="text-[10px] font-bold opacity-85 shrink-0">
                      {(secondaryTrainees || []).length} soldiers
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {(secondaryTrainees || []).map((trainee) => (
                      <DualLaneTraineeCard
                        key={trainee.id}
                        trainee={trainee}
                        laneConfig={secondaryLaneConfig}
                        targetLane={secondaryLane}
                        timeVal={trainee.scores['2MR'] || ''}
                        onTimeChange={(val) => onScoreChange(trainee.id, '2MR', val, secondaryLane)}
                        onTagAction={() => onTimerAction(trainee.id, '2MR', secondaryLane)}
                        onUpdateVestNumber={(v) => onUpdateTrainee(trainee.id, { vestNumber: v }, secondaryLane)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Regular Full-Width Trainee List */
              <section className="space-y-2.5">
                {currentTrainees.map((trainee) => {
                  const isMDL = currentEvent.code === 'MDL';
                  const isHRP = currentEvent.code === 'HRP';
                  const isSDC = currentEvent.code === 'SDC';
                  const isPLK = currentEvent.code === 'PLK';
                  const rawValStr = trainee.scores[currentEvent.code] || '';
                  const rawValStr2 = trainee.scores.MDL2 || '';
                  const hasInput = rawValStr.trim() !== '' || (isMDL && rawValStr2.trim() !== '');
                  const isSdcRunning = isSDC && !!sdcStartTimes[trainee.id];
                  const isPlkSelected = isPLK && selectedPlkIds.includes(trainee.id);
                  const isPlkActive = isPLK && plkRunningIds.includes(trainee.id);
                  const isPlkDisabled = isPLK && plkTimerRunning && !isPlkActive;
                  const isGradingLocked = currentEvent.code === '2MR' && selectedLane !== RETEST_LANE_NUM && !!dualLanes?.[selectedLane]?.active;

                  return (
                    <TraineeCard
                      key={trainee.id}
                      trainee={trainee}
                      currentEvent={currentEvent}
                      currentLaneConfig={currentLaneConfig}
                      isMDL={isMDL}
                      isHRP={isHRP}
                      isSDC={isSDC}
                      isPLK={isPLK}
                      rawValStr={rawValStr}
                      rawValStr2={rawValStr2}
                      hasInput={hasInput}
                      isSdcRunning={isSdcRunning}
                      sdcElapsedMs={sdcElapsedMs[trainee.id] || 0}
                      isPlkSelected={isPlkSelected}
                      isPlkActive={isPlkActive}
                      isPlkDisabled={isPlkDisabled}
                      isGradingLocked={isGradingLocked}
                      timerRunning={plkTimerRunning}
                      onScoreChange={onScoreChange}
                      onUpdateTrainee={onUpdateTrainee}
                      onTogglePlkSelect={onTogglePlkSelect}
                      onTimerAction={onTimerAction}
                      onOpenHrpClicker={setActiveHrpTrainee}
                    />
                  );
                })}
              </section>
            )}
          </>
        )}

        {/* SUMMARY / RESULT TAB (Full Lane Scorecard) */}
        {isSummaryView && (
          <div className="space-y-3">
            {(() => {
              const bannerTextColor = getContrastTextColor(currentLaneConfig.vestColorCode, currentLaneConfig.vestColor);
              const isDarkText = bannerTextColor === '#0F172A';
              return (
                <section
                  className="rounded-2xl p-4 shadow-md transition-all border border-black/10"
                  style={{
                    backgroundColor: currentLaneConfig.vestColorCode,
                    color: bannerTextColor
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black" style={{ color: bannerTextColor }}>
                        {selectedLane === 99 ? 'RE-TEST SCORECARD' : `LANE ${selectedLane} SCORECARD`}
                      </h2>
                      <p
                        className={`text-xs font-bold ${isDarkText ? 'text-black/75' : 'text-white/85'}`}
                      >
                        {selectedLane === 99
                          ? 'All Failed Soldiers · 5-Event Results'
                          : `Vest: ${currentLaneConfig.vestColor} · 5-Event Results`}
                      </p>
                    </div>

                    {/* Total Results Button */}
                    {onOpenAllResults && (
                      <button
                        type="button"
                        onClick={onOpenAllResults}
                        className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black shadow-sm transition-all active:scale-95 border ${isDarkText
                            ? 'bg-black/10 hover:bg-black/20 text-black border-black/20'
                            : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                          }`}
                        title="View Total Results Scorecard"
                      >
                        <span>📊</span>
                        <span>Total Results</span>
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Trainee Summary Cards */}
            <div className="space-y-2.5">
              {currentTrainees.map(trainee => {
                let total = 0;
                let eventPassCount = 0;
                const eventResults = EVENT_CONFIGS.map(ev => {
                  let rawValStr = trainee.scores[ev.code] || '';
                  let displayRaw = rawValStr;

                  let hasAttempt = rawValStr.trim() !== '';

                  if (ev.code === 'MDL') {
                    const att1Str = (trainee.scores.MDL || '').trim();
                    const att2Str = (trainee.scores.MDL2 || '').trim();
                    hasAttempt = att1Str !== '' || att2Str !== '';
                    const att1 = att1Str !== '' ? parseFloat(att1Str) || 0 : -1;
                    const att2 = att2Str !== '' ? parseFloat(att2Str) || 0 : -1;
                    const bestVal = Math.max(att1 >= 0 ? att1 : 0, att2 >= 0 ? att2 : 0);

                    if (att1Str !== '' && att2Str !== '') {
                      displayRaw = `${att1Str} / ${att2Str}`;
                    } else if (att1Str !== '') {
                      displayRaw = `${att1Str} / -`;
                    } else if (att2Str !== '') {
                      displayRaw = `- / ${att2Str}`;
                    } else {
                      displayRaw = '';
                    }
                    rawValStr = hasAttempt ? `${bestVal}` : '';
                  }

                  const val = ev.isTime ? parseTimeToSeconds(rawValStr) : (parseFloat(rawValStr) || 0);
                  const score = hasAttempt ? calculateOfficialAftScore(ev.code, val, trainee.ageGroup) : 0;
                  const passed = hasAttempt && score >= 60;
                  if (passed) eventPassCount++;
                  if (hasAttempt) total += score;
                  return { code: ev.code, raw: displayRaw, score, passed, has: hasAttempt };
                });

                const allDone = eventResults.every(e => e.has);
                const isPassed = allDone && eventPassCount === 5 && total >= 300;

                return (
                  <div key={trainee.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-black dark:text-white">RN #{trainee.rosterNumber}</span>
                        <span className="text-xs font-black text-gray-900 dark:text-white">{trainee.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-blue-900 dark:text-blue-300">{total} / 500</span>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${!allDone ? 'bg-gray-100 text-gray-500' : isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {!allDone ? `${eventResults.filter(e => e.has).length}/5` : isPassed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>

                    {/* 5-Event Score Badges */}
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {eventResults.map(res => {
                        const isFailed = res.has && !res.passed;
                        return (
                          <div
                            key={res.code}
                            className={`rounded-lg p-1 transition-all ${isFailed
                                ? 'bg-red-500/15 border border-red-500 ring-1 ring-red-500/30 dark:bg-red-950/40 dark:border-red-500'
                                : 'bg-gray-50 border border-transparent dark:bg-slate-800'
                              }`}
                          >
                            <div className={`text-[9px] font-black ${isFailed ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                              {res.code}
                            </div>
                            <div className={`text-[11px] font-black truncate ${isFailed ? 'text-red-700 dark:text-red-300 font-black' : 'text-gray-900 dark:text-white'}`}>
                              {res.raw || '-'}
                            </div>
                            <div className={`text-[10px] font-black ${!res.has ? 'text-gray-300 dark:text-gray-600' : isFailed ? 'text-red-600 dark:text-red-400 font-black' : 'text-green-600 dark:text-green-400'}`}>
                              {res.score}p
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Event Navigation Bar: MDL -> HRP -> SDC -> PLK -> 2MR -> RESULT */}
      <footer className="sticky bottom-0 z-40 w-full bg-blue-950 border-t border-blue-900 shadow-2xl shrink-0">
        <div className="flex w-full text-xs sm:text-sm font-extrabold">
          {EVENT_CONFIGS.map((ev, idx) => {
            const isEvCompleted = currentTrainees.length > 0 && currentTrainees.every((t) => {
              if (ev.code === 'MDL') {
                return (t.scores.MDL || '').trim() !== '' || (t.scores.MDL2 || '').trim() !== '';
              }
              return (t.scores[ev.code] || '').trim() !== '';
            });

            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => handleSetEventIndex(idx)}
                className={`flex-1 py-2.5 text-center transition-all border-t-2 active:scale-95 flex flex-col items-center justify-center gap-0.5 ${currentEventIndex === idx && !isSummaryView
                    ? 'border-amber-400 text-amber-300 bg-blue-900 font-black shadow-inner'
                    : 'border-transparent text-blue-200/80 hover:text-white hover:bg-blue-900/40'
                  }`}
              >
                <span className="flex items-center gap-1">
                  <span>{ev.code}</span>
                  {isEvCompleted && <span className="text-[10px] text-emerald-400 font-black">✓</span>}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleSetEventIndex(EVENT_CONFIGS.length)}
            className={`flex-1 py-2.5 text-center transition-all border-t-2 active:scale-95 flex flex-col items-center justify-center gap-0.5 ${isSummaryView
                ? 'border-amber-400 text-amber-300 bg-blue-900 font-black shadow-inner'
                : 'border-transparent text-blue-200/80 hover:text-white hover:bg-blue-900/40'
              }`}
          >
            <span>RESULT</span>
          </button>
        </div>
      </footer>

      {/* Dual Lane Selection Modal (2MR only) */}
      {onSelectSecondaryLane && allLaneConfigs && activeCountByLane && selectedLane !== RETEST_LANE_NUM && (
        <DualLaneModal
          isOpen={isDualLaneModalOpen}
          onClose={() => setIsDualLaneModalOpen(false)}
          currentLane={selectedLane}
          selectedSecondaryLane={secondaryLane ?? null}
          laneConfigs={allLaneConfigs}
          activeCountByLane={activeCountByLane}
          onSelectLane={onSelectSecondaryLane}
        />
      )}

      {/* HRP Fullscreen Focus Clicker Modal */}
      {activeHrpTrainee && (
        <HrpClickerModal
          isOpen={!!activeHrpTrainee}
          trainee={activeHrpTrainee}
          laneConfig={currentLaneConfig}
          onClose={() => setActiveHrpTrainee(null)}
          onSaveScore={(traineeId, reps) => {
            onScoreChange(traineeId, 'HRP', String(reps), selectedLane);
          }}
        />
      )}
    </>
  );
};
