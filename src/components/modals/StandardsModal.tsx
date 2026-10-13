import React, { useState } from 'react';
import type { AgeGroupKey } from '../../types/aft/standards.types';
import {
  MDL_MALE_TABLE,
  HRP_MALE_TABLE,
  SDC_MALE_TABLE,
  PLK_MALE_TABLE,
  TWO_MILE_RUN_MALE_TABLE,
  formatSecondsToTime
} from '../../data/aftStandards2025';

interface StandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandardsModal: React.FC<StandardsModalProps> = ({ isOpen, onClose }) => {
  const [standardsEventTab, setStandardsEventTab] = useState<'MDL' | 'HRP' | 'SDC' | 'PLK' | '2MR'>('MDL');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4">
      <div className="w-full max-w-lg max-h-[85vh] rounded-3xl bg-white p-3.5 sm:p-4 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-black text-blue-950 dark:text-white flex items-center gap-1.5">
              <span>📜</span>
              <span>AFT Standards (2025)</span>
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Approved: 1 May 2025 · Male Standards
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 p-1 text-gray-400 hover:text-gray-700 dark:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Event Selector Tabs - Clean Grid for Mobile */}
        <div className="grid grid-cols-5 gap-1 border-b border-gray-200 dark:border-slate-800 pb-2.5 my-2">
          {(['MDL', 'HRP', 'SDC', 'PLK', '2MR'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStandardsEventTab(tab)}
              className={`py-1.5 text-xs font-black rounded-xl text-center transition-all ${
                standardsEventTab === tab
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table Content Area (Compact, 17-21, 22-26, 27-31 only) */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 dark:border-slate-800">
          <table className="w-full text-center text-xs">
            <thead className="bg-blue-950 text-white sticky top-0 font-black text-[11px]">
              <tr>
                <th className="py-2 px-1 border-r border-blue-900 w-24">PTS</th>
                {(['17-21', '22-26', '27-31'] as const).map((ag) => (
                  <th key={ag} className="py-2 px-1 border-r border-blue-900">
                    {ag}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 font-mono text-xs">
              {(() => {
                let tableData: Record<number, Record<AgeGroupKey, number>>;
                let isTimeFormat = false;

                switch (standardsEventTab) {
                  case 'MDL':
                    tableData = MDL_MALE_TABLE;
                    break;
                  case 'HRP':
                    tableData = HRP_MALE_TABLE;
                    break;
                  case 'SDC':
                    tableData = SDC_MALE_TABLE;
                    isTimeFormat = true;
                    break;
                  case 'PLK':
                    tableData = PLK_MALE_TABLE;
                    isTimeFormat = true;
                    break;
                  case '2MR':
                    tableData = TWO_MILE_RUN_MALE_TABLE;
                    isTimeFormat = true;
                    break;
                }

                const points = Object.keys(tableData).map(Number).sort((a, b) => b - a);
                const relevantAges: AgeGroupKey[] = ['17-21', '22-26', '27-31'];

                return points.map((pt) => {
                  const isPassing = pt === 60;
                  const isMax = pt === 100;
                  return (
                    <tr
                      key={pt}
                      className={`${
                        isPassing
                          ? 'bg-amber-100 dark:bg-amber-950/60 font-black text-amber-950 dark:text-amber-200'
                          : isMax
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 font-black text-emerald-950 dark:text-emerald-200'
                          : pt < 60
                          ? 'bg-red-500/10 dark:bg-red-950/30 text-gray-900 dark:text-white font-bold'
                          : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-1.5 px-1 font-black border-r border-gray-200 dark:border-slate-800 whitespace-nowrap text-[11px]">
                        {pt} {isPassing ? '⭐(PASS)' : isMax ? '🏆(MAX)' : ''}
                      </td>
                      {relevantAges.map((ag) => {
                        const val = tableData[pt]?.[ag];
                        const displayVal = val !== undefined ? (isTimeFormat ? formatSecondsToTime(val) : val) : '-';
                        return (
                          <td key={ag} className="py-1.5 px-1 border-r border-gray-200 dark:border-slate-800 font-bold text-gray-900 dark:text-white">
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Verification Footer */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t pt-2 dark:border-slate-800">
          <span>* Showing age groups 17-21, 22-26, 27-31.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-900 px-3.5 py-1.5 text-xs font-black text-white active:scale-95 hover:bg-blue-800"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
