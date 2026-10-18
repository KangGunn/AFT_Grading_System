import React, { useState, useEffect, useRef } from 'react';
import type { TraineeRecord, LaneConfig } from '../../types/aft/aft.types';
import { getOfficialPassingStandard, calculateOfficialAftScore } from '../../data/aftStandards2025';

interface HrpClickerModalProps {
  trainee: TraineeRecord;
  laneConfig: LaneConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveScore: (traineeId: string, reps: number) => void;
}

export const HrpClickerModal: React.FC<HrpClickerModalProps> = ({
  trainee,
  laneConfig,
  isOpen,
  onClose,
  onSaveScore
}) => {
  // Existing score or 0
  const initialReps = Math.max(0, parseInt(trainee.scores.HRP || '0', 10) || 0);
  const [reps, setReps] = useState<number>(initialReps);

  // 2-Minute Countdown Timer (120,000 ms)
  const [remainingMs, setRemainingMs] = useState<number>(120000);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);

  // Reset local state when modal opens for a new/different trainee
  useEffect(() => {
    if (isOpen) {
      const currentVal = Math.max(0, parseInt(trainee.scores.HRP || '0', 10) || 0);
      setReps(currentVal);
      setRemainingMs(120000);
      setIsRunning(false);
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      endTimeRef.current = null;
    }
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isOpen, trainee.id, trainee.scores.HRP]);

  const triggerHaptic = (durationMs = 25) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
      }
    } catch {
      // Ignore vibration errors if unsupported
    }
  };

  const startTimer = () => {
    // If starting a fresh 2-minute timer, reset reps to 0
    if (remainingMs === 120000) {
      setReps(0);
    }
    const duration = remainingMs > 0 ? remainingMs : 120000;
    endTimeRef.current = performance.now() + duration;
    setIsRunning(true);

    const tick = () => {
      if (!endTimeRef.current) return;
      const left = Math.max(0, endTimeRef.current - performance.now());
      setRemainingMs(left);
      if (left > 0) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        setIsRunning(false);
        endTimeRef.current = null;
        triggerHaptic(200); // 200ms end vibration
      }
    };
    timerRef.current = requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    setIsRunning(false);
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    endTimeRef.current = null;
  };

  const resetTimer = () => {
    stopTimer();
    setRemainingMs(120000);
    setReps(0);
  };

  // Clicker Actions
  const handleTapCount = () => {
    // If timer is not running yet, the first touch resets reps to 0 and starts the 2-minute timer
    if (!isRunning) {
      startTimer();
      triggerHaptic(30);
      return;
    }
    // Subsequent touches while running increment the reps count
    setReps((prev) => prev + 1);
    triggerHaptic(20);
  };

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReps((prev) => Math.max(0, prev - 1));
    triggerHaptic(15);
  };

  const handleFinish = () => {
    stopTimer();
    onSaveScore(trainee.id, reps);
    onClose();
  };

  if (!isOpen) return null;

  const totalSec = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const hundredths = Math.floor((remainingMs % 1000) / 10).toString().padStart(2, '0');

  const passingStandard = getOfficialPassingStandard('HRP', trainee.ageGroup);
  const currentOfficialScore = calculateOfficialAftScore('HRP', reps, trainee.ageGroup);
  const isPassed = currentOfficialScore >= 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none animate-fadeIn">
      {/* Top Section: Trainee Info + Passing Status + Timer Display + Controls */}
      <header className="shrink-0 bg-blue-950/90 border-b border-blue-900/60 px-4 py-3 shadow-lg">
        {/* Row 1: Trainee Name, Vest Number, Close Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black shadow-sm ring-1 ring-white/20"
              style={{
                backgroundColor: laneConfig.vestColorCode,
                color: '#ffffff'
              }}
            >
              #{trainee.vestNumber || '-'}
            </span>
            <div className="truncate min-w-0">
              <h2 className="text-base font-black truncate text-white leading-tight">
                {trainee.name}
              </h2>
              <p className="text-[11px] text-blue-300 font-bold truncate">
                RN #{trainee.rosterNumber} · {trainee.ageGroup}
              </p>
            </div>
          </div>

          {/* Action Buttons: Finish/Save & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleFinish}
              className="h-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-blue-950 px-3 text-xs font-black shadow-md active:scale-95 flex items-center gap-1 transition-all"
            >
              <span>✓</span>
              <span>SAVE & CLOSE</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-xs font-black flex items-center justify-center border border-blue-800/80 active:scale-95"
              title="Cancel without saving"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Row 2: Standard Badge + 2-Min Timer with Start/Reset */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-blue-900/40">
          {/* Passing Standard Reference */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-blue-300">PASS (60 pts):</span>
            <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-amber-300 border border-amber-400/40 font-black">
              {passingStandard} reps
            </span>
            <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${isPassed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-blue-400'}`}>
              {reps} reps ({currentOfficialScore} pts)
            </span>
          </div>

          {/* 2-Min Stopwatch Display & Controls (No Pause) */}
          <div className="flex items-center gap-2 shrink-0">
            {!isRunning && remainingMs === 120000 ? (
              <button
                type="button"
                onClick={startTimer}
                className="h-7 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-blue-950 px-2.5 text-[10px] font-bold shadow transition-all active:scale-95"
              >
                🚀 START
              </button>
            ) : (
              <button
                type="button"
                onClick={resetTimer}
                className="h-7 rounded-lg bg-red-600 hover:bg-red-500 text-white px-2 text-[10px] font-black shadow transition-all active:scale-95 flex items-center justify-center gap-1 border border-red-400/40"
                title="Reset Timer"
              >
                <span>🔄</span>
                <span>RESET</span>
              </button>
            )}

            {/* Timer Output Display */}
            <div className="relative flex items-center justify-center h-7 rounded-lg">
              {isRunning && (
                <div
                  className={`absolute -inset-[1px] rounded-lg pointer-events-none transition-all ${
                    remainingMs <= 10000
                      ? 'border-2 border-red-500 ring-2 ring-red-500/60 animate-ping'
                      : 'border-2 border-emerald-400 ring-2 ring-emerald-400/60 animate-pulse'
                  }`}
                />
              )}
              <div className="flex items-center justify-center bg-blue-950 px-2 h-7 rounded-lg border border-blue-800 shadow-inner z-10">
                <span className="font-mono text-sm font-black text-amber-300 tracking-wider">
                  {mins}:{secs.toString().padStart(2, '0')}
                  <span className="text-[9px] text-blue-200 font-normal">.{hundredths}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Touch Pad (Full Screen Clicker Area) */}
      <main
        onClick={handleTapCount}
        className="flex-1 w-full flex flex-col items-center justify-center relative cursor-pointer active:bg-blue-900/30 transition-colors touch-manipulation"
      >
        {/* Subtle Watermark/Helper Text */}
        <div className="text-center opacity-60 mb-2 pointer-events-none">
          <span className="text-xs uppercase tracking-widest text-blue-300 font-bold">
            {isRunning ? 'TAP ANYWHERE TO COUNT' : 'TAP ANYWHERE TO START TIMER'}
          </span>
        </div>

        {/* Massive Push-Up Reps Counter */}
        <div className="flex flex-col items-center justify-center pointer-events-none select-none my-auto">
          <span className="text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tight text-amber-400 drop-shadow-md">
            {reps}
          </span>
          <span className="text-sm sm:text-base font-black text-blue-200 tracking-widest uppercase mt-1">
            REPETITIONS
          </span>
        </div>

        {/* Bottom Floating Auxiliary Controls (-1 / Manual Adjust) */}
        <div className="absolute bottom-5 inset-x-4 flex items-center justify-between pointer-events-auto">
          {/* Minus 1 Button */}
          <button
            type="button"
            onClick={handleMinus}
            disabled={reps <= 0}
            className={`h-14 px-5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 border transition-all active:scale-95 ${
              reps > 0
                ? 'bg-slate-800/90 hover:bg-slate-700 text-red-300 border-red-500/40 ring-1 ring-red-500/30'
                : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
            }`}
          >
            <span className="text-lg">−1</span>
            <span className="text-xs text-slate-400 font-normal">UNDO</span>
          </button>

          {/* Quick Info / Reset Counter */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Reset reps to 0?')) {
                  setReps(0);
                  triggerHaptic(40);
                }
              }}
              className="h-10 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 text-xs font-black transition-all active:scale-95"
            >
              CLEAR COUNT
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
