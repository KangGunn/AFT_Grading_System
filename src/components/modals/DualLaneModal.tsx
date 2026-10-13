import React from 'react';
import type { LaneConfig } from '../../types/aft/aft.types';
import { getContrastTextColor } from '../../lib/utils';

interface DualLaneModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLane: number;
  selectedSecondaryLane: number | null;
  laneConfigs: Record<number, LaneConfig>;
  activeCountByLane: Record<number, number>;
  onSelectLane: (laneNum: number | null) => void;
}

export const DualLaneModal: React.FC<DualLaneModalProps> = ({
  isOpen,
  onClose,
  currentLane,
  selectedSecondaryLane,
  laneConfigs,
  activeCountByLane,
  onSelectLane
}) => {
  if (!isOpen) return null;

  const currentSecondaryConfig = selectedSecondaryLane
    ? laneConfigs[selectedSecondaryLane] || {
        laneNumber: selectedSecondaryLane,
        vestColor: 'Blue',
        vestColorCode: '#3B82F6'
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[90vh] rounded-3xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Simultaneous 2MR Grading
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Grade two lanes together on a split screen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-700 dark:bg-slate-800 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3 space-y-3 min-h-0">
          {/* Active Dual Lane Status & Cancel Button */}
          {selectedSecondaryLane && currentSecondaryConfig && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-500 dark:text-amber-300 uppercase tracking-wide">
                  Currently Active
                </span>
                <span
                  className="px-2 py-0.5 rounded-lg text-xs font-black"
                  style={{
                    backgroundColor: currentSecondaryConfig.vestColorCode,
                    color: getContrastTextColor(currentSecondaryConfig.vestColorCode, currentSecondaryConfig.vestColor)
                  }}
                >
                  Lane {selectedSecondaryLane} · {currentSecondaryConfig.vestColor}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300">
                Grading simultaneously with Lane {currentLane}. Click below to return to single-lane view.
              </p>
              <button
                type="button"
                onClick={() => {
                  onSelectLane(null);
                  onClose();
                }}
                className="w-full mt-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black tracking-wider transition-all active:scale-95 shadow flex items-center justify-center gap-1.5 border border-red-400/40"
              >
                <span>✕</span>
                <span>CANCEL DUAL GRADING (SINGLE LANE ONLY)</span>
              </button>
            </div>
          )}

          <div>
            <div className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {selectedSecondaryLane ? 'Switch to Another Lane:' : 'Select Lane to Grade Together:'}
            </div>

            {/* List of Other Available Lanes */}
            <div className="space-y-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1)
                .filter((laneNum) => laneNum !== currentLane)
                .map((laneNum) => {
                  const cfg = laneConfigs[laneNum] || {
                    laneNumber: laneNum,
                    vestColor: 'Red',
                    vestColorCode: '#EF4444'
                  };
                  const isCurrent = laneNum === selectedSecondaryLane;
                  const count = activeCountByLane[laneNum] ?? 10;
                  const vestTextColor = getContrastTextColor(cfg.vestColorCode, cfg.vestColor);

                  return (
                    <button
                      key={laneNum}
                      type="button"
                      onClick={() => {
                        onSelectLane(laneNum);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all active:scale-98 ${
                        isCurrent
                          ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30'
                          : 'border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-7 min-w-16 px-2 rounded-xl text-xs font-black flex items-center justify-center shadow-sm border border-black/10"
                          style={{
                            backgroundColor: cfg.vestColorCode,
                            color: vestTextColor
                          }}
                        >
                          LANE {laneNum}
                        </span>
                        <div className="text-left">
                          <div className="text-xs font-black text-gray-900 dark:text-white">
                            {cfg.vestColor} Vest
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            {count} Soldiers
                          </div>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-blue-950">
                          ✓ ACTIVE
                        </span>
                      ) : (
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                          SELECT →
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-3 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
