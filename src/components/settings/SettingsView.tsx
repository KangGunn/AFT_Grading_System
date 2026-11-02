import React, { useState, useMemo } from 'react';
import type { CohortRecord, LaneConfig, TraineeRecord } from '../../types/aft/aft.types';
import { getContrastTextColor } from '../../lib/utils';
import {
  getCohortPlatoonCounts,
  isCohortRosterUploaded
} from '../../utils/aft/cycleStorage';

interface SettingsViewProps {
  cohorts: CohortRecord[];
  activeCohortId: string;
  onSwitchCohort: (cohortId: string) => void;
  onCreateCohort: (name: string) => Promise<CohortRecord | void>;
  onDeleteCohort: (cohortId: string) => Promise<void>;
  onRenameCohort?: (cohortId: string, newName: string) => Promise<void>;
  laneConfigs: Record<number, LaneConfig>;
  laneTrainees: Record<number, TraineeRecord[]>;
  activeCountByLane: Record<number, number>;
  onBack: () => void;
  onOpenVestSettings: () => void;
  onOpenImport: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  cohorts,
  activeCohortId,
  onSwitchCohort,
  onCreateCohort,
  onDeleteCohort,
  laneConfigs,
  onBack,
  onOpenVestSettings,
  onOpenImport
}) => {
  const [newCohortInput, setNewCohortInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCohort = useMemo(() => {
    return cohorts.find(c => c.id === activeCohortId) || {
      id: activeCohortId,
      name: activeCohortId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }, [cohorts, activeCohortId]);

  // Compute uploaded trainee count for each cycle (strictly counts only uploaded trainees)
  const getCycleDisplayCount = (cohort: CohortRecord): string => {
    const counts = getCohortPlatoonCounts(cohort.id);
    const alpha = counts.hasUploaded ? counts.alpha : (cohort.alphaTraineeCount ?? 0);
    const bravo = counts.hasUploaded ? counts.bravo : (cohort.bravoTraineeCount ?? 0);
    const total = alpha + bravo;

    if (total === 0) {
      return 'Trainees: 0 (Alpha: 0, Bravo: 0)';
    }

    if (alpha > 0 && bravo === 0) {
      return `Trainees: ${alpha} (Alpha: ${alpha}, Bravo: 0)`;
    }
    if (alpha === 0 && bravo > 0) {
      return `Trainees: ${bravo} (Alpha: 0, Bravo: ${bravo})`;
    }
    return `Trainees: ${total} (Alpha: ${alpha}, Bravo: ${bravo})`;
  };

  const showFeedback = (success: string | null, error: string | null) => {
    setSuccessMsg(success);
    setErrorMsg(error);
    if (success) {
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCohortInput.trim();
    if (!trimmed) {
      showFeedback(null, 'Please enter a cycle name. (e.g. 01-27)');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateCohort(trimmed);
      setNewCohortInput('');
      showFeedback(`Created and switched to new cycle "${trimmed}".`, null);
    } catch (err: any) {
      showFeedback(null, err?.message || 'Failed to create cycle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitch = (cohort: CohortRecord) => {
    if (cohort.id === activeCohortId) return;
    try {
      onSwitchCohort(cohort.id);
      // No popup notification on switch per user request
    } catch (err: any) {
      showFeedback(null, err?.message || 'Failed to switch cycle.');
    }
  };

  const handleDelete = async (cohort: CohortRecord) => {
    if (cohort.id === activeCohortId) {
      showFeedback(null, 'The active cycle cannot be deleted. Please switch to another cycle first.');
      return;
    }
    if (cohorts.length <= 1) {
      showFeedback(null, 'At least one cycle must be maintained.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete cycle "${cohort.name}"?\nAll trainee roster information and grading records for this cycle will be permanently removed.`
    );
    if (!confirmed) return;

    try {
      await onDeleteCohort(cohort.id);
      showFeedback(`Cycle "${cohort.name}" has been deleted.`, null);
    } catch (err: any) {
      showFeedback(null, err?.message || 'Failed to delete cycle.');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
        <div className="grid grid-cols-[80px_1fr_80px] items-center px-3 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-black bg-blue-950/70 hover:bg-blue-800 text-white px-2.5 py-1.5 rounded-xl border border-blue-800 active:scale-95 transition-all w-fit"
            title="Back to Lane Selection"
          >
            <span>←</span>
            <span>Lanes</span>
          </button>
          <div className="text-center min-w-0">
            <h1 className="text-base font-black tracking-wider leading-tight">SETTINGS</h1>
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block">
              System Configuration • Cycle [{activeCohort.name}]
            </span>
          </div>
          <div className="w-full" />
        </div>
      </header>

      {/* Main Settings Content Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-4">
        {/* Flash Notifications */}
        {successMsg && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 p-3 text-xs font-black text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-800 font-black text-sm ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800 p-3 text-xs font-black text-red-800 dark:text-red-200 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-600 hover:text-red-800 font-black text-sm ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* SECTION 1: CYCLE MANAGEMENT */}
        <section className="rounded-2xl bg-white dark:bg-slate-850 p-4 border border-gray-200 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-400 dark:hover:border-indigo-600">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xl shrink-0">
              🎖️
            </span>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              Cycle Management
            </h2>
          </div>

          {/* Create New Cycle Input Form */}
          <form onSubmit={handleCreate} className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1.5">
              Create & Register New Cycle:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCohortInput}
                onChange={(e) => setNewCohortInput(e.target.value)}
                placeholder="e.g. 01-27"
                className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting || !newCohortInput.trim()}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1 active:scale-95"
              >
                <span>+ Add Cycle</span>
              </button>
            </div>
          </form>

          {/* Cycle List */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
              <span>Registered Cycles ({cohorts.length})</span>
              <span>Tap to switch</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
              {cohorts.map((cohort) => {
                const isActive = cohort.id === activeCohortId;
                const traineeDisplay = getCycleDisplayCount(cohort);

                return (
                  <div
                    key={cohort.id}
                    onClick={() => handleSwitch(cohort)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                        : 'bg-gray-50/60 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700/80 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer active:scale-[0.99]'
                    }`}
                    title={isActive ? `Cycle "${cohort.name}" is currently active` : `Click to switch to cycle "${cohort.name}"`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                            {cohort.name}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-black bg-indigo-600 text-white px-1.5 py-0.2 rounded-md">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="font-bold text-gray-700 dark:text-gray-300">
                            {traineeDisplay}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(cohort.updatedAt || cohort.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {!isActive && cohorts.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cohort);
                          }}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 p-1.5 rounded-lg transition-all text-xs"
                          title={`Delete cycle "${cohort.name}"`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 2: VEST COLORS SETTING */}
        <section className="rounded-2xl bg-white dark:bg-slate-850 p-4 border border-gray-200 dark:border-slate-800 shadow-sm transition-all hover:border-blue-400 dark:hover:border-blue-600">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xl shrink-0">
                🎽
              </span>
              <h2 className="text-sm font-black text-gray-900 dark:text-white">
                Lane Vest Colors Configuration
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenVestSettings}
              className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs px-3.5 py-2 shadow-xs transition-all flex items-center gap-1"
            >
              <span>Configure</span>
              <span>→</span>
            </button>
          </div>

          {/* Current Vest Colors Quick Preview */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block mb-2">
              Current Vest Colors Preview:
            </span>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((laneNum) => {
                const cfg = laneConfigs[laneNum];
                const colorCode = cfg?.vestColorCode || '#2563EB';
                const textColor = getContrastTextColor(colorCode);

                return (
                  <div
                    key={laneNum}
                    className="flex items-center justify-center py-2 px-1 rounded-xl border border-black/10 shadow-2xs text-center font-black text-xs"
                    style={{ backgroundColor: colorCode, color: textColor }}
                    title={`Lane ${laneNum}`}
                  >
                    <span>L{laneNum}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3: TRAINEE ROSTER & EXCEL UPLOAD */}
        <section className="rounded-2xl bg-white dark:bg-slate-850 p-4 border border-gray-200 dark:border-slate-800 shadow-sm transition-all hover:border-emerald-400 dark:hover:border-emerald-600">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xl shrink-0">
                📋
              </span>
              <h2 className="text-sm font-black text-gray-900 dark:text-white">
                Trainee Roster & Excel Import
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenImport}
              className="shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs px-3.5 py-2 shadow-xs transition-all flex items-center gap-1"
            >
              <span>Manage Roster</span>
              <span>→</span>
            </button>
          </div>

          {/* Trainee Roster Quick Summary */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-gray-500 dark:text-gray-400 shrink-0">
              Roster Status
            </span>
            <span className="px-2.5 py-0.5 rounded-full border text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/50 truncate">
              {getCycleDisplayCount(activeCohort)}
            </span>
          </div>
        </section>

        {/* System Sync Note */}
        <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <span className="text-base shrink-0">💡</span>
          <p className="leading-relaxed">
            Cycle rosters and evaluation scores are stored independently and synced in real-time across Firebase and local device storage.
          </p>
        </div>
      </main>
    </div>
  );
};
