import React, { useRef, useState, useMemo } from 'react';
import type { TraineeRecord, LaneConfig } from '../../types/aft/aft.types';
import { parseTraineeExcel } from '../../utils/aft/excelParser';
import { getContrastTextColor } from '../../lib/utils';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadRoster: (
    parsedTrainees: Record<number, TraineeRecord[]>,
    counts: Record<number, number>,
    totalTrainees: number
  ) => Promise<void>;
  laneTrainees?: Record<number, TraineeRecord[]>;
  laneConfigs?: Record<number, LaneConfig>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onUploadRoster,
  laneTrainees = {},
  laneConfigs = {}
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedLaneTab, setSelectedLaneTab] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Flatten trainees with lane info for easy filtering and viewing
  const allTraineesWithLane = useMemo(() => {
    const list: Array<TraineeRecord & { laneNumber: number }> = [];
    for (let lane = 1; lane <= 10; lane++) {
      const trainees = laneTrainees[lane] || [];
      trainees.forEach((t) => {
        list.push({ ...t, laneNumber: lane });
      });
    }
    return list;
  }, [laneTrainees]);

  const filteredTrainees = useMemo(() => {
    return allTraineesWithLane.filter((t) => {
      const matchesLane = selectedLaneTab === 'all' || t.laneNumber === selectedLaneTab;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.rosterNumber.toLowerCase().includes(q) ||
        (t.vestNumber && t.vestNumber.toLowerCase().includes(q));
      return matchesLane && matchesSearch;
    });
  }, [allTraineesWithLane, selectedLaneTab, searchQuery]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) {
          setIsUploading(false);
          return;
        }

        const { parsedTraineesByLane, counts, totalTrainees } = parseTraineeExcel(bstr);

        try {
          await onUploadRoster(parsedTraineesByLane, counts, totalTrainees);
          setImportStatus(`✅ Successfully imported ${totalTrainees} soldiers across 10 lanes!`);
        } catch (syncErr: any) {
          console.error('Firebase sync error:', syncErr);
          setImportStatus(`⚠️ Saved locally, but Firebase sync failed: ${syncErr?.message || syncErr}`);
        }
      } catch (err: any) {
        console.error('Import parse error:', err);
        setImportStatus(`❌ Failed to parse Excel file: ${err?.message || err}`);
      } finally {
        setIsUploading(false);
        // Reset file input value so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                Trainee Roster Management
              </h3>
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                Total {allTraineesWithLane.length} soldiers enrolled across 10 lanes
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setImportStatus(null);
            }}
            className="h-8 w-8 rounded-full bg-gray-200/80 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-300 flex items-center justify-center text-sm font-bold transition-all active:scale-95"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Action Bar: Excel Upload Button + Search Input */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            <span>📤</span>
            <span>{isUploading ? 'IMPORTING...' : 'EXCEL UPLOAD (.xlsx)'}</span>
          </button>

          {/* Search Box */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search name or RN #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-8 pr-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-[11px] font-bold text-gray-900 dark:text-white outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 placeholder:text-gray-400 placeholder:text-[11px]"
            />
          </div>
        </div>

        {/* Upload Status / Toast Banner */}
        {importStatus && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-100 dark:border-blue-900 text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center justify-between">
            <span>{importStatus}</span>
            <button
              onClick={() => setImportStatus(null)}
              className="text-xs text-blue-500 hover:text-blue-700 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Lane Filter Tabs */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800 overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedLaneTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-black shrink-0 transition-all ${
              selectedLaneTab === 'all'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
            }`}
          >
            ALL ({allTraineesWithLane.length})
          </button>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((lane) => {
            const laneCount = (laneTrainees[lane] || []).length;
            const config = laneConfigs[lane];
            const isSelected = selectedLaneTab === lane;
            return (
              <button
                key={lane}
                type="button"
                onClick={() => setSelectedLaneTab(lane)}
                className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                }`}
              >
                {config && (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: config.vestColorCode }}
                  />
                )}
                <span>L{lane}</span>
                <span className="text-[10px] opacity-70">({laneCount})</span>
              </button>
            );
          })}
        </div>

        {/* Trainee List Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 bg-gray-50/50 dark:bg-slate-950/40">
          {filteredTrainees.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <span className="text-3xl block mb-2">📭</span>
              <p className="text-xs font-bold">No trainees found.</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Upload an Excel file using the button above to import trainees.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredTrainees.map((t) => {
                const config = laneConfigs[t.laneNumber];
                const badgeColor = config?.vestColorCode || '#2563EB';
                const badgeTextColor = getContrastTextColor(badgeColor, config?.vestColor);

                return (
                  <div
                    key={`${t.laneNumber}-${t.id}`}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm"
                  >
                    {/* Left: Lane Badge (L1, L2, ...) with Lane Vest Color */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-sm"
                        style={{
                          backgroundColor: badgeColor,
                          color: badgeTextColor
                        }}
                        title={`Lane ${t.laneNumber}`}
                      >
                        L{t.laneNumber}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Top: Name */}
                        <div className="text-xs font-black text-gray-900 dark:text-white truncate leading-tight">
                          {t.name}
                        </div>
                        {/* Bottom: Highlighted RN badge + Age info */}
                        <div className="flex items-center gap-1.5 mt-1 leading-none">
                          <span className="rounded bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.5 text-[10px] font-black text-blue-900 dark:text-blue-300">
                            RN #{t.rosterNumber}
                          </span>
                          <span className="text-[11px] font-bold text-gray-400">
                            {t.age} yrs ({t.ageGroup})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/80 text-[10px] sm:text-[11px] text-gray-500 flex items-center justify-between gap-2 shrink-0">
          <span className="truncate">Format: Col 1(RN) · 2(Name) · 3(Age)</span>
          <span className="font-black text-gray-700 dark:text-gray-300 shrink-0">
            {filteredTrainees.length} soldiers
          </span>
        </div>
      </div>
    </div>
  );
};
