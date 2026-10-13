import React from 'react';
import type { LaneConfig } from '../../types/aft/aft.types';
import { VEST_COLORS } from '../../utils/aft/constants';
import { getContrastTextColor } from '../../lib/utils';

interface VestSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  laneConfigs: Record<number, LaneConfig>;
  onUpdateLaneColor: (laneNum: number, colorName: string, colorCode: string) => void;
}

export const VestSettingsModal: React.FC<VestSettingsModalProps> = ({
  isOpen,
  onClose,
  laneConfigs,
  onUpdateLaneColor
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎽</span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Lane Vest Colors
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Customize vest color for each lane
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-700 dark:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* 10 Lanes List with Color Selectors */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3 space-y-2.5 min-h-0">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((laneNum) => {
            const cfg = laneConfigs[laneNum] || {
              laneNumber: laneNum,
              vestColor: 'Red',
              vestColorCode: '#EF4444'
            };
            const contrastTextColor = getContrastTextColor(cfg.vestColorCode, cfg.vestColor);

            return (
              <div
                key={laneNum}
                className="flex items-center justify-between p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 gap-3"
              >
                {/* Left: Current Vest Badge Preview */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl font-black text-xs shadow border border-black/10"
                    style={{
                      backgroundColor: cfg.vestColorCode,
                      color: contrastTextColor
                    }}
                  >
                    L{laneNum}
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900 dark:text-white">
                      Lane {laneNum}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400">
                      {cfg.vestColor}
                    </div>
                  </div>
                </div>

                {/* Right: Color Preset Palette Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end flex-1">
                  {VEST_COLORS.map((c) => {
                    const isSelected = cfg.vestColor.toLowerCase() === c.name.toLowerCase();
                    const dotTextColor = getContrastTextColor(c.code, c.name);

                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => onUpdateLaneColor(laneNum, c.name, c.code)}
                        className={`h-6 px-1.5 rounded-lg text-[10px] font-black border transition-all active:scale-95 flex items-center justify-center gap-1 shadow-2xs ${
                          isSelected
                            ? 'ring-2 ring-blue-500 scale-105 border-blue-500 shadow-sm'
                            : 'border-black/10 hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: c.code,
                          color: dotTextColor
                        }}
                        title={`Set Lane ${laneNum} to ${c.name}`}
                      >
                        {isSelected && <span className="text-[9px]">✓</span>}
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t pt-3 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-xs font-black text-white shadow"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
