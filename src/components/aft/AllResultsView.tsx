import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { TraineeRecord, LaneConfig } from '../../types/aft/aft.types';
import { calculateOfficialAftScore } from '../../data/aftStandards2025';
import { parseTimeToSeconds } from '../../utils/aft/timeFormatter';
import { getContrastTextColor } from '../../lib/utils';

interface AllResultsViewProps {
  laneTrainees: Record<number, TraineeRecord[]>;
  activeCountByLane: Record<number, number>;
  laneConfigs: Record<number, LaneConfig>;
  onBackToLanes: () => void;
  backButtonLabel?: string;
  onOpenReTest?: () => void;
}

interface ProcessedTraineeResult {
  lane: number;
  laneConfig: LaneConfig;
  trainee: TraineeRecord;
  rnNum: number; // For clean numerical sorting
  // Raw attempts (Initial)
  mdl1: string;
  mdl2: string;
  hrp: string;
  sdc: string;
  plk: string;
  tmr: string;
  // Converted official scores (Initial)
  mdlScore: number;
  hrpScore: number;
  sdcScore: number;
  plkScore: number;
  tmrScore: number;
  totalScore: number;
  passedCount: number;
  allCompleted: boolean;
  isPassed: boolean;
  // Re-Test Results
  mdlRetest?: string;
  hrpRetest?: string;
  sdcRetest?: string;
  plkRetest?: string;
  tmrRetest?: string;
  mdlRetestScore?: number;
  hrpRetestScore?: number;
  sdcRetestScore?: number;
  plkRetestScore?: number;
  tmrRetestScore?: number;
  hasAnyRetest: boolean;
  finalTotalScore: number;
  finalPassed: boolean;
  isRetestPass: boolean;
}

export const AllResultsView: React.FC<AllResultsViewProps> = ({
  laneTrainees,
  activeCountByLane,
  laneConfigs,
  onBackToLanes,
  backButtonLabel = 'Lanes',
  onOpenReTest
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLane, setFilterLane] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pass' | 'retest_pass' | 'fail' | 'incomplete'>('all');

  // Flatten and process all active trainees across all 10 lanes
  const allResults: ProcessedTraineeResult[] = useMemo(() => {
    const list: ProcessedTraineeResult[] = [];

    for (let lane = 1; lane <= 10; lane++) {
      const trainees = laneTrainees[lane] || [];
      const count = activeCountByLane[lane] ?? trainees.length;
      const activeList = trainees.slice(0, count);
      const cfg = laneConfigs[lane] || {
        laneNumber: lane,
        vestColor: 'Red',
        vestColorCode: '#EF4444'
      };

      for (const t of activeList) {
        // MDL Best attempt calculation
        const mdl1 = (t.scores.MDL || '').trim();
        const mdl2 = (t.scores.MDL2 || '').trim();
        const hasMdl = mdl1 !== '' || mdl2 !== '';
        const v1 = mdl1 !== '' ? parseFloat(mdl1) || 0 : -1;
        const v2 = mdl2 !== '' ? parseFloat(mdl2) || 0 : -1;
        const bestMdl = Math.max(v1 >= 0 ? v1 : 0, v2 >= 0 ? v2 : 0);
        const mdlScore = hasMdl ? calculateOfficialAftScore('MDL', bestMdl, t.ageGroup) : 0;

        // HRP
        const hrp = (t.scores.HRP || '').trim();
        const hasHrp = hrp !== '';
        const hrpVal = hasHrp ? parseFloat(hrp) || 0 : 0;
        const hrpScore = hasHrp ? calculateOfficialAftScore('HRP', hrpVal, t.ageGroup) : 0;

        // SDC
        const sdc = (t.scores.SDC || '').trim();
        const hasSdc = sdc !== '';
        const sdcSec = hasSdc ? parseTimeToSeconds(sdc) : 0;
        const sdcScore = hasSdc ? calculateOfficialAftScore('SDC', sdcSec, t.ageGroup) : 0;

        // PLK
        const plk = (t.scores.PLK || '').trim();
        const hasPlk = plk !== '';
        const plkSec = hasPlk ? parseTimeToSeconds(plk) : 0;
        const plkScore = hasPlk ? calculateOfficialAftScore('PLK', plkSec, t.ageGroup) : 0;

        // 2MR
        const tmr = (t.scores['2MR'] || '').trim();
        const hasTmr = tmr !== '';
        const tmrSec = hasTmr ? parseTimeToSeconds(tmr) : 0;
        const tmrScore = hasTmr ? calculateOfficialAftScore('2MR', tmrSec, t.ageGroup) : 0;

        let passedCount = 0;
        if (hasMdl && mdlScore >= 60) passedCount++;
        if (hasHrp && hrpScore >= 60) passedCount++;
        if (hasSdc && sdcScore >= 60) passedCount++;
        if (hasPlk && plkScore >= 60) passedCount++;
        if (hasTmr && tmrScore >= 60) passedCount++;

        const totalScore = mdlScore + hrpScore + sdcScore + plkScore + tmrScore;
        const allCompleted = hasMdl && hasHrp && hasSdc && hasPlk && hasTmr;
        const isPassed = allCompleted && passedCount === 5 && totalScore >= 300;

        // Re-test calculation
        const mdlRetest1 = (t.retestScores?.MDL || '').trim();
        const mdlRetest2 = (t.retestScores?.MDL2 || '').trim();
        const hasMdlRetest = mdlRetest1 !== '' || mdlRetest2 !== '';
        const rv1 = mdlRetest1 !== '' ? parseFloat(mdlRetest1) || 0 : -1;
        const rv2 = mdlRetest2 !== '' ? parseFloat(mdlRetest2) || 0 : -1;
        const bestMdlRetest = Math.max(rv1 >= 0 ? rv1 : 0, rv2 >= 0 ? rv2 : 0);
        const mdlRetestScore = hasMdlRetest ? calculateOfficialAftScore('MDL', bestMdlRetest, t.ageGroup) : undefined;
        const mdlRetestDisplay = hasMdlRetest
          ? (mdlRetest1 !== '' && mdlRetest2 !== '' ? `${mdlRetest1} / ${mdlRetest2}` : (mdlRetest1 || mdlRetest2))
          : undefined;

        const hrpRetest = (t.retestScores?.HRP || '').trim();
        const hasHrpRetest = hrpRetest !== '';
        const hrpRetestScore = hasHrpRetest ? calculateOfficialAftScore('HRP', parseFloat(hrpRetest) || 0, t.ageGroup) : undefined;

        const sdcRetest = (t.retestScores?.SDC || '').trim();
        const hasSdcRetest = sdcRetest !== '';
        const sdcRetestScore = hasSdcRetest ? calculateOfficialAftScore('SDC', parseTimeToSeconds(sdcRetest), t.ageGroup) : undefined;

        const plkRetest = (t.retestScores?.PLK || '').trim();
        const hasPlkRetest = plkRetest !== '';
        const plkRetestScore = hasPlkRetest ? calculateOfficialAftScore('PLK', parseTimeToSeconds(plkRetest), t.ageGroup) : undefined;

        const tmrRetest = (t.retestScores?.['2MR'] || '').trim();
        const hasTmrRetest = tmrRetest !== '';
        const tmrRetestScore = hasTmrRetest ? calculateOfficialAftScore('2MR', parseTimeToSeconds(tmrRetest), t.ageGroup) : undefined;

        const hasAnyRetest = hasMdlRetest || hasHrpRetest || hasSdcRetest || hasPlkRetest || hasTmrRetest;

        // Effective scores
        const effMdlScore = hasMdlRetest && mdlRetestScore !== undefined ? mdlRetestScore : mdlScore;
        const effHrpScore = hasHrpRetest && hrpRetestScore !== undefined ? hrpRetestScore : hrpScore;
        const effSdcScore = hasSdcRetest && sdcRetestScore !== undefined ? sdcRetestScore : sdcScore;
        const effPlkScore = hasPlkRetest && plkRetestScore !== undefined ? plkRetestScore : plkScore;
        const effTmrScore = hasTmrRetest && tmrRetestScore !== undefined ? tmrRetestScore : tmrScore;

        let finalPassedCount = 0;
        if ((hasMdl || hasMdlRetest) && effMdlScore >= 60) finalPassedCount++;
        if ((hasHrp || hasHrpRetest) && effHrpScore >= 60) finalPassedCount++;
        if ((hasSdc || hasSdcRetest) && effSdcScore >= 60) finalPassedCount++;
        if ((hasPlk || hasPlkRetest) && effPlkScore >= 60) finalPassedCount++;
        if ((hasTmr || hasTmrRetest) && effTmrScore >= 60) finalPassedCount++;

        const finalTotalScore = effMdlScore + effHrpScore + effSdcScore + effPlkScore + effTmrScore;
        const finalPassed = allCompleted && finalPassedCount === 5 && finalTotalScore >= 300;
        const isRetestPass = !isPassed && finalPassed;

        // Extract numeric portion of rosterNumber for clean sorting
        const rnMatch = t.rosterNumber.match(/\d+/);
        const rnNum = rnMatch ? parseInt(rnMatch[0], 10) : 999999;

        list.push({
          lane,
          laneConfig: cfg,
          trainee: t,
          rnNum,
          mdl1,
          mdl2,
          hrp,
          sdc,
          plk,
          tmr,
          mdlScore,
          hrpScore,
          sdcScore,
          plkScore,
          tmrScore,
          totalScore,
          passedCount,
          allCompleted,
          isPassed,
          mdlRetest: mdlRetestDisplay,
          hrpRetest: hasHrpRetest ? hrpRetest : undefined,
          sdcRetest: hasSdcRetest ? sdcRetest : undefined,
          plkRetest: hasPlkRetest ? plkRetest : undefined,
          tmrRetest: hasTmrRetest ? tmrRetest : undefined,
          mdlRetestScore,
          hrpRetestScore,
          sdcRetestScore,
          plkRetestScore,
          tmrRetestScore,
          hasAnyRetest,
          finalTotalScore,
          finalPassed,
          isRetestPass
        });
      }
    }

    // Sort by RN ascending
    list.sort((a, b) => {
      if (a.rnNum !== b.rnNum) return a.rnNum - b.rnNum;
      return a.trainee.rosterNumber.localeCompare(b.trainee.rosterNumber);
    });

    return list;
  }, [laneTrainees, activeCountByLane, laneConfigs]);

  // Filtered list
  const filteredResults = useMemo(() => {
    return allResults.filter(item => {
      if (filterLane !== 'all' && item.lane !== filterLane) return false;
      if (filterStatus === 'pass' && !item.isPassed) return false;
      if (filterStatus === 'retest_pass' && !item.isRetestPass) return false;
      if (filterStatus === 'fail' && (!item.allCompleted || item.finalPassed)) return false;
      if (filterStatus === 'incomplete' && item.allCompleted) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const rn = item.trainee.rosterNumber.toLowerCase();
        const name = item.trainee.name.toLowerCase();
        const vest = item.trainee.vestNumber.toLowerCase();
        return rn.includes(query) || name.includes(query) || vest.includes(query);
      }
      return true;
    });
  }, [allResults, filterLane, filterStatus, searchTerm]);

  // Export current table to Excel file
  const handleExportExcel = () => {
    const data = filteredResults.map(item => ({
      'RN': item.trainee.rosterNumber,
      'Name': item.trainee.name,
      'Age': item.trainee.age,
      // Raw attempts (Initial)
      'MDL 1': item.mdl1 || '-',
      'MDL 2': item.mdl2 || '-',
      'HRP': item.hrp || '-',
      'SDC': item.sdc || '-',
      'PLK': item.plk || '-',
      '2MR': item.tmr || '-',
      // Converted scores (Initial)
      'MDL (pts)': item.mdlScore,
      'HRP (pts)': item.hrpScore,
      'SDC (pts)': item.sdcScore,
      'PLK (pts)': item.plkScore,
      '2MR (pts)': item.tmrScore,
      'Initial Total': item.totalScore,
      'Initial Result': !item.allCompleted ? 'Incomplete' : item.isPassed ? 'PASS' : 'FAIL',
      // Re-Test Results
      'MDL Re': item.mdlRetest || '-',
      'MDL Re (pts)': item.mdlRetestScore ?? '-',
      'HRP Re': item.hrpRetest || '-',
      'HRP Re (pts)': item.hrpRetestScore ?? '-',
      'SDC Re': item.sdcRetest || '-',
      'SDC Re (pts)': item.sdcRetestScore ?? '-',
      'PLK Re': item.plkRetest || '-',
      'PLK Re (pts)': item.plkRetestScore ?? '-',
      '2MR Re': item.tmrRetest || '-',
      '2MR Re (pts)': item.tmrRetestScore ?? '-',
      'Final Total': item.finalTotalScore,
      'Final Result': !item.allCompleted ? 'Incomplete' : item.finalPassed ? (item.isRetestPass ? 'RE-TEST PASS' : 'PASS') : 'FAIL',
      'Lane': `Lane ${item.lane} (${item.laneConfig.vestColor})`
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AFT Total Results');
    XLSX.writeFile(wb, `AFT_Full_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const totalCount = allResults.length;
  const incompletedCount = allResults.filter(r => !r.allCompleted).length;
  const failedCount = allResults.filter(r => r.allCompleted && !r.isPassed).length;
  const retestPassCount = allResults.filter(r => r.isRetestPass).length;
  // Recycle: initial failed trainees who completed retest attempts but still failed
  const recycleCount = allResults.filter(r => r.allCompleted && !r.isPassed && r.hasAnyRetest && !r.finalPassed).length;

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header - Compact & non-overlapping stats */}
      <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5 gap-2">
          {/* Left: Back Button */}
          <button
            onClick={onBackToLanes}
            className="flex items-center gap-1 rounded-lg bg-blue-800 px-2.5 py-1.5 text-xs font-black text-white active:scale-95 hover:bg-blue-700 uppercase shrink-0 shadow"
            title={`돌아가기 (${backButtonLabel})`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{backButtonLabel}</span>
          </button>

          {/* Center: Title + Concise 3-item Stats (Total · Fail · Recycle) */}
          <div className="text-center min-w-0 flex flex-col items-center justify-center">
            <h1 className="text-sm sm:text-base font-black tracking-wider leading-tight">
              SCORECARD
            </h1>
            <div className="text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase tracking-wide mt-0.5 flex items-center gap-1 whitespace-nowrap">
              <span>Total <strong className="text-white">{totalCount}</strong></span>
              <span>·</span>
              <span>Fail <strong className="text-amber-300">{failedCount}</strong></span>
              <span>·</span>
              <span>Recycle <strong className="text-red-400">{recycleCount}</strong></span>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-1.5 justify-end shrink-0">
            {onOpenReTest && (
              <button
                onClick={onOpenReTest}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white text-[10px] font-black shadow transition-all border border-red-400 shrink-0"
                title="Fail 인원 재시험 채점 화면으로 이동"
              >
                <span>♻️</span>
                <span>Re-Test</span>
                {failedCount > 0 && (
                  <span className="rounded-full bg-slate-950 px-1 text-[9px] text-red-200 font-black border border-red-400">
                    {failedCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center px-2 py-1.5 rounded-lg bg-emerald-700 border border-emerald-600 text-[10px] font-black text-white hover:bg-emerald-600 active:scale-95 shadow transition-all shrink-0"
              title="엑셀 파일로 다운로드"
            >
              <span>📥</span>
              <span className="hidden sm:inline ml-1">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filter / Search Bar - Compact single row on mobile to maximize table view space */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-2.5 py-1.5 flex items-center gap-1.5 shrink-0">
        <div className="relative flex-1 min-w-0 flex items-center">
          <span className="absolute left-2.5 pointer-events-none select-none text-xs leading-none flex items-center justify-center">🔍</span>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: '11px' }}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2 h-7 font-bold text-white placeholder-slate-400 placeholder:text-[11px] leading-normal focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={filterLane}
          onChange={(e) => setFilterLane(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={{ fontSize: '11px' }}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 h-7 font-bold text-white focus:outline-none focus:border-blue-500 shrink-0"
        >
          <option value="all">All Lanes</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(l => (
            <option key={l} value={l}>L{l}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{ fontSize: '11px' }}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 h-7 font-bold text-white focus:outline-none focus:border-blue-500 shrink-0"
        >
          <option value="all">Status</option>
          <option value="pass">PASS</option>
          <option value="retest_pass">Re-Pass</option>
          <option value="fail">FAIL</option>
          <option value="incomplete">Incompl</option>
        </select>
      </div>

      {/* Main Table Area with Horizontal & Vertical Scroll */}
      <div className="flex-1 overflow-auto bg-slate-950 select-text">
        <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-20 bg-slate-900 text-slate-200 border-b-2 border-slate-700 shadow-sm">
            {/* Super Header Grouping */}
            <tr className="border-b border-slate-800 text-[11px] font-black uppercase text-slate-400">
              <th colSpan={4} className="px-3 py-1.5 text-center bg-slate-900/90 border-r-2 border-blue-500/40 text-blue-300">
                👤 Trainee Info
              </th>
              <th colSpan={6} className="px-3 py-1.5 text-center bg-slate-900/90 border-r-2 border-blue-500/40 text-amber-300">
                ⏱️ Initial Raw Scores
              </th>
              <th colSpan={7} className="px-3 py-1.5 text-center bg-slate-900/90 border-r-2 border-blue-500/40 text-emerald-300">
                🎯 Initial Points & Result
              </th>
              <th colSpan={7} className="px-3 py-1.5 text-center bg-amber-950/40 text-amber-300">
                🔄 Re-Test Scores & Final Status
              </th>
            </tr>

            {/* Sub Header Columns */}
            <tr className="font-extrabold text-[11px] text-slate-300">
              {/* Trainee Info */}
              <th className="px-2.5 py-2 text-center w-12 bg-slate-900">Lane</th>
              <th className="px-2.5 py-2 text-center w-14 bg-slate-900 text-white font-black">RN</th>
              <th className="px-2.5 py-2 text-left min-w-[90px] bg-slate-900">Name</th>
              <th className="px-2 py-2 text-center w-12 bg-slate-900 border-r-2 border-blue-500/40">Age</th>

              {/* Initial Raw Attempts */}
              <th className="px-2 py-2 text-center w-14 bg-slate-900/80">MDL 1</th>
              <th className="px-2 py-2 text-center w-14 bg-slate-900/80">MDL 2</th>
              <th className="px-2 py-2 text-center w-14 bg-slate-900/80">HRP</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80">SDC</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80">PLK</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 border-r-2 border-blue-500/40">2MR</th>

              {/* Initial Points */}
              <th className="px-2 py-2 text-center w-12 bg-slate-900/60">MDL</th>
              <th className="px-2 py-2 text-center w-12 bg-slate-900/60">HRP</th>
              <th className="px-2 py-2 text-center w-12 bg-slate-900/60">SDC</th>
              <th className="px-2 py-2 text-center w-12 bg-slate-900/60">PLK</th>
              <th className="px-2 py-2 text-center w-12 bg-slate-900/60">2MR</th>
              <th className="px-2.5 py-2 text-center w-16 bg-blue-950/80 text-blue-200 font-black">Total</th>
              <th className="px-3 py-2 text-center w-16 bg-slate-900 border-r-2 border-blue-500/40">Result</th>

              {/* Re-Test Columns */}
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">MDL Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">HRP Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">SDC Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">PLK Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">2MR Re</th>
              <th className="px-2.5 py-2 text-center w-18 bg-amber-950/50 text-amber-300 font-black">Final Total</th>
              <th className="px-3 py-2 text-center w-20 bg-slate-900 text-purple-300 font-black">Final Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80 font-medium">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={24} className="text-center py-12 text-slate-500 font-bold">
                  No trainee results found.
                </td>
              </tr>
            ) : (
              filteredResults.map((item, idx) => (
                <tr
                  key={`${item.lane}-${item.trainee.id}`}
                  className={`hover:bg-slate-800/60 transition-colors ${item.isRetestPass
                      ? 'bg-emerald-950/20'
                      : item.allCompleted && !item.finalPassed
                        ? 'bg-red-950/15'
                        : idx % 2 === 0
                          ? 'bg-slate-950'
                          : 'bg-slate-900/40'
                    }`}
                >
                  {/* 1. Trainee Info */}
                  <td className="px-2.5 py-2 text-center font-bold">
                    {(() => {
                      const badgeTextColor = getContrastTextColor(item.laneConfig.vestColorCode, item.laneConfig.vestColor);
                      return (
                        <span
                          className="inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-black shadow-xs border border-black/15"
                          style={{
                            backgroundColor: item.laneConfig.vestColorCode,
                            color: badgeTextColor
                          }}
                          title={`Lane ${item.lane} (${item.laneConfig.vestColor})`}
                        >
                          {item.lane}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-2.5 py-2 text-center font-black text-yellow-300">
                    #{item.trainee.rosterNumber}
                  </td>
                  <td className="px-2.5 py-2 text-left font-black text-white truncate max-w-[120px]" title={item.trainee.name}>
                    {item.trainee.name}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-400 font-bold border-r-2 border-blue-500/40">
                    {item.trainee.age}
                  </td>

                  {/* 2. Initial Raw Attempts */}
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-200">
                    {item.mdl1 || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-200">
                    {item.mdl2 || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-200">
                    {item.hrp || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-200">
                    {item.sdc || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-200">
                    {item.plk || '-'}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-slate-200 border-r-2 border-blue-500/40">
                    {item.tmr || '-'}
                  </td>

                  {/* 3. Initial Converted Points & Result */}
                  <td className={`px-2 py-2 text-center font-mono font-black ${!item.mdl1 && !item.mdl2 ? 'text-slate-600' : item.mdlScore < 60 ? 'text-red-400 bg-red-950/30' : 'text-emerald-400'
                    }`}>
                    {item.mdl1 || item.mdl2 ? `${item.mdlScore}p` : '-'}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono font-black ${!item.hrp ? 'text-slate-600' : item.hrpScore < 60 ? 'text-red-400 bg-red-950/30' : 'text-emerald-400'
                    }`}>
                    {item.hrp ? `${item.hrpScore}p` : '-'}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono font-black ${!item.sdc ? 'text-slate-600' : item.sdcScore < 60 ? 'text-red-400 bg-red-950/30' : 'text-emerald-400'
                    }`}>
                    {item.sdc ? `${item.sdcScore}p` : '-'}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono font-black ${!item.plk ? 'text-slate-600' : item.plkScore < 60 ? 'text-red-400 bg-red-950/30' : 'text-emerald-400'
                    }`}>
                    {item.plk ? `${item.plkScore}p` : '-'}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono font-black ${!item.tmr ? 'text-slate-600' : item.tmrScore < 60 ? 'text-red-400 bg-red-950/30' : 'text-emerald-400'
                    }`}>
                    {item.tmr ? `${item.tmrScore}p` : '-'}
                  </td>
                  <td className="px-2.5 py-2 text-center font-mono font-black text-blue-300 bg-blue-950/40">
                    {item.totalScore}p
                  </td>
                  <td className="px-3 py-2 text-center border-r-2 border-blue-500/40">
                    {!item.allCompleted ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-400">
                        {item.passedCount}/5
                      </span>
                    ) : item.isPassed ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        PASS
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                        FAIL
                      </span>
                    )}
                  </td>

                  {/* 4. Dedicated Re-Test Columns */}
                  <td className="px-2 py-2 text-center font-mono">
                    {item.mdlRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.mdlRetest}</div>
                        <div className={`text-[10px] font-black ${item.mdlRetestScore !== undefined && item.mdlRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.mdlRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.hrpRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.hrpRetest}</div>
                        <div className={`text-[10px] font-black ${item.hrpRetestScore !== undefined && item.hrpRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.hrpRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.sdcRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.sdcRetest}</div>
                        <div className={`text-[10px] font-black ${item.sdcRetestScore !== undefined && item.sdcRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.sdcRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.plkRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.plkRetest}</div>
                        <div className={`text-[10px] font-black ${item.plkRetestScore !== undefined && item.plkRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.plkRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.tmrRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.tmrRetest}</div>
                        <div className={`text-[10px] font-black ${item.tmrRetestScore !== undefined && item.tmrRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.tmrRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2.5 py-2 text-center font-mono font-black bg-amber-950/20">
                    {item.hasAnyRetest ? (
                      <span className="text-amber-300 font-black">{item.finalTotalScore}p</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    {!item.allCompleted ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-400">
                        {item.passedCount}/5
                      </span>
                    ) : item.isRetestPass ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-400 shadow-sm" title="Passed after Re-Test">
                        RE-PASS
                      </span>
                    ) : item.isPassed ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        PASS
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                        {item.hasAnyRetest ? 'RE-FAIL' : 'FAIL'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
