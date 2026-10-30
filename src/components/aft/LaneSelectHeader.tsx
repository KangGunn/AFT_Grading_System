import React from 'react';

interface LaneSelectHeaderProps {
  activeCohortName?: string;
  onOpenSettings: () => void;
  onOpenAllResults: () => void;
  onOpenImport?: () => void;
}

export const LaneSelectHeader: React.FC<LaneSelectHeaderProps> = ({ 
  activeCohortName,
  onOpenSettings,
  onOpenAllResults
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
      <div className="grid grid-cols-[36px_1fr_36px] items-center px-3 py-2.5 gap-2">
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800 text-base font-black text-white hover:bg-blue-800 active:scale-95 shadow transition-all"
          title="Settings (Cycle management, vest colors, trainee roster & Excel import)"
          aria-label="Settings"
        >
          <span>⚙️</span>
        </button>
        <div className="text-center min-w-0">
          <h1 className="text-base font-black tracking-wider leading-tight">AFT GRADING SYSTEM</h1>
          <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block truncate">
            Lane Selection {activeCohortName ? `• Cycle [${activeCohortName}]` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={onOpenAllResults}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-700 border border-emerald-600 text-base font-black text-white hover:bg-emerald-600 active:scale-95 shadow transition-all"
            title="All Results & Statistics (Spreadsheet)"
            aria-label="All Trainee Results"
          >
            <span>📊</span>
          </button>
        </div>
      </div>
    </header>
  );
};
