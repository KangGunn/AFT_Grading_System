import React, { useState, useEffect } from 'react';
import type { LaneConfig } from '../../types/aft/aft.types';
import {
  DEFAULT_VEST_COLOR_CODES,
  loadAvailableVestColors,
  saveAvailableVestColors
} from '../../utils/aft/constants';
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
  const [palette, setPalette] = useState<string[]>(() => loadAvailableVestColors());
  const [newColorDraft, setNewColorDraft] = useState<string>('#3B82F6');

  useEffect(() => {
    if (isOpen) {
      setPalette(loadAvailableVestColors());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEditColor = (index: number, newColor: string) => {
    const oldColor = palette[index];
    const updated = [...palette];
    updated[index] = newColor;
    setPalette(updated);
    saveAvailableVestColors(updated);

    // If any lane was using oldColor, update it to newColor
    Object.values(laneConfigs).forEach((cfg) => {
      if (cfg && (cfg.vestColorCode || '').toLowerCase() === (oldColor || '').toLowerCase()) {
        onUpdateLaneColor(cfg.laneNumber, newColor, newColor);
      }
    });
  };

  const handleAddColor = (newColor: string) => {
    const updated = [...palette, newColor];
    setPalette(updated);
    saveAvailableVestColors(updated);
    setNewColorDraft((prev) => (prev === '#3B82F6' ? '#10B981' : '#3B82F6'));
  };

  const handleDeleteColor = (index: number) => {
    if (palette.length <= 1) return;
    const updated = palette.filter((_, i) => i !== index);
    setPalette(updated);
    saveAvailableVestColors(updated);
  };

  const handleResetPalette = () => {
    setPalette(DEFAULT_VEST_COLOR_CODES);
    saveAvailableVestColors(DEFAULT_VEST_COLOR_CODES);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-white p-4 sm:p-5 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎽</span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Lane Vest Colors
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Customize palette & assign vest colors to lanes
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

        {/* Section 1: Palette Management */}
        <div className="border-b pb-3 pt-3 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>Vest Color Palette</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                  {palette.length}
                </span>
              </h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Click swatch to edit with palette · Click + to add new color
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetPalette}
              className="text-[11px] font-bold text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
            >
              Reset Defaults
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {palette.map((color, idx) => (
              <div key={`palette-${idx}-${color}`} className="relative group">
                <div
                  className="w-8 h-8 rounded-xl border border-black/15 shadow-xs transition-transform group-hover:scale-105 overflow-hidden relative cursor-pointer"
                  style={{ backgroundColor: color }}
                  title="Click to edit color"
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleEditColor(idx, e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    title="Click to edit color"
                  />
                </div>
                {palette.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteColor(idx);
                    }}
                    className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-slate-700 hover:bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md transition-all hover:scale-110 active:scale-95"
                    title="Remove color from palette"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* Add Color via Color Picker */}
            <div className="relative group">
              <label
                className="w-8 h-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs group-hover:bg-blue-50/50 dark:group-hover:bg-slate-800/50 relative overflow-hidden"
                title="Pick a color from palette to add"
              >
                <span className="text-base font-black text-gray-400 group-hover:text-blue-500 dark:text-gray-500 dark:group-hover:text-blue-400 select-none leading-none">
                  +
                </span>
                <input
                  type="color"
                  value={newColorDraft}
                  onChange={(e) => {
                    handleAddColor(e.target.value);
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  title="Pick a color from palette to add"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: 10 Lanes List with Color Selectors */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3 space-y-2.5 min-h-0">
          <div className="px-0.5">
            <h4 className="text-xs font-black text-gray-900 dark:text-white">
              Assign to Lanes
            </h4>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Click a color to assign to the lane
            </p>
          </div>

          {Array.from({ length: 10 }, (_, i) => i + 1).map((laneNum) => {
            const cfg = laneConfigs[laneNum] || {
              laneNumber: laneNum,
              vestColor: palette[(laneNum - 1) % palette.length] || '#EF4444',
              vestColorCode: palette[(laneNum - 1) % palette.length] || '#EF4444'
            };
            const contrastTextColor = getContrastTextColor(cfg.vestColorCode);

            return (
              <div
                key={laneNum}
                className="flex items-center justify-between p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 gap-3"
              >
                {/* Left: Current Vest Badge Preview */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl font-black text-xs shadow border border-black/10 transition-colors"
                    style={{
                      backgroundColor: cfg.vestColorCode,
                      color: contrastTextColor
                    }}
                  >
                    L{laneNum}
                  </div>
                  <div className="text-xs font-black text-gray-900 dark:text-white">
                    Lane {laneNum}
                  </div>
                </div>

                {/* Right: Color Palette Swatches */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end flex-1">
                  {palette.map((color, idx) => {
                    const isSelected = (cfg.vestColorCode || '').toLowerCase() === color.toLowerCase();
                    const dotTextColor = getContrastTextColor(color);

                    return (
                      <button
                        key={`${laneNum}-${idx}-${color}`}
                        type="button"
                        onClick={() => onUpdateLaneColor(laneNum, color, color)}
                        className={`h-7 w-7 rounded-lg border transition-all active:scale-95 flex items-center justify-center shadow-2xs ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-105 border-blue-500 shadow-sm'
                            : 'border-black/15 hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: color,
                          color: dotTextColor
                        }}
                        title={`Assign to Lane ${laneNum}`}
                      >
                        {isSelected && <span className="text-xs font-black">✓</span>}
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
