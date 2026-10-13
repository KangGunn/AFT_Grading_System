import React, { useRef, useState } from 'react';
import type { TraineeRecord } from '../../types/aft/aft.types';
import { parseTraineeExcel } from '../../utils/aft/excelParser';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadRoster: (
    parsedTrainees: Record<number, TraineeRecord[]>,
    counts: Record<number, number>,
    totalTrainees: number
  ) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onUploadRoster
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;

        const { parsedTraineesByLane, counts, totalTrainees } = parseTraineeExcel(bstr);

        try {
          await onUploadRoster(parsedTraineesByLane, counts, totalTrainees);
          setImportStatus(`✅ Successfully shared ${totalTrainees} trainees to all 10 lanes!`);
          setTimeout(() => {
            onClose();
            setImportStatus(null);
          }, 1200);
        } catch (syncErr: any) {
          console.error('Firebase sync error:', syncErr);
          setImportStatus(`⚠️ Saved locally, but Firebase sync failed: ${syncErr?.message || syncErr}`);
        }
      } catch (err: any) {
        console.error('Import parse error:', err);
        setImportStatus(`❌ Failed to parse Excel file: ${err?.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-black text-gray-900 dark:text-white">Import Trainee Excel</h3>
          <button
            onClick={() => {
              onClose();
              setImportStatus(null);
            }}
            className="rounded-full bg-gray-100 p-1 text-gray-400 hover:text-gray-700 dark:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
          Upload an Excel (.xlsx / .xls) or .csv file with 3 columns:
          <br />
          <strong>Column 1: Roster Number</strong> · <strong>Column 2: Name</strong> · <strong>Column 3: Age</strong>
          <br />
          <span className="text-[11px] text-gray-400">
            Works with or without header row. Trainees will be automatically distributed across 10 lanes.
          </span>
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl bg-blue-900 py-3.5 text-xs font-black text-white shadow-md active:scale-95 hover:bg-blue-800 mb-2 flex items-center justify-center gap-2"
        >
          <span>📁 SELECT EXCEL FILE</span>
        </button>

        {importStatus && (
          <div className="mt-2 text-center text-xs font-bold text-blue-600 dark:text-blue-400">
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
};
