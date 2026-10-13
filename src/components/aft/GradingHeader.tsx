import React from 'react';

interface GradingHeaderProps {
  selectedLane: number;
  onBackToLanes: () => void;
  onOpenStandards: () => void;
}

export const GradingHeader: React.FC<GradingHeaderProps> = ({
  selectedLane,
  onBackToLanes,
  onOpenStandards
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={onBackToLanes}
          className="flex items-center gap-1 rounded-lg bg-blue-800 px-2.5 py-1.5 text-xs font-black text-white active:scale-95 hover:bg-blue-700 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          LANES
        </button>
        <div className="text-center">
          <h1 className="text-base font-black tracking-wider">AFT GRADING SYSTEM</h1>
          <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">
            LANE {selectedLane} · EVALUATION
          </span>
        </div>
        {/* Standards Reference & Verification Button */}
        <button
          type="button"
          onClick={onOpenStandards}
          className="rounded-lg bg-blue-950 px-2 py-1 text-[10px] font-black text-amber-300 border border-blue-700 active:scale-95 hover:bg-blue-800 transition"
          title="View 2025 Official Score Standards"
        >
          📜 STANDARDS
        </button>
      </div>
    </header>
  );
};
